import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { RoleName, TimeLogStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateTimeLogDto } from "./dto/create-time-log.dto";
import { UpdateTimeLogDto } from "./dto/update-time-log.dto";
import type { RequestUser } from "../../common/types/request-user.type";
import { NotificationsService } from "../notifications/notifications.service";

const timeLogInclude = {
  user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  reviewedBy: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  task: { select: { id: true, title: true, project: { select: { id: true, name: true } } } },
} as const;

interface TimeLogFilters {
  taskId?: string;
  userId?: string;
  projectId?: string;
  from?: string;
  to?: string;
  mine?: boolean;
  status?: TimeLogStatus;
}

@Injectable()
export class TimeLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // Time logs are personal/attendance-like (same stance as WorkSession,
  // ScreenCapture, LoginPhoto) -- an Employee only ever sees their own,
  // regardless of what they ask for. A Manager sees their whole
  // department's logged time (optionally narrowed to one teammate) -- so
  // they can review it. Admin sees everything (optionally narrowed to one
  // person). `mine=true` universally overrides all of the above to "just
  // me," for any role.
  async findAll(filters: TimeLogFilters, user: RequestUser) {
    if (filters.taskId && user.role.name === RoleName.EMPLOYEE && !filters.mine) {
      // An employee asking for a task's logs sees every logger's entries, so
      // the task itself must be one they're allowed to see.
      await this.assertTaskVisible(filters.taskId, user);
    }
    const where: Record<string, unknown> = {
      taskId: filters.taskId,
      task: filters.projectId ? { projectId: filters.projectId } : undefined,
      date: this.dateRange(filters.from, filters.to),
      status: filters.status,
    };

    if (filters.mine) {
      where.userId = user.id;
    } else if (user.role.name === RoleName.EMPLOYEE) {
      if (!filters.taskId) {
        where.userId = user.id;
      }
    } else if (user.role.name === RoleName.MANAGER) {
      where.userId = filters.userId;
      if (user.department?.id) {
        where.user = {
          OR: [{ departmentId: user.department.id }, { departmentId: null }],
        };
      }
    } else {
      where.userId = filters.userId;
    }

    return this.prisma.timeLog.findMany({
      where,
      include: timeLogInclude,
      orderBy: { date: "desc" },
    });
  }

  async create(dto: CreateTimeLogDto, user: RequestUser) {
    await this.assertTaskVisible(dto.taskId, user);
    return this.prisma.timeLog.create({
      data: { taskId: dto.taskId, userId: user.id, date: new Date(dto.date), minutes: dto.minutes, note: dto.note },
      include: timeLogInclude,
    });
  }

  // Handles two different actors in one call, same shape as
  // LeaveRequestsService.update: the logger editing their own still-pending
  // entry's content (date/minutes/note), or a Manager/Admin reviewing it
  // (status/reviewNote). A logger can never set status themselves, and once
  // an entry has been reviewed, only Admin can touch it further.
  async update(id: string, dto: UpdateTimeLogDto, user: RequestUser) {
    const log = await this.getOwned(id);
    const isOwner = log.userId === user.id;
    const canReview = this.canReviewLog(log, user);

    if (isOwner) {
      // Editing your own entry -- content fields only, and only while it's
      // still pending; status/reviewNote are never self-settable.
      if (dto.status !== undefined) {
        throw new ForbiddenException("Only a manager or admin can approve or reject a time log");
      }
      if (dto.reviewNote !== undefined) {
        throw new ForbiddenException("Only a manager or admin can add a review note");
      }
      if (log.status !== TimeLogStatus.PENDING) {
        throw new ForbiddenException("This time log has already been reviewed and can no longer be edited");
      }
    } else if (canReview) {
      // Reviewing someone else's entry -- status/reviewNote only. The
      // logged content (date/minutes/note) is locked to what they actually
      // entered; a reviewer approves or rejects it, not rewrites it.
      if (dto.date !== undefined || dto.minutes !== undefined || dto.note !== undefined) {
        throw new ForbiddenException("Reviewers can only approve or reject a time log, not edit its content");
      }
    } else {
      throw new ForbiddenException("You do not have permission to modify this time log");
    }

    const isReviewAction = dto.status === TimeLogStatus.APPROVED || dto.status === TimeLogStatus.REJECTED;

    const updated = await this.prisma.timeLog.update({
      where: { id },
      data: {
        date: dto.date ? new Date(dto.date) : undefined,
        minutes: dto.minutes,
        note: dto.note,
        status: dto.status,
        reviewNote: dto.reviewNote,
        ...(isReviewAction ? { reviewedById: user.id, reviewedAt: new Date() } : {}),
      },
      include: timeLogInclude,
    });

    if (isReviewAction && log.userId !== user.id) {
      const approved = dto.status === TimeLogStatus.APPROVED;
      await this.notifications.create({
        userId: log.userId,
        type: "GENERAL",
        title: approved ? "Time Log Approved" : "Time Log Rejected",
        message: approved
          ? `Your logged time was approved${dto.reviewNote ? `. Note: ${dto.reviewNote}` : "."}`
          : `Your logged time was rejected${dto.reviewNote ? `. Reason: ${dto.reviewNote}` : "."}`,
        link: `/tasks?taskId=${log.taskId}`,
      });
    }

    return updated;
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const log = await this.getOwned(id);
    if (user.role.name === RoleName.ADMIN) {
      await this.prisma.timeLog.delete({ where: { id } });
      return;
    }
    if (log.userId !== user.id) {
      throw new ForbiddenException("You can only delete your own time logs");
    }
    if (log.status !== TimeLogStatus.PENDING) {
      throw new ForbiddenException("This time log has already been reviewed and can no longer be deleted");
    }
    await this.prisma.timeLog.delete({ where: { id } });
  }

  private dateRange(from?: string, to?: string) {
    if (!from && !to) return undefined;
    return {
      gte: from ? new Date(from) : undefined,
      lte: to ? new Date(to) : undefined,
    };
  }

  // Same visibility rule as TasksService.visibilityScope -- can't log time
  // against a task from a department that isn't your own (unless assigned or Admin).
  private async assertTaskVisible(taskId: string, user: RequestUser) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        departmentId: true,
        assigneeId: true,
        creatorId: true,
        testerId: true,
        assignees: { select: { userId: true } },
      },
    });
    if (!task) {
      throw new NotFoundException("Task not found");
    }
    const isAdmin = user.role.name === RoleName.ADMIN;
    const isAssignee =
      task.creatorId === user.id ||
      task.assigneeId === user.id ||
      task.testerId === user.id ||
      task.assignees?.some((a) => a.userId === user.id);
    const inScope = task.departmentId === null || task.departmentId === user.department?.id || isAssignee;
    if (!isAdmin && !inScope) {
      throw new ForbiddenException("You do not have access to this task");
    }
  }

  private async getOwned(id: string) {
    const log = await this.prisma.timeLog.findUnique({
      where: { id },
      include: { user: { select: { departmentId: true } } },
    });
    if (!log) {
      throw new NotFoundException("Time log not found");
    }
    return log;
  }

  // A reviewer is Admin (unconditionally) or the logger's own-department
  // Manager -- same "departmentId === null is manageable by any Manager"
  // legacy-row convention used everywhere else in this schema.
  private canReviewLog(log: { user: { departmentId: string | null } }, user: RequestUser): boolean {
    if (user.role.name === RoleName.ADMIN) return true;
    return (
      user.role.name === RoleName.MANAGER &&
      (log.user.departmentId === null || log.user.departmentId === user.department?.id)
    );
  }
}
