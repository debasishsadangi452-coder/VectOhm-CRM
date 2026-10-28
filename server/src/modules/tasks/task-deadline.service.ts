import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { NotificationType, Prisma, RoleName, TaskMessageType, TaskStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { collectAssigneeIds, formatDeadline, formatSpan } from "./task-deadline.util";

// How far ahead of the deadline the assignee gets a "due soon" heads-up.
export const DUE_SOON_WINDOW_MS = 60 * 60 * 1000;

const personSelect = { id: true, firstName: true, lastName: true, departmentId: true } as const;

const deadlineInclude = {
  assignee: { select: personSelect },
  assignees: { select: { userId: true, user: { select: personSelect } } },
  creator: { select: { ...personSelect, role: { select: { name: true } } } },
  project: { select: { id: true, name: true, departmentId: true } },
  department: { select: { id: true, name: true } },
} satisfies Prisma.TaskInclude;

type DeadlineTask = Prisma.TaskGetPayload<{ include: typeof deadlineInclude }>;

@Injectable()
export class TaskDeadlineService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TaskDeadlineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  onApplicationBootstrap() {
    this.logger.log("TaskDeadlineService initialized - running initial deadline checks...");
    this.checkOverdueTasks().catch((err) => this.logger.error("Initial overdue check failed", err));
    this.checkDueSoonTasks().catch((err) => this.logger.error("Initial due-soon check failed", err));
  }

  // ─── Overdue ──────────────────────────────────────────────────────────────

  /**
   * Tasks past their deadline and not DONE. Tells the assignee(s) their task is
   * overdue, tells Admins / reviewer / creator / department managers that the
   * assignee missed it, and adds a system message to the task thread. Fires once
   * per deadline: moving the due date later re-arms it (see TasksService.update).
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkOverdueTasks() {
    try {
      const now = new Date();

      const overdueTasks = await this.prisma.task.findMany({
        where: { dueDate: { not: null, lt: now }, status: { not: TaskStatus.DONE } },
        include: deadlineInclude,
      });

      const tasksToNotify = overdueTasks.filter((task) => {
        if (!task.dueDate) return false;
        if (!task.overdueNotifiedAt) return true;
        return new Date(task.overdueNotifiedAt).getTime() < new Date(task.dueDate).getTime();
      });

      if (tasksToNotify.length === 0) return;

      this.logger.log(`Found ${tasksToNotify.length} overdue tasks requiring notifications`);

      const admins = await this.prisma.user.findMany({
        where: { role: { name: RoleName.ADMIN }, isActive: true },
        select: { id: true },
      });

      for (const task of tasksToNotify) {
        try {
          await this.notifyOverdue(task, admins, now);
        } catch (taskErr) {
          this.logger.error(`Failed to process overdue notification for task ${task.id}:`, taskErr);
        }
      }
    } catch (err) {
      this.logger.error("Error running overdue task check cron:", err);
    }
  }

  private async notifyOverdue(task: DeadlineTask, admins: { id: string }[], now: Date) {
    const dueDate = task.dueDate as Date;
    const assigneeIds = collectAssigneeIds(task);

    const nameById = new Map<string, string>();
    if (task.assignee) nameById.set(task.assignee.id, `${task.assignee.firstName} ${task.assignee.lastName}`);
    for (const a of task.assignees ?? []) {
      if (a.user) nameById.set(a.userId, `${a.user.firstName} ${a.user.lastName}`);
    }
    const assigneeNames = assigneeIds.map((id) => nameById.get(id)).filter(Boolean) as string[];
    const who = assigneeNames.length ? assigneeNames.join(", ") : "Assigned employee";
    const dueStr = formatDeadline(dueDate);
    const lateBy = formatSpan(now.getTime() - dueDate.getTime());

    // Thread record: one system message per assignee so each of them sees it in
    // their own view of the conversation; one open-ended message if unassigned.
    const threadText = `⚠️ Task Deadline Missed: ${who} has not completed "${task.title}" within the deadline (${dueStr}). Status: ${task.status}.`;
    for (const recipientId of assigneeIds.length ? assigneeIds : [null]) {
      await this.prisma.taskMessage.create({
        data: {
          taskId: task.id,
          senderId: null,
          recipientId,
          message: threadText,
          messageType: TaskMessageType.OVERDUE_MESSAGE,
        },
      });
    }

    const link = `/tasks?taskId=${task.id}&modal=communication`;

    // 1. The assignees -- told directly, in their own words.
    for (const userId of assigneeIds) {
      await this.safeNotify({
        userId,
        type: NotificationType.TASK_OVERDUE,
        title: "⚠️ Your task is overdue",
        message: `"${task.title}" was due ${dueStr} (${lateBy} ago) and isn't completed yet. Please finish it or post an update.`,
        link,
      });
    }

    // 2. Oversight: Admins, reviewer, a Manager/Admin creator, and the managers of
    //    every department involved (task, project, creator, each assignee).
    const oversight = new Set<string>(admins.map((a) => a.id));
    if (task.testerId) oversight.add(task.testerId);
    if (task.creator && (task.creator.role.name === RoleName.MANAGER || task.creator.role.name === RoleName.ADMIN)) {
      oversight.add(task.creator.id);
    }

    const deptIds = new Set<string>();
    if (task.departmentId) deptIds.add(task.departmentId);
    if (task.project?.departmentId) deptIds.add(task.project.departmentId);
    if (task.creator?.departmentId) deptIds.add(task.creator.departmentId);
    if (task.assignee?.departmentId) deptIds.add(task.assignee.departmentId);
    for (const a of task.assignees ?? []) {
      if (a.user?.departmentId) deptIds.add(a.user.departmentId);
    }
    if (deptIds.size > 0) {
      const managers = await this.prisma.user.findMany({
        where: { departmentId: { in: Array.from(deptIds) }, role: { name: RoleName.MANAGER }, isActive: true },
        select: { id: true },
      });
      for (const m of managers) oversight.add(m.id);
    }

    // Someone who is both an assignee and a manager already got the direct message.
    for (const id of assigneeIds) oversight.delete(id);

    for (const userId of oversight) {
      await this.safeNotify({
        userId,
        type: NotificationType.TASK_OVERDUE,
        title: "⚠️ Task Deadline Missed",
        message: `${who} has not completed the task "${task.title}" within the assigned deadline (due ${dueStr}, ${lateBy} ago).`,
        link,
      });
    }

    // Mark done only after the notifications went out, so a crash mid-way
    // retries on the next tick instead of silently dropping the alert.
    await this.prisma.task.update({ where: { id: task.id }, data: { overdueNotifiedAt: now } });
  }

  // ─── Due soon ─────────────────────────────────────────────────────────────

  /**
   * Heads-up to the assignee(s) when a task's deadline is within the next hour
   * and it isn't done. Once per deadline value.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkDueSoonTasks() {
    try {
      const now = new Date();
      const horizon = new Date(now.getTime() + DUE_SOON_WINDOW_MS);

      const candidates = await this.prisma.task.findMany({
        where: { dueDate: { gt: now, lte: horizon }, status: { not: TaskStatus.DONE } },
        include: deadlineInclude,
      });

      for (const task of candidates) {
        try {
          const dueDate = task.dueDate as Date;
          if (task.dueSoonNotifiedFor && task.dueSoonNotifiedFor.getTime() === dueDate.getTime()) continue;

          const assigneeIds = collectAssigneeIds(task);
          if (assigneeIds.length === 0) continue; // nobody to remind

          const remaining = formatSpan(dueDate.getTime() - now.getTime());
          for (const userId of assigneeIds) {
            await this.safeNotify({
              userId,
              type: NotificationType.TASK_DUE_SOON,
              title: "⏰ Task due soon",
              message: `"${task.title}" is due in ${remaining} (${formatDeadline(dueDate)}).`,
              link: `/tasks?taskId=${task.id}&modal=communication`,
            });
          }
          await this.prisma.task.update({ where: { id: task.id }, data: { dueSoonNotifiedFor: dueDate } });
        } catch (taskErr) {
          this.logger.error(`Failed to process due-soon reminder for task ${task.id}:`, taskErr);
        }
      }
    } catch (err) {
      this.logger.error("Error running due-soon task check cron:", err);
    }
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  /** One failed notification must not stop the rest from going out. */
  private async safeNotify(input: Parameters<NotificationsService["create"]>[0]) {
    try {
      await this.notifications.create(input);
    } catch (err) {
      this.logger.error(`Failed to notify user ${input.userId}:`, err);
    }
  }
}
