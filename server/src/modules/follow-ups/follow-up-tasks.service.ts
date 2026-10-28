import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { FollowUpTaskStatus, RoleName, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { EngagementEventsService } from "../engagement/engagement-events.service";
import { EmailConnectionsService } from "../email-connections/email-connections.service";
import { EmailOAuthService } from "../email-oauth/email-oauth.service";
import { EmailSyncEngineService } from "../email-oauth/email-sync-engine.service";
import { EmailSuppressionService } from "../email-suppression/email-suppression.service";
import { FollowUpAiService, type FollowUpDraft } from "./follow-up-ai.service";
import { composeEmailHtml } from "../../common/utils/email-body";
import { renderMergeFields } from "../../common/utils/merge-fields";
import { sendEmail, sendFailureMessage } from "../../common/utils/mailer";
import type { RequestUser } from "../../common/types/request-user.type";

export const taskInclude = {
  contact: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      engagementScore: true,
      engagementTier: true,
      company: { select: { name: true } },
    },
  },
  assignee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      emailSignatureHtml: true,
      departmentId: true,
    },
  },
  campaign: {
    select: {
      id: true,
      name: true,
      followUpMode: true,
      subject: true,
      template: { select: { subject: true } },
    },
  },
  sequence: { select: { id: true, name: true, followUpMode: true } },
} as const;

export type TaskWithRelations = Prisma.FollowUpTaskGetPayload<{ include: typeof taskInclude }>;

