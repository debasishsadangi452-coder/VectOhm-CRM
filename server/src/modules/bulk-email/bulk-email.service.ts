import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { BulkSendStatus, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateBulkEmailDto } from "./dto/create-bulk-email.dto";
import { canUseSalesOrRecruitment } from "../../common/utils/sales-access";
import { followUpColdSince } from "../../common/utils/follow-up";
import { EmailConnectionsService } from "../email-connections/email-connections.service";
import type { RequestUser } from "../../common/types/request-user.type";
import { templateVisibleTo } from "../email-templates/template-visibility";

const campaignInclude = {
  template: { select: { id: true, name: true, subject: true, bodyHtml: true } },
  creator: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  emailConnection: {
    select: {
      id: true,
      fromName: true,
      fromEmail: true,
      connectionType: true,
      providerAccountEmail: true,
      smtpUsername: true,
    },
  },
  _count: { select: { recipients: true } },
} as const;

const recipientInclude = {
  contact: { select: { id: true, firstName: true, lastName: true } },
} as const;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class BulkEmailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailConnections: EmailConnectionsService,
  ) {}

  async findAll(user: RequestUser) {
    this.assertCanUse(user);
    const campaigns = await this.prisma.bulkEmailCampaign.findMany({
      include: campaignInclude,
      orderBy: { createdAt: "desc" },
    });

    const counts = await this.prisma.bulkEmailRecipient.groupBy({
      by: ["campaignId", "status"],
      where: { campaignId: { in: campaigns.map((c) => c.id) } },
      _count: true,
    });
    const countsByCampaign = new Map<string, Record<string, number>>();
    for (const row of counts) {
      const existing = countsByCampaign.get(row.campaignId) ?? {};
      existing[row.status] = row._count;
      countsByCampaign.set(row.campaignId, existing);
    }

    return campaigns.map((c) => ({
      ...c,
      statusCounts: countsByCampaign.get(c.id) ?? {},
    }));
  }

  async findOne(id: string, user: RequestUser) {
    this.assertCanUse(user);
    const campaign = await this.prisma.bulkEmailCampaign.findUnique({
      where: { id },
      include: {
        ...campaignInclude,
        recipients: { include: recipientInclude, orderBy: { createdAt: "asc" } },
      },
    });
    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }
    const statusCounts: Record<string, number> = {};
    for (const r of campaign.recipients) {
      statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
    }
    return {
      ...campaign,
      statusCounts,
    };
  }

  async remove(id: string, user: RequestUser) {
    this.assertCanUse(user);
    const campaign = await this.prisma.bulkEmailCampaign.findUnique({
      where: { id },
      select: { id: true, creatorId: true },
    });
    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }
    if (user.role.name === RoleName.EMPLOYEE && campaign.creatorId !== user.id) {
      throw new ForbiddenException("You can only delete your own campaigns");
    }
    return this.prisma.bulkEmailCampaign.delete({
      where: { id },
    });
  }

  async retryFailed(id: string, user: RequestUser) {
    this.assertCanUse(user);
    const campaign = await this.prisma.bulkEmailCampaign.findUnique({
      where: { id },
      select: { id: true, creatorId: true },
    });
    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }
    if (user.role.name === RoleName.EMPLOYEE && campaign.creatorId !== user.id) {
      throw new ForbiddenException("You can only retry your own campaigns");
    }
    const updated = await this.prisma.bulkEmailRecipient.updateMany({
      where: { campaignId: id, status: BulkSendStatus.FAILED },
      data: { status: BulkSendStatus.PENDING, errorMessage: null },
    });
    return { count: updated.count };
  }

  async cancelPending(id: string, user: RequestUser) {
    this.assertCanUse(user);
    const campaign = await this.prisma.bulkEmailCampaign.findUnique({
      where: { id },
      select: { id: true, creatorId: true },
    });
    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }
    if (user.role.name === RoleName.EMPLOYEE && campaign.creatorId !== user.id) {
      throw new ForbiddenException("You can only cancel your own campaigns");
    }
    const updated = await this.prisma.bulkEmailRecipient.updateMany({
      where: { campaignId: id, status: BulkSendStatus.PENDING },
      data: { status: BulkSendStatus.SKIPPED, errorMessage: "Canceled by user" },
    });
    return { count: updated.count };
  }

  // Resolves contactIds + rawEmails into a deduped recipient set (by
  // lowercased email) and creates the campaign + PENDING recipient rows in
  // one go. The engine (bulk-email-engine.service.ts) picks them up from
  // there -- this method never sends anything itself.
  async create(dto: CreateBulkEmailDto, user: RequestUser) {
    this.assertCanUse(user);
    await this.assertSenderConnected(user, dto.emailConnectionId);

    const content = await this.resolveContent(dto, user);

    const recipients = new Map<string, { email: string; contactId: string | null }>();

    if (dto.contactIds && dto.contactIds.length > 0) {
      const contacts = await this.prisma.contact.findMany({
        where: { id: { in: dto.contactIds } },
        select: { id: true, email: true },
      });
      for (const contact of contacts) {
        if (!contact.email) continue;
        recipients.set(normalizeEmail(contact.email), {
          email: normalizeEmail(contact.email),
          contactId: contact.id,
        });
      }
    }

    for (const raw of dto.rawEmails ?? []) {
      const email = normalizeEmail(raw);
      if (!recipients.has(email)) {
        recipients.set(email, { email, contactId: null });
      }
    }

    if (recipients.size === 0) {
      throw new BadRequestException(
        "No valid recipients -- selected contacts must have an email on file, or provide at least one raw email.",
      );
    }

    return this.prisma.bulkEmailCampaign.create({
      data: {
        name: dto.name,
        ...content,
        appendSignature: dto.appendSignature ?? false,
        aiPersonalize: dto.aiPersonalize ?? false,
        aiInstructions: dto.aiPersonalize ? dto.aiInstructions?.trim() || null : null,
        followUpMode: dto.followUpMode,
        emailConnectionId: dto.emailConnectionId ?? null,
        creatorId: user.id,
        recipients: {
          create: Array.from(recipients.values()).map((r) => ({
            email: r.email,
            contactId: r.contactId,
            status: BulkSendStatus.PENDING,
          })),
        },
      },
      include: campaignInclude,
    });
  }

  async findFollowUps(user: RequestUser) {
    this.assertCanUse(user);
    const coldDate = followUpColdSince();

    return this.prisma.bulkEmailRecipient.findMany({
      where: {
        status: BulkSendStatus.SENT,
        openCount: 0,
        sentAt: { lte: coldDate },
        contactId: { not: null },
        dismissedAt: null,
        campaign: user.role.name === RoleName.EMPLOYEE ? { creatorId: user.id } : undefined,
      },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { sentAt: "desc" },
    });
  }

  // Clears one item off the Follow-Up Reminders panel -- the rep followed up
  // some other way (a call, in person) and doesn't want the reminder
  // hanging around waiting for an email open that will never come. Same
  // visibility scoping as the read: an Employee can only dismiss their own
  // campaigns' recipients, Manager/Admin can dismiss anything they can see.
  async dismissFollowUp(id: string, user: RequestUser): Promise<void> {
    this.assertCanUse(user);
    const recipient = await this.prisma.bulkEmailRecipient.findUnique({
      where: { id },
      select: { campaign: { select: { creatorId: true } } },
    });
    if (!recipient) {
      throw new NotFoundException("Follow-up not found");
    }
    if (user.role.name === RoleName.EMPLOYEE && recipient.campaign.creatorId !== user.id) {
      throw new ForbiddenException("You can only dismiss your own follow-ups");
    }
    await this.prisma.bulkEmailRecipient.update({
      where: { id },
      data: { dismissedAt: new Date() },
    });
  }

  // Enforces the templateId-XOR-(subject+bodyHtml) rule the DTO can't, and
  // returns the exact column set to write. An inline email is stored on the
  // campaign itself rather than as a hidden EmailTemplate row, so writing a
  // one-off for twenty recipients never clutters the team's shared template
  // library.
  private async resolveContent(dto: CreateBulkEmailDto, user: RequestUser) {
    const hasInline = !!dto.subject || !!dto.bodyHtml;

    if (dto.templateId && hasInline) {
      throw new BadRequestException(
        "Choose either a saved template or a one-off email written here -- not both.",
      );
    }

    if (dto.templateId) {
      // Only a template this person can see (their own, or shared with them) may be sent.
      const template = await this.prisma.emailTemplate.findFirst({
        where: { id: dto.templateId, ...templateVisibleTo(user) },
        select: { id: true },
      });
      if (!template) {
        throw new BadRequestException("Email template not found");
      }
      return { templateId: dto.templateId, subject: null, bodyHtml: null };
    }

    if (!dto.subject || !dto.bodyHtml) {
      throw new BadRequestException(
        "Pick a saved template, or write this email's subject and body here.",
      );
    }
    return { templateId: null, subject: dto.subject, bodyHtml: dto.bodyHtml };
  }

  private assertCanUse(user: RequestUser) {
    if (!canUseSalesOrRecruitment(user)) {
      throw new ForbiddenException("Bulk email is only available to Sales and Recruitment departments");
    }
  }

  // Campaigns send from the creator's own mailbox (see EmailConnectionsService),
  // so there's no point creating one until that's actually connected and
  // verified -- fail fast here instead of silently queuing recipients that
  // the engine can never send. The shared HTTP stopgap also counts as
  // "ready to send" -- see EmailConnectionsService.requireSendable.
  private async assertSenderConnected(user: RequestUser, emailConnectionId?: string) {
    if (emailConnectionId) {
      const conn = await this.prisma.userEmailConnection.findFirst({
        where: { id: emailConnectionId, userId: user.id },
      });
      if (conn && conn.verified) return;
      if (conn && !conn.verified) {
        throw new BadRequestException("The selected email account is not verified yet. Please test or reconnect it.");
      }
    }
    const status = await this.emailConnections.getStatus(user);
    if (status.connected && status.verified) return;
    if (this.emailConnections.hasHttpFallback()) return;
    throw new BadRequestException(
      "Connect and verify your email account in your profile before sending a bulk campaign.",
    );
  }
}
