import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import {
  IntentAutomationRunStatus,
  IntentLeadOutcome,
  IntentOutreachStatus,
  LeadSource,
  NotificationType,
  RoleName,
  type IntentAutomation,
  type Prisma,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { EmailSuppressionService } from "../email-suppression/email-suppression.service";
import { EmailConnectionsService } from "../email-connections/email-connections.service";
import { EmailOAuthService } from "../email-oauth/email-oauth.service";
import { HiringSignalsDiscoveryService } from "./hiring-signals-discovery.service";
import { AiNotConfiguredError, IntentAutomationAiService } from "./intent-automation-ai.service";
import { computeNextRun, startOfCompanyDay } from "./intent-automation.schedule";
import { canUseSalesOrRecruitment } from "../../common/utils/sales-access";
import { toRequestUser } from "../../common/utils/to-request-user";
import { composeEmailHtml } from "../../common/utils/email-body";
import { buildUnsubscribeUrl } from "../../common/utils/unsubscribe-token";
import { sendEmail, sendFailureMessage } from "../../common/utils/mailer";
import type { RequestUser } from "../../common/types/request-user.type";
import type {
  CreateIntentAutomationDto,
  UpdateIntentAutomationDto,
  UpdateOutreachDraftDto,
} from "./dto/intent-automation.dto";
import type { NewsSignalCategory } from "./news-signal.util";

interface Candidate {
  companyName: string;
  companyDomain?: string;
  signalType: "HIRING" | "NEWS";
  signalTitle: string;
  signalUrl?: string;
  signalDetail?: string;
  signalDate?: string;
  location?: string;
  linkedinUrl?: string;
  email?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
}

// Stops the 5-minute tick from being re-entered while a long run is still going.
const MAX_RUNS_PER_TICK = 3;

@Injectable()
export class IntentAutomationService implements OnModuleInit {
  private readonly logger = new Logger(IntentAutomationService.name);
  private ticking = false;
  private readonly running = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly discovery: HiringSignalsDiscoveryService,
    private readonly ai: IntentAutomationAiService,
    private readonly suppression: EmailSuppressionService,
    private readonly emailConnections: EmailConnectionsService,
    private readonly emailOAuth: EmailOAuthService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    try {
      const updated = await this.prisma.intentAutomationRun.updateMany({
        where: { status: IntentAutomationRunStatus.RUNNING },
        data: {
          status: IntentAutomationRunStatus.FAILED,
          error: "Process restarted during execution",
          finishedAt: new Date(),
        },
      });
      if (updated.count > 0) {
        this.logger.log(`Cleaned up ${updated.count} dangling intent automation runs from previous session.`);
      }
    } catch (err) {
      this.logger.warn(`Could not clean up dangling runs: ${err}`);
    }
  }

  // ---------------------------------------------------------------- CRUD

  async list(user: RequestUser) {
    this.assertCanUse(user);
    const automations = await this.prisma.intentAutomation.findMany({
      where: user.role.name === RoleName.ADMIN ? {} : { createdById: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        runs: { orderBy: { startedAt: "desc" }, take: 1 },
        _count: { select: { outreach: { where: { status: IntentOutreachStatus.PENDING_APPROVAL } } } },
      },
    });
    return automations.map(({ runs, _count, ...a }) => ({
      ...a,
      lastRun: runs[0] ?? null,
      pendingApproval: _count.outreach,
    }));
  }

  async create(dto: CreateIntentAutomationDto, user: RequestUser) {
    this.assertCanUse(user);
    this.assertSourceFields(dto);
    const now = new Date();
    const isActive = dto.isActive ?? true;
    return this.prisma.intentAutomation.create({
      data: {
        name: dto.name.trim(),
        source: dto.source,
        roles: (dto.roles ?? []).map((r) => r.trim()).filter(Boolean),
        location: dto.location?.trim() || null,
        newsKeywords: dto.newsKeywords?.trim() || null,
        newsCategory: dto.newsCategory ?? null,
        newsDaysBack: dto.newsDaysBack ?? 30,
        frequency: dto.frequency,
        timeOfDay: dto.timeOfDay,
        weekday: dto.frequency === "WEEKLY" ? (dto.weekday ?? 1) : null,
        autoSend: dto.autoSend ?? false,
        dailyCap: dto.dailyCap ?? 25,
        cooldownDays: dto.cooldownDays ?? 30,
        offerDescription: dto.offerDescription.trim(),
        tone: dto.tone?.trim() || "friendly and professional",
        isActive,
        nextRunAt: isActive
          ? computeNextRun(now, { frequency: dto.frequency, timeOfDay: dto.timeOfDay, weekday: dto.weekday })
          : null,
        createdById: user.id,
      },
    });
  }

  async update(id: string, dto: UpdateIntentAutomationDto, user: RequestUser) {
    const existing = await this.getManageable(id, user);
    const merged = { ...existing, ...stripUndefined(dto) } as typeof existing & UpdateIntentAutomationDto;
    this.assertSourceFields({
      source: merged.source,
      roles: merged.roles,
      newsKeywords: merged.newsKeywords ?? undefined,
    } as CreateIntentAutomationDto);

    const frequency = merged.frequency;
    const scheduleChanged =
      dto.frequency !== undefined || dto.timeOfDay !== undefined || dto.weekday !== undefined;
    const reactivated = dto.isActive === true && !existing.isActive;
    const nextRunAt = !merged.isActive
      ? null
      : scheduleChanged || reactivated || !existing.nextRunAt
        ? computeNextRun(new Date(), {
            frequency,
            timeOfDay: merged.timeOfDay,
            weekday: merged.weekday,
          })
        : existing.nextRunAt;

    return this.prisma.intentAutomation.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        source: dto.source,
        roles: dto.roles?.map((r) => r.trim()).filter(Boolean),
        location: dto.location === undefined ? undefined : dto.location.trim() || null,
        newsKeywords: dto.newsKeywords === undefined ? undefined : dto.newsKeywords.trim() || null,
        newsCategory: dto.newsCategory,
        newsDaysBack: dto.newsDaysBack,
        frequency: dto.frequency,
        timeOfDay: dto.timeOfDay,
        weekday: frequency === "WEEKLY" ? (merged.weekday ?? 1) : null,
        autoSend: dto.autoSend,
        dailyCap: dto.dailyCap,
        cooldownDays: dto.cooldownDays,
        offerDescription: dto.offerDescription?.trim(),
        tone: dto.tone?.trim(),
        isActive: dto.isActive,
        nextRunAt,
      },
    });
  }

  async remove(id: string, user: RequestUser) {
    await this.getManageable(id, user);
    await this.prisma.intentAutomation.delete({ where: { id } });
  }

  async listRuns(id: string, user: RequestUser) {
    await this.getManageable(id, user);
    return this.prisma.intentAutomationRun.findMany({
      where: { automationId: id },
      orderBy: { startedAt: "desc" },
      take: 30,
    });
  }

  // Everything a run found -- including leads that were skipped and why.
  async listLeads(
    id: string,
    user: RequestUser,
    filters: { runId?: string; outcome?: IntentLeadOutcome },
  ) {
    await this.getManageable(id, user);
    return this.prisma.intentAutomationLead.findMany({
      where: { automationId: id, runId: filters.runId, outcome: filters.outcome },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
  }

  async listOutreach(
    user: RequestUser,
    filters: { automationId?: string; status?: IntentOutreachStatus; take?: number },
  ) {
    this.assertCanUse(user);
    return this.prisma.intentAutomationOutreach.findMany({
      where: {
        automationId: filters.automationId,
        status: filters.status,
        ...(user.role.name === RoleName.ADMIN ? {} : { automation: { createdById: user.id } }),
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(filters.take ?? 100, 200),
      include: { automation: { select: { id: true, name: true, autoSend: true } } },
    });
  }

  // ------------------------------------------------------------ approvals

  async updateDraft(outreachId: string, dto: UpdateOutreachDraftDto, user: RequestUser) {
    const row = await this.getManageableOutreach(outreachId, user);
    if (row.status !== IntentOutreachStatus.PENDING_APPROVAL) {
      throw new BadRequestException("Only drafts waiting for approval can be edited");
    }
    return this.prisma.intentAutomationOutreach.update({
      where: { id: outreachId },
      data: { subject: dto.subject?.trim(), body: dto.body?.trim() },
    });
  }

  async approve(outreachId: string, user: RequestUser) {
    const row = await this.getManageableOutreach(outreachId, user);
    if (row.status !== IntentOutreachStatus.PENDING_APPROVAL) {
      throw new BadRequestException("This email is not waiting for approval");
    }
    return this.sendOutreach(row.id, user.id);
  }

  async approveAll(automationId: string, user: RequestUser) {
    await this.getManageable(automationId, user);
    const pending = await this.prisma.intentAutomationOutreach.findMany({
      where: { automationId, status: IntentOutreachStatus.PENDING_APPROVAL },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    let sent = 0;
    let failed = 0;
    for (const { id } of pending) {
      const res = await this.sendOutreach(id, user.id);
      if (res.status === IntentOutreachStatus.SENT) sent++;
      else failed++;
    }
    return { sent, failed };
  }

  async reject(outreachId: string, user: RequestUser) {
    const row = await this.getManageableOutreach(outreachId, user);
    if (row.status !== IntentOutreachStatus.PENDING_APPROVAL) {
      throw new BadRequestException("This email is not waiting for approval");
    }
    return this.prisma.intentAutomationOutreach.update({
      where: { id: outreachId },
      data: { status: IntentOutreachStatus.REJECTED, reviewedById: user.id, reviewedAt: new Date() },
    });
  }

  // ------------------------------------------------------------ scheduling

  // Every 5 minutes: run whichever active automations have come due. The
  // nextRunAt claim below is atomic, so two instances (or two ticks) can't
  // both run the same automation.
  @Cron("*/5 * * * *")
  async tick() {
    if (this.ticking || process.env.DISABLE_INTENT_AUTOMATIONS === "true") return;
    this.ticking = true;
    try {
      const due = await this.prisma.intentAutomation.findMany({
        where: { isActive: true, nextRunAt: { lte: new Date() } },
        orderBy: { nextRunAt: "asc" },
        take: MAX_RUNS_PER_TICK,
      });
      for (const automation of due) {
        const next = computeNextRun(new Date(), {
          frequency: automation.frequency,
          timeOfDay: automation.timeOfDay,
          weekday: automation.weekday,
        });
        const claimed = await this.prisma.intentAutomation.updateMany({
          where: { id: automation.id, nextRunAt: automation.nextRunAt },
          data: { nextRunAt: next },
        });
        if (claimed.count !== 1) continue;
        await this.runAutomation(automation.id, "SCHEDULE");
      }
    } catch (err) {
      this.logger.error(`Intent automation tick failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      this.ticking = false;
    }
  }

  async runNow(id: string, user: RequestUser) {
    await this.getManageable(id, user);
    if (this.running.has(id)) throw new BadRequestException("This automation is already running");
    return this.runAutomation(id, "MANUAL");
  }

  // ------------------------------------------------------------------ run

  async runAutomation(id: string, trigger: "SCHEDULE" | "MANUAL") {
    if (this.running.has(id)) return null;
    this.running.add(id);
    const automation = await this.prisma.intentAutomation.findUnique({ where: { id } });
    if (!automation) {
      this.running.delete(id);
      throw new NotFoundException("Automation not found");
    }
    const run = await this.prisma.intentAutomationRun.create({
      data: { automationId: id, trigger },
    });
    const counts = { leadsFound: 0, queued: 0, sent: 0, skipped: 0, failed: 0 };
    let error: string | null = null;
    let found: Candidate[] = [];
    const savedLeads: Array<Prisma.IntentAutomationLeadCreateManyInput> = [];
    const saveLead = (
      c: Candidate,
      outcome: IntentLeadOutcome,
      skipReason?: string,
      outreachId?: string,
    ) =>
      savedLeads.push({
        automationId: id,
        runId: run.id,
        companyName: c.companyName,
        companyDomain: c.companyDomain ?? null,
        companyLocation: c.location ?? null,
        signalType: c.signalType,
        signalTitle: c.signalTitle,
        signalUrl: c.signalUrl ?? null,
        signalDetail: c.signalDetail ?? null,
        signalDate: c.signalDate && !Number.isNaN(Date.parse(c.signalDate)) ? new Date(c.signalDate) : null,
        contactName: c.name ?? null,
        contactTitle: c.title ?? null,
        contactEmail: c.email?.trim().toLowerCase() ?? null,
        contactLinkedin: c.linkedinUrl ?? null,
        outcome,
        skipReason: skipReason ?? null,
        outreachId: outreachId ?? null,
      });

    try {
      const owner = await this.loadOwner(automation.createdById);
      if (!owner) throw new Error("The automation's owner is no longer an active user");
      const candidates = await this.gatherCandidates(automation, owner);
      found = candidates;
      counts.leadsFound = candidates.length;

      // Searched data is kept even when nothing can be written.
      if (!this.ai.isConfigured()) {
        for (const c of candidates) saveLead(c, "SKIPPED", "AI_NOT_CONFIGURED");
        counts.skipped = candidates.length;
        throw new AiNotConfiguredError();
      }

      const today = startOfCompanyDay(new Date());
      const usedToday = await this.prisma.intentAutomationOutreach.count({
        where: {
          automationId: id,
          createdAt: { gte: today },
          status: { in: [IntentOutreachStatus.PENDING_APPROVAL, IntentOutreachStatus.SENT] },
        },
      });
      const pendingTotal = await this.prisma.intentAutomationOutreach.count({
        where: { automationId: id, status: IntentOutreachStatus.PENDING_APPROVAL },
      });
      let capacity = automation.dailyCap - usedToday;
      if (!automation.autoSend && pendingTotal >= automation.dailyCap * 2) {
        capacity = 0;
        error = "Approval queue is full - approve or reject waiting emails so new ones can be drafted.";
      }

      const seenEmails = new Set<string>();
      for (const candidate of candidates) {
        const email = candidate.email?.trim().toLowerCase();
        if (!email) {
          counts.skipped++;
          saveLead(candidate, "SKIPPED", "NO_EMAIL");
          continue;
        }
        if (seenEmails.has(email)) {
          counts.skipped++;
          saveLead(candidate, "SKIPPED", "DUPLICATE_IN_RUN");
          continue;
        }
        seenEmails.add(email);
        if (capacity <= 0) {
          counts.skipped++;
          saveLead(candidate, "SKIPPED", "DAILY_CAP_REACHED");
          continue;
        }
        const skipReason = await this.shouldSkip(email, candidate.companyName, automation);
        if (skipReason) {
          counts.skipped++;
          saveLead(candidate, "SKIPPED", skipReason);
          continue;
        }

        const firstName = candidate.firstName?.trim() || candidate.name?.trim().split(/\s+/)[0] || "there";
        let draft;
        try {
          draft = await this.ai.generateDraft({
            senderFirstName: owner.firstName,
            senderCompany: this.config.get<string>("COMPANY_NAME") ?? "Venus Global Tech",
            offerDescription: automation.offerDescription,
            tone: automation.tone,
            contactFirstName: firstName,
            contactTitle: candidate.title ?? null,
            companyName: candidate.companyName,
            signalType: candidate.signalType,
            signalTitle: candidate.signalTitle,
            signalDetail: candidate.signalDetail ?? null,
          });
        } catch (err) {
          if (err instanceof AiNotConfiguredError) throw err;
          counts.failed++;
          saveLead(candidate, "FAILED", "DRAFT_FAILED");
          this.logger.warn(`Draft failed for ${candidate.companyName}: ${err}`);
          continue;
        }

        const row = await this.prisma.intentAutomationOutreach.create({
          data: {
            automationId: id,
            runId: run.id,
            companyName: candidate.companyName,
            companyDomain: candidate.companyDomain ?? null,
            contactName: candidate.name?.trim() || firstName,
            contactTitle: candidate.title ?? null,
            contactEmail: email,
            signalType: candidate.signalType,
            signalTitle: candidate.signalTitle,
            signalUrl: candidate.signalUrl ?? null,
            subject: draft.subject,
            body: draft.body,
          },
        });
        capacity--;

        if (automation.autoSend) {
          const sent = await this.sendOutreach(row.id, null);
          if (sent.status === IntentOutreachStatus.SENT) {
            counts.sent++;
            saveLead(candidate, "SENT", undefined, row.id);
          } else {
            counts.failed++;
            saveLead(candidate, "FAILED", "SEND_FAILED", row.id);
          }
        } else {
          counts.queued++;
          saveLead(candidate, "QUEUED", undefined, row.id);
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      this.logger.error(`Intent automation "${automation.name}" failed: ${error}`);
    } finally {
      this.running.delete(id);
    }

    // Every decision maker with an email goes into the CRM contacts (and their
    // company into Companies), whether or not we ended up emailing them.
    await this.saveContacts(found);

    if (savedLeads.length > 0) {
      try {
        await this.prisma.intentAutomationLead.createMany({ data: savedLeads });
      } catch (err) {
        this.logger.warn(`Could not save the leads found by "${automation.name}": ${err}`);
      }
    }

    const failedRun = error !== null && counts.queued + counts.sent === 0 && !/queue is full/.test(error);
    const finished = await this.prisma.intentAutomationRun.update({
      where: { id: run.id },
      data: {
        ...counts,
        error,
        status: failedRun ? IntentAutomationRunStatus.FAILED : IntentAutomationRunStatus.COMPLETED,
        finishedAt: new Date(),
      },
    });
    await this.prisma.intentAutomation.update({ where: { id }, data: { lastRunAt: new Date() } });
    await this.notifyOwner(automation, finished);
    return finished;
  }

  private async gatherCandidates(automation: IntentAutomation, owner: RequestUser): Promise<Candidate[]> {
    const out: Candidate[] = [];

    if (automation.source !== "NEWS") {
      for (const role of automation.roles) {
        try {
          const res = await this.discovery.searchIntentHiring(
            { role, location: automation.location ?? undefined, maxResults: 25 },
            owner,
            { persist: false, allowSamples: false },
          );
          for (const lead of res.leads) {
            // Placeholder rows are never real openings.
            if (lead.id.startsWith("lead-sample-")) continue;
            const dm = lead.decisionMaker;
            out.push({
              companyName: lead.companyName,
              companyDomain: lead.companyDomain,
              signalType: "HIRING",
              signalTitle: lead.jobTitle,
              signalUrl: lead.jobUrl,
              signalDetail: lead.jobDescription ?? undefined,
              signalDate: lead.discoveredAt,
              location: lead.companyLocation,
              linkedinUrl: dm?.linkedinUrl ?? undefined,
              email: dm?.email ?? undefined,
              name: dm?.name,
              firstName: dm?.firstName,
              lastName: dm?.lastName,
              title: dm?.title,
            });
          }
        } catch (err) {
          this.logger.warn(`Hiring search for "${role}" failed: ${err}`);
        }
      }
    }

    if (automation.source !== "HIRING" && automation.newsKeywords) {
      try {
        const res = await this.discovery.searchIntentNews(
          {
            keywords: automation.newsKeywords,
            location: automation.location ?? undefined,
            category: (automation.newsCategory as NewsSignalCategory | null) ?? undefined,
            daysBack: automation.newsDaysBack,
            maxResults: 50,
          },
          owner,
        );
        for (const lead of res.leads) {
          const dm = lead.decisionMaker;
          out.push({
            companyName: lead.companyName,
            companyDomain: lead.companyDomain,
            signalType: "NEWS",
            signalTitle: lead.jobTitle,
            signalUrl: lead.jobUrl || undefined,
            signalDetail: lead.jobDescription,
            signalDate: lead.discoveredAt,
            location: lead.companyLocation,
            linkedinUrl: dm?.linkedinUrl ?? undefined,
            email: dm?.email ?? undefined,
            name: dm?.name,
            firstName: dm?.firstName,
            lastName: dm?.lastName,
            title: dm?.title,
          });
        }
      } catch (err) {
        // A news-plan problem shouldn't hide the hiring half of a BOTH run --
        // unless it is the only source, in which case surface it.
        if (automation.source === "NEWS") throw err;
        this.logger.warn(`News search failed: ${err}`);
      }
    }
    return out;
  }

  private async shouldSkip(
    email: string,
    companyName: string,
    automation: IntentAutomation,
  ): Promise<"SUPPRESSED" | "RECENTLY_CONTACTED" | null> {
    if (await this.suppression.isSuppressed(email)) return "SUPPRESSED";
    const since = new Date(Date.now() - automation.cooldownDays * 86_400_000);
    const recent = await this.prisma.intentAutomationOutreach.findFirst({
      where: {
        createdAt: { gte: since },
        status: { in: [IntentOutreachStatus.SENT, IntentOutreachStatus.PENDING_APPROVAL] },
        OR: [
          { contactEmail: email },
          { companyName: { equals: companyName, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    if (recent) return "RECENTLY_CONTACTED";
    // Also respect mail sent by hand / bulk campaigns to the same address.
    const manual = await this.prisma.bulkEmailRecipient.findFirst({
      where: { email, status: "SENT", sentAt: { gte: since } },
      select: { id: true },
    });
    return manual ? "RECENTLY_CONTACTED" : null;
  }

  // ----------------------------------------------------------------- send

  private async sendOutreach(outreachId: string, reviewerId: string | null) {
    const row = await this.prisma.intentAutomationOutreach.findUniqueOrThrow({
      where: { id: outreachId },
      include: { automation: { select: { createdById: true } } },
    });
    const ownerId = row.automation.createdById;
    try {
      if (await this.suppression.isSuppressed(row.contactEmail)) {
        throw new Error("Email address is suppressed (unsubscribed)");
      }
      const owner = await this.prisma.user.findUniqueOrThrow({
        where: { id: ownerId },
        select: { emailSignatureHtml: true },
      });
      const appUrl =
        this.config.get<string>("APP_URL") ?? this.config.get<string>("CORS_ORIGIN") ?? "http://localhost:8080";
      const unsubscribeUrl = buildUnsubscribeUrl(row.contactEmail, appUrl);
      const html =
        composeEmailHtml(row.body, owner.emailSignatureHtml) +
        `<hr style="margin-top:24px;border:none;border-top:1px solid #ddd" /><p style="font-size:11px;color:#888">Don't want these emails? <a href="${unsubscribeUrl}">Unsubscribe</a></p>`;

      await this.deliver(ownerId, row.contactEmail, row.subject, html);
      const contactId = await this.ensureContact(row);
      return await this.prisma.intentAutomationOutreach.update({
        where: { id: outreachId },
        data: {
          status: IntentOutreachStatus.SENT,
          sentAt: new Date(),
          error: null,
          contactId,
          reviewedById: reviewerId,
          reviewedAt: reviewerId ? new Date() : null,
        },
      });
    } catch (err) {
      return this.prisma.intentAutomationOutreach.update({
        where: { id: outreachId },
        data: {
          status: IntentOutreachStatus.FAILED,
          error: err instanceof Error ? err.message : String(err),
          reviewedById: reviewerId,
          reviewedAt: reviewerId ? new Date() : null,
        },
      });
    }
  }

  // Sends from the owner's own connected mailbox when there is one, otherwise
  // the shared HTTP sender -- the same rules as the Bulk Email engine.
  private async deliver(ownerId: string, to: string, subject: string, html: string) {
    const sendable = await this.emailConnections.requireSendable(ownerId);
    if (sendable.mode === "smtp") {
      await sendable.transporter.sendMail({ from: sendable.from, to, subject, html });
    } else if (sendable.mode === "oauth") {
      await this.emailOAuth.sendMail(sendable.provider, sendable.accessToken, {
        to,
        subject,
        html,
        from: sendable.from,
      });
    } else {
      const result = await sendEmail({ to, subject, html, replyTo: sendable.replyTo });
      if (!result.delivered) throw new Error(sendFailureMessage(result));
    }
  }

  private async saveContacts(candidates: Candidate[]) {
    const seen = new Set<string>();
    for (const c of candidates) {
      const email = c.email?.trim().toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      await this.ensureContact({
        contactEmail: email,
        contactName: c.name?.trim() || c.firstName?.trim() || "there",
        contactTitle: c.title ?? null,
        companyName: c.companyName,
        companyDomain: c.companyDomain ?? null,
      });
    }
  }

  private async ensureContact(row: {
    contactEmail: string;
    contactName: string;
    contactTitle: string | null;
    companyName: string;
    companyDomain: string | null;
  }): Promise<string | null> {
    try {
      const existing = await this.prisma.contact.findFirst({ where: { email: row.contactEmail } });
      if (existing) return existing.id;
      let company = await this.prisma.company.findFirst({
        where: { name: { equals: row.companyName, mode: "insensitive" } },
      });
      if (!company) {
        company = await this.prisma.company.create({
          data: { name: row.companyName, domain: row.companyDomain },
        });
      }
      const [firstName, ...rest] = row.contactName.trim().split(/\s+/);
      const created = await this.prisma.contact.create({
        data: {
          email: row.contactEmail,
          firstName: firstName || "there",
          lastName: rest.join(" ") || "-",
          title: row.contactTitle,
          companyId: company.id,
          source: LeadSource.APOLLO,
        },
      });
      return created.id;
    } catch (err) {
      this.logger.warn(`Could not link CRM contact for ${row.contactEmail}: ${err}`);
      return null;
    }
  }

  // ------------------------------------------------------------- helpers

  private async notifyOwner(
    automation: IntentAutomation,
    run: { status: IntentAutomationRunStatus; leadsFound: number; queued: number; sent: number; skipped: number; failed: number; error: string | null },
  ) {
    try {
      const failed = run.status === IntentAutomationRunStatus.FAILED;
      await this.notifications.create({
        userId: automation.createdById,
        type: NotificationType.GENERAL,
        title: failed
          ? `Intent automation failed: ${automation.name}`
          : `Intent automation ran: ${automation.name}`,
        message: failed
          ? (run.error ?? "The run failed.")
          : `${run.leadsFound} leads found, ${run.sent} sent, ${run.queued} waiting for approval, ${run.skipped} skipped, ${run.failed} failed.${run.error ? ` ${run.error}` : ""}`,
        link: "/intent-hiring?tab=automations",
      });
    } catch (err) {
      this.logger.warn(`Could not notify automation owner: ${err}`);
    }
  }

  private async loadOwner(userId: string): Promise<RequestUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true, department: true },
    });
    if (!user || !user.isActive) return null;
    return toRequestUser(user);
  }

  private assertSourceFields(dto: Pick<CreateIntentAutomationDto, "source" | "roles" | "newsKeywords">) {
    if (dto.source !== "NEWS" && !(dto.roles && dto.roles.some((r) => r.trim()))) {
      throw new BadRequestException("Add at least one job role to search for");
    }
    if (dto.source !== "HIRING" && !dto.newsKeywords?.trim()) {
      throw new BadRequestException("Add an industry or topic for the news search");
    }
  }

  private assertCanUse(user: RequestUser) {
    if (!canUseSalesOrRecruitment(user)) {
      throw new ForbiddenException("Intent automations are only available to Recruitment and Sales");
    }
  }

  private async getManageable(id: string, user: RequestUser) {
    this.assertCanUse(user);
    const automation = await this.prisma.intentAutomation.findUnique({ where: { id } });
    if (!automation) throw new NotFoundException("Automation not found");
    if (automation.createdById !== user.id && user.role.name !== RoleName.ADMIN) {
      throw new ForbiddenException("You can only manage your own automations");
    }
    return automation;
  }

  private async getManageableOutreach(id: string, user: RequestUser) {
    this.assertCanUse(user);
    const row = await this.prisma.intentAutomationOutreach.findUnique({
      where: { id },
      include: { automation: { select: { createdById: true } } },
    });
    if (!row) throw new NotFoundException("Email not found");
    if (row.automation.createdById !== user.id && user.role.name !== RoleName.ADMIN) {
      throw new ForbiddenException("You can only manage your own automations");
    }
    return row;
  }
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}