@Injectable()
export class FollowUpTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engagementEvents: EngagementEventsService,
    private readonly emailConnections: EmailConnectionsService,
    private readonly emailOAuth: EmailOAuthService,
    private readonly suppression: EmailSuppressionService,
    private readonly ai: FollowUpAiService,
    @Optional() private readonly emailSyncEngine?: EmailSyncEngineService,
  ) {}

  findAll(filters: { status?: FollowUpTaskStatus }, user: RequestUser) {
    return this.prisma.followUpTask.findMany({
      where: {
        status: filters.status,
        ...this.visibilityScope(user),
      },
      include: taskInclude,
      orderBy: { dueAt: "asc" },
    });
  }

  // Same three-tier shape as DealsService.visibilityScope, extended one
  // level further since a FollowUpTask's owner is `assignee`, not a direct
  // departmentId column: Admin sees all, Manager sees their department's
  // assignees, Employee sees only their own queue.
  private visibilityScope(user: RequestUser) {
    if (user.role.name === RoleName.ADMIN) {
      return {};
    }
    if (user.role.name === RoleName.MANAGER && user.department?.id) {
      return { assignee: { departmentId: user.department.id } };
    }
    return { assignedTo: user.id };
  }

  async generateDraft(id: string, user: RequestUser): Promise<FollowUpDraft> {
    const task = await this.getOwned(id);
    this.assertCanAccess(task, user);

    const draft = await this.buildDraft(task);
    await this.prisma.followUpTask.update({
      where: { id },
      data: { aiDraftSubject: draft.subject, aiDraftBody: draft.body },
    });
    return draft;
  }

  async dismiss(id: string, user: RequestUser) {
    const task = await this.getOwned(id);
    this.assertCanAccess(task, user);
    if (task.status !== FollowUpTaskStatus.PENDING) {
      throw new BadRequestException("Only a pending follow-up can be dismissed");
    }

    const updated = await this.prisma.followUpTask.update({
      where: { id },
      data: { status: FollowUpTaskStatus.DISMISSED, dismissedAt: new Date() },
      include: taskInclude,
    });

    await this.engagementEvents.record({
      type: "FOLLOWUP_DISMISSED",
      contactId: task.contactId,
      campaignId: task.campaignId,
      sequenceId: task.sequenceId,
      recipientId: task.recipientId,
      ownerId: task.assignedTo,
    });

    return updated;
  }

  // User-initiated send (Manual "create + send", or Assisted approval) --
  // takes the caller's own subject/body, which may differ from the stored
  // aiDraft* columns since the rep is free to edit before sending. The
  // automation cron's Automated-mode path calls sendGenerated() below
  // instead, which always uses a freshly generated draft.
  async send(id: string, dto: { subject: string; body: string }, user: RequestUser) {
    const task = await this.getOwned(id);
    this.assertCanAccess(task, user);
    if (task.status !== FollowUpTaskStatus.PENDING) {
      throw new BadRequestException("This follow-up has already been actioned");
    }
    await this.deliver(task, dto.subject, dto.body, task.assignedTo);
    return this.prisma.followUpTask.findUnique({ where: { id }, include: taskInclude });
  }

  // Called by FollowUpAutomationService for Assisted (after generating a
  // draft, before the rep reviews) and Automated (generate-then-send in one
  // step) modes -- both need the same "build a draft from this task's
  // context" logic that generateDraft() above exposes for the manual path.
  async buildDraft(task: TaskWithRelations): Promise<FollowUpDraft> {
    const recipientStats = await this.resolveRecipientStats(task.recipientId);
    // Template subjects carry {{firstName}}-style merge fields -- render
    // them the same way the send engines do, or the AI prompt (and a Manual
    // rep's draft preview) would show the raw placeholder instead of the
    // actual subject line the contact received.
    const rawSubject = task.campaign?.template?.subject ?? task.campaign?.subject ?? null;
    const originalSubject = rawSubject
      ? renderMergeFields(rawSubject, {
          firstName: task.contact.firstName,
          lastName: task.contact.lastName,
          title: null,
          companyName: task.contact.company?.name ?? null,
        })
      : null;
    return this.ai.generateDraft({
      contactFirstName: task.contact.firstName,
      contactLastName: task.contact.lastName,
      companyName: task.contact.company?.name ?? null,
      sourceName: task.campaign?.name ?? task.sequence?.name ?? null,
      originalSubject,
      openCount: recipientStats.openCount,
      clickCount: recipientStats.clickCount,
      engagementScore: task.contact.engagementScore,
      senderFirstName: task.assignee.firstName,
    });
  }

  // Actually deliver a follow-up email and record the outcome. Shared by
  // send() above (manual/assisted) and FollowUpAutomationService (Automated
  // mode) so there's exactly one place that knows how to send a follow-up.
  async deliver(task: TaskWithRelations, subject: string, body: string, senderId: string) {
    if (!task.contact.email) {
      throw new BadRequestException("Contact has no email address");
    }
    if (await this.suppression.isSuppressed(task.contact.email)) {
      throw new BadRequestException("This contact's email address is suppressed");
    }

    const html = composeEmailHtml(body, task.assignee.emailSignatureHtml);
    const sendable = await this.emailConnections.requireSendable(senderId);
    if (sendable.mode === "smtp") {
      await sendable.transporter.sendMail({ from: sendable.from, to: task.contact.email, subject, html });
    } else if (sendable.mode === "oauth") {
      await this.emailOAuth.sendMail(sendable.provider, sendable.accessToken, {
        to: task.contact.email,
        subject,
        html,
        from: sendable.from,
      });
    } else {
      const result = await sendEmail({ to: task.contact.email, subject, html, replyTo: sendable.replyTo });
      if (!result.delivered) {
        throw new Error(sendFailureMessage(result));
      }
    }

    await this.prisma.followUpTask.update({
      where: { id: task.id },
      data: { status: FollowUpTaskStatus.SENT, sentAt: new Date() },
    });

    if (this.emailSyncEngine) {
      const fromAddress = "from" in sendable ? sendable.from : sendable.replyTo;
      await this.emailSyncEngine.recordSentEmail({
        userId: senderId,
        fromAddress,
        toAddresses: [task.contact.email],
        subject,
        bodyHtml: html,
        contactId: task.contactId,
      }).catch(() => undefined);
    }

    await this.engagementEvents.record({
      type: "FOLLOWUP_SENT",
      contactId: task.contactId,
      campaignId: task.campaignId,
      sequenceId: task.sequenceId,
      recipientId: task.recipientId,
      ownerId: task.assignedTo,
    });
    await this.engagementEvents.record({
      type: "EMAIL_SENT",
      contactId: task.contactId,
      campaignId: task.campaignId,
      sequenceId: task.sequenceId,
      recipientId: task.recipientId,
      ownerId: task.assignedTo,
    });
  }

  // A FollowUpTask's recipientId is a plain string pointing at either a
  // BulkEmailRecipient or SequenceSend row (the two source tables, no FK --
  // see the field's schema.prisma comment), so open/click counts for the AI
  // prompt need trying both. Falls back to zeros if the source row was since
  // deleted or the task has no recipientId at all.
  private async resolveRecipientStats(
    recipientId: string | null,
  ): Promise<{ openCount: number; clickCount: number }> {
    if (!recipientId) {
      return { openCount: 0, clickCount: 0 };
    }
    const bulkRecipient = await this.prisma.bulkEmailRecipient.findUnique({
      where: { id: recipientId },
      select: { openCount: true, clickCount: true },
    });
    if (bulkRecipient) {
      return bulkRecipient;
    }
    const send = await this.prisma.sequenceSend.findUnique({
      where: { id: recipientId },
      select: { openCount: true, clickCount: true },
    });
    return send ?? { openCount: 0, clickCount: 0 };
  }

  private async getOwned(id: string) {
    const task = await this.prisma.followUpTask.findUnique({ where: { id }, include: taskInclude });
    if (!task) {
      throw new NotFoundException("Follow-up task not found");
    }
    return task;
  }

  private assertCanAccess(
    task: { assignedTo: string; assignee: { departmentId: string | null } },
    user: RequestUser,
  ) {
    if (user.role.name === RoleName.ADMIN) {
      return;
    }
    if (task.assignedTo === user.id) {
      return;
    }
    const isDeptManager =
      user.role.name === RoleName.MANAGER &&
      !!user.department?.id &&
      task.assignee.departmentId === user.department.id;
    if (!isDeptManager) {
      throw new ForbiddenException("You do not have permission to act on this follow-up");
    }
  }
}
