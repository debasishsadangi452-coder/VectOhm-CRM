import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { FollowUpMode, FollowUpTaskStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { FollowUpTasksService, taskInclude, type TaskWithRelations } from "./follow-up-tasks.service";

// Same batching/cadence conventions as the other engines: capped batch per
// tick (bulk-email-engine.service.ts's BATCH_SIZE), per-row try/catch so one
// bad task never blocks the rest (deal-follow-ups.service.ts's runOnce()).
// 30 minutes, not 5 -- this is a nag/draft/send check, not a live send
// queue, and Manual/Assisted modes only need to notify once per task
// (guarded by notifiedAt) so a shorter interval wouldn't change behavior,
// only add load.
const BATCH_SIZE = 50;

@Injectable()
export class FollowUpAutomationService {
  private readonly logger = new Logger(FollowUpAutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly tasks: FollowUpTasksService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleCron() {
    await this.runOnce();
  }

  // Also callable directly (Admin-triggered "run now" endpoint) so a
  // scheduled follow-up can be verified without waiting up to 30 minutes.
  async runOnce(): Promise<{ processed: number }> {
    const due = await this.prisma.followUpTask.findMany({
      where: { status: FollowUpTaskStatus.PENDING, dueAt: { lte: new Date() } },
      include: taskInclude,
      orderBy: { dueAt: "asc" },
      take: BATCH_SIZE,
    });

    for (const task of due) {
      try {
        await this.processTask(task);
      } catch (err) {
        this.logger.error(
          `FollowUpTask ${task.id} threw during processing: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return { processed: due.length };
  }

  private async processTask(task: TaskWithRelations) {
    const mode = task.campaign?.followUpMode ?? task.sequence?.followUpMode ?? FollowUpMode.MANUAL;

    if (mode === FollowUpMode.AUTOMATED) {
      // No notifiedAt guard here -- Automated sends outright rather than
      // waiting on a review step, so there's nothing to dedupe against; the
      // task leaves PENDING (and stops matching this query) the moment it
      // sends.
      const draft = await this.tasks.buildDraft(task);
      await this.tasks.deliver(task, draft.subject, draft.body, task.assignedTo);
      return;
    }

    // Manual and Assisted both only act once per task -- re-notifying every
    // 30 minutes while a rep hasn't yet reviewed it would be noise, not help.
    if (task.notifiedAt) {
      return;
    }

    const contactName = `${task.contact.firstName} ${task.contact.lastName}`;

    if (mode === FollowUpMode.ASSISTED) {
      const draft = await this.tasks.buildDraft(task);
      await this.prisma.followUpTask.update({
        where: { id: task.id },
        data: { aiDraftSubject: draft.subject, aiDraftBody: draft.body, notifiedAt: new Date() },
      });
      await this.notifications.create({
        userId: task.assignedTo,
        type: "EMAIL_FOLLOWUP_DUE",
        title: "Follow-up draft ready",
        message: `${contactName} opened your email. An AI-drafted follow-up is ready to review and send.`,
        link: "/engagement",
      });
      return;
    }

    // MANUAL
    await this.prisma.followUpTask.update({
      where: { id: task.id },
      data: { notifiedAt: new Date() },
    });
    await this.notifications.create({
      userId: task.assignedTo,
      type: "EMAIL_FOLLOWUP_DUE",
      title: "Follow-up due",
      message: `${contactName} opened your email. Follow up within 24 hours.`,
      link: "/engagement",
    });
  }
}
