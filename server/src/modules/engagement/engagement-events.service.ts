import { ForbiddenException, Injectable } from "@nestjs/common";
import { EngagementEventType, Prisma, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { EngagementScoreService } from "./engagement-score.service";
import { NotificationsService } from "../notifications/notifications.service";
import { NotificationsGateway } from "../notifications/notifications.gateway";
import { canUseSalesOrRecruitment } from "../../common/utils/sales-access";
import type { RequestUser } from "../../common/types/request-user.type";

export interface EngagementEventFilters {
  contactId?: string;
  dealId?: string;
  campaignId?: string;
  sequenceId?: string;
  recipientId?: string;
  take?: number;
}

// Lead-scoring point table from the Engagement Intelligence spec. Event
// types with no entry here (DEAL_CREATED, TASK_COMPLETED, SEQUENCE_*,
// FOLLOWUP_*, CALL_LOGGED) still get an EngagementEvent row for the
// activity feed/audit trail -- they just don't move the score, which the
// spec's own point table never claimed they should.
const SCORE_TABLE: Partial<Record<EngagementEventType, number>> = {
  EMAIL_SENT: 1,
  EMAIL_OPENED: 10,
  EMAIL_CLICKED: 15,
  EMAIL_REPLIED: 30,
  MEETING_BOOKED: 50,
};

export interface RecordEngagementEventInput {
  type: EngagementEventType;
  contactId?: string | null;
  dealId?: string | null;
  campaignId?: string | null;
  sequenceId?: string | null;
  recipientId?: string | null;
  ownerId?: string | null;
  departmentId?: string | null;
  metadata?: Prisma.InputJsonValue;
  // Only call sites that actually want an in-app notification pass this --
  // most emitters (Deals, Tasks, Activities) already notify through their
  // own existing logic, so record() itself never notifies unprompted.
  notify?: { title: string; message: string; link?: string };
}

@Injectable()
export class EngagementEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly score: EngagementScoreService,
    private readonly notifications: NotificationsService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async record(input: RecordEngagementEventInput) {
    const event = await this.prisma.engagementEvent.create({
      data: {
        type: input.type,
        contactId: input.contactId ?? undefined,
        dealId: input.dealId ?? undefined,
        campaignId: input.campaignId ?? undefined,
        sequenceId: input.sequenceId ?? undefined,
        recipientId: input.recipientId ?? undefined,
        ownerId: input.ownerId ?? undefined,
        departmentId: input.departmentId ?? undefined,
        metadata: input.metadata,
      },
    });

    // Engagement Center's live activity feed -- pushed to the event's
    // owner, their department, and every Admin (see broadcastEngagementEvent's
    // doc comment). Independent of the `notify` in-app Notification below,
    // which is a personal "you have a message" ping, not a feed item.
    this.gateway.broadcastEngagementEvent(event);

    if (input.contactId) {
      const delta = this.scoreDelta(input);
      if (delta) {
        await this.score.applyDelta(input.contactId, delta);
      }
    }

    if (input.notify && input.ownerId) {
      await this.notifications.create({
        userId: input.ownerId,
        type: this.notificationType(input.type),
        title: input.notify.title,
        message: input.notify.message,
        link: input.notify.link,
      });
    }

    // The moment a tracked email is first opened, schedule a same-shape
    // follow-up nudge 24h out -- FollowUpAutomationService's cron (Phase 2)
    // picks these up once due. Recorded here, not in a separate listener:
    // this codebase has no event-bus/pub-sub anywhere, so a direct call is
    // the established pattern (see CLAUDE.md-adjacent conventions -- every
    // other cross-module effect in this app is a direct service call).
    if (input.type === "EMAIL_OPENED" && input.contactId && input.ownerId) {
      const dueAt = new Date(event.occurredAt.getTime() + 24 * 60 * 60 * 1000);
      await this.prisma.followUpTask.create({
        data: {
          engagementId: event.id,
          contactId: input.contactId,
          recipientId: input.recipientId ?? undefined,
          campaignId: input.campaignId ?? undefined,
          sequenceId: input.sequenceId ?? undefined,
          dueAt,
          assignedTo: input.ownerId,
        },
      });
      await this.record({
        type: "FOLLOWUP_SCHEDULED",
        contactId: input.contactId,
        campaignId: input.campaignId,
        sequenceId: input.sequenceId,
        recipientId: input.recipientId,
        ownerId: input.ownerId,
        departmentId: input.departmentId,
      });
    }

    return event;
  }

  // Filterable feed for a contact/deal/campaign/sequence detail view, or the
  // Engagement Center's global activity feed when called with no filters.
  // Same visibilityScope shape as DealsService -- non-Admins only see their
  // own department's events (plus legacy/unscoped rows).
  findAll(filters: EngagementEventFilters, user: RequestUser) {
    return this.prisma.engagementEvent.findMany({
      where: {
        contactId: filters.contactId,
        dealId: filters.dealId,
        campaignId: filters.campaignId,
        sequenceId: filters.sequenceId,
        recipientId: filters.recipientId,
        ...this.visibilityScope(user),
      },
      // Display names for the Engagement Center's activity feed -- kept off
      // the bare row `record()` creates (and the socket broadcast payload,
      // which is that same bare row) since most emitters never read this
      // back; the feed re-fetches through here after a socket-triggered
      // invalidation, so it always sees the enriched shape.
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
        campaign: { select: { id: true, name: true } },
        sequence: { select: { id: true, name: true } },
        owner: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { occurredAt: "desc" },
      take: filters.take ?? 50,
    });
  }

  // campaignId/sequenceId aren't scoped by department the way EngagementEvent
  // rows are (campaigns/sequences are shared Sales-team resources -- see
  // BulkEmailCampaign's doc comment), so the relevant gate here is the same
  // Sales-outreach role/department check every other campaign/sequence
  // endpoint enforces (BulkEmailService/SequencesService's assertCanUse),
  // not visibilityScope().
  private assertCanViewOutreachMetrics(user: RequestUser) {
    if (!canUseSalesOrRecruitment(user)) {
      throw new ForbiddenException("You don't have access to outreach metrics");
    }
  }

  async getCampaignMetrics(campaignId: string, user: RequestUser) {
    this.assertCanViewOutreachMetrics(user);
    // "sent"/"delivered" both come from BulkEmailRecipient.status (not the
    // EMAIL_SENT EngagementEvent count) -- that event is only recorded when
    // the recipient has a linked CRM contactId, which raw/pasted-email
    // recipients never do, so it undercounts "sent" and can otherwise show
    // delivered > sent for campaigns with unlinked recipients.
    const [attempted, delivered, opened, clicked, replied, followUpsCount] = await Promise.all([
      this.prisma.bulkEmailRecipient.count({
        where: { campaignId, status: { in: ["SENT", "FAILED"] } },
      }),
      this.prisma.bulkEmailRecipient.count({ where: { campaignId, status: "SENT" } }),
      this.prisma.engagementEvent.count({ where: { campaignId, type: "EMAIL_OPENED" } }),
      this.prisma.engagementEvent.count({ where: { campaignId, type: "EMAIL_CLICKED" } }),
      this.prisma.engagementEvent.count({ where: { campaignId, type: "EMAIL_REPLIED" } }),
      this.prisma.followUpTask.count({ where: { campaignId } }),
    ]);

    const deliveryTotal = Math.max(delivered, 1);
    return {
      sent: attempted,
      delivered,
      opened,
      openRate: Math.round((opened / deliveryTotal) * 1000) / 10,
      clicked,
      clickRate: Math.round((clicked / deliveryTotal) * 1000) / 10,
      replied,
      replyRate: Math.round((replied / deliveryTotal) * 1000) / 10,
      followUpsGenerated: followUpsCount,
    };
  }

  async getSequenceMetrics(sequenceId: string, user: RequestUser) {
    this.assertCanViewOutreachMetrics(user);
    const [attempted, delivered, opened, clicked, replied, followUpsCount] = await Promise.all([
      this.prisma.sequenceSend.count({
        where: { enrollment: { sequenceId }, status: { in: ["SENT", "FAILED"] } },
      }),
      this.prisma.sequenceSend.count({ where: { enrollment: { sequenceId }, status: "SENT" } }),
      this.prisma.engagementEvent.count({ where: { sequenceId, type: "EMAIL_OPENED" } }),
      this.prisma.engagementEvent.count({ where: { sequenceId, type: "EMAIL_CLICKED" } }),
      this.prisma.engagementEvent.count({ where: { sequenceId, type: "EMAIL_REPLIED" } }),
      this.prisma.followUpTask.count({ where: { sequenceId } }),
    ]);

    const deliveryTotal = Math.max(delivered, 1);
    return {
      sent: attempted,
      delivered,
      opened,
      openRate: Math.round((opened / deliveryTotal) * 1000) / 10,
      clicked,
      clickRate: Math.round((clicked / deliveryTotal) * 1000) / 10,
      replied,
      replyRate: Math.round((replied / deliveryTotal) * 1000) / 10,
      followUpsGenerated: followUpsCount,
    };
  }

  // Engagement Center header metrics. "Today" is local-midnight-to-now;
  // "this week" is a trailing 7 days rather than calendar-week-since-Monday
  // -- avoids timezone/locale edge cases for a stat strip where "last 7
  // days" serves the same purpose. Hot/Warm/Cold/Sales-Ready counts are
  // global (not scoped by department/owner): Contact has no owner or
  // department field anywhere else in this schema (it's a shared team
  // resource -- see BulkEmailService's own comment to that effect), so
  // there's nothing meaningful to scope lead-temperature counts by.
  async getMetrics(user: RequestUser) {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const scope = this.visibilityScope(user);
    const followUpScope = this.followUpVisibilityScope(user);

    const [emailsSent, emailsOpened, emailsClicked, meetingsGenerated, totalEngagementsWeek] =
      await Promise.all([
        this.prisma.engagementEvent.count({
          where: { type: "EMAIL_SENT", occurredAt: { gte: startOfToday }, ...scope },
        }),
        this.prisma.engagementEvent.count({
          where: { type: "EMAIL_OPENED", occurredAt: { gte: startOfToday }, ...scope },
        }),
        this.prisma.engagementEvent.count({
          where: { type: "EMAIL_CLICKED", occurredAt: { gte: startOfToday }, ...scope },
        }),
        this.prisma.engagementEvent.count({
          where: { type: "MEETING_BOOKED", occurredAt: { gte: startOfToday }, ...scope },
        }),
        this.prisma.engagementEvent.count({
          where: { occurredAt: { gte: sevenDaysAgo }, ...scope },
        }),
      ]);

    const [followUpsDue, followUpsSent] = await Promise.all([
      this.prisma.followUpTask.count({
        where: { status: "PENDING", dueAt: { lte: now }, ...followUpScope },
      }),
      this.prisma.followUpTask.count({
        where: { status: "SENT", sentAt: { gte: startOfToday }, ...followUpScope },
      }),
    ]);

    const [hotLeads, warmLeads, coldLeads, salesReadyLeads] = await Promise.all([
      this.prisma.contact.count({ where: { engagementTier: "HOT" } }),
      this.prisma.contact.count({ where: { engagementTier: "WARM" } }),
      this.prisma.contact.count({ where: { engagementTier: "COLD" } }),
      this.prisma.contact.count({ where: { engagementTier: "SALES_READY" } }),
    ]);

    return {
      today: {
        emailsSent,
        emailsOpened,
        openRate: emailsSent ? Math.round((emailsOpened / emailsSent) * 100) : 0,
        clickRate: emailsSent ? Math.round((emailsClicked / emailsSent) * 100) : 0,
        followUpsDue,
        followUpsSent,
        meetingsGenerated,
      },
      thisWeek: { totalEngagements: totalEngagementsWeek, hotLeads, warmLeads, coldLeads, salesReadyLeads },
    };
  }

  // Same three-tier shape as FollowUpTasksService.visibilityScope -- kept
  // duplicated rather than imported to avoid a cross-service dependency for
  // one scoping clause; both read the identical assignee.departmentId
  // relation filter.
  private followUpVisibilityScope(user: RequestUser) {
    if (user.role.name === RoleName.ADMIN) {
      return {};
    }
    if (user.role.name === RoleName.MANAGER && user.department?.id) {
      return { assignee: { departmentId: user.department.id } };
    }
    return { assignedTo: user.id };
  }

  private visibilityScope(user: RequestUser) {
    if (user.role.name === RoleName.ADMIN) {
      return {};
    }
    return { OR: [{ departmentId: null }, { departmentId: user.department?.id }] };
  }

  // Deal-won is the spec's "+100" line item, but it's conditional on the
  // stage actually landing on WON -- every other stage transition is
  // tracked (for the timeline) without moving the score.
  private scoreDelta(input: RecordEngagementEventInput): number {
    if (input.type === "DEAL_STAGE_CHANGED") {
      const toStage = (input.metadata as { toStage?: string } | undefined)?.toStage;
      return toStage === "WON" ? 100 : 0;
    }
    return SCORE_TABLE[input.type] ?? 0;
  }

  private notificationType(type: EngagementEventType): "EMAIL_OPENED" | "EMAIL_CLICKED" | "GENERAL" {
    if (type === "EMAIL_OPENED") return "EMAIL_OPENED";
    if (type === "EMAIL_CLICKED") return "EMAIL_CLICKED";
    return "GENERAL";
  }
}
