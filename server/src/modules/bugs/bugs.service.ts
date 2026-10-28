import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { BugPriority, BugSeverity, BugStatus, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateBugDto } from "./dto/create-bug.dto";
import { AddBugCommentDto, UpdateBugDto } from "./dto/update-bug.dto";
import { SubmitBugFixDto } from "./dto/submit-bug-fix.dto";
import { BugReviewDecision, ReviewBugFixDto } from "./dto/review-bug-fix.dto";
import type { RequestUser } from "../../common/types/request-user.type";
import { NotificationsService } from "../notifications/notifications.service";

const bugInclude = {
  task: {
    select: {
      id: true,
      title: true,
      taskNumber: true,
      projectId: true,
      departmentId: true,
      creatorId: true,
      testerId: true,
      assigneeId: true,
      assignees: { select: { userId: true } },
    },
  },
  reporter: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  fixSubmittedBy: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  reviewedBy: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  comments: {
    include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    orderBy: { createdAt: "asc" as const },
  },
  activityLogs: {
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: "asc" as const },
  },
};

@Injectable()
export class BugsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async findAll(
    user?: RequestUser,
    taskId?: string,
    assigneeId?: string,
    status?: BugStatus,
    projectId?: string,
  ) {
    const isEmployee = user?.role?.name === RoleName.EMPLOYEE;
    const effectiveAssigneeId = isEmployee ? user?.id : assigneeId;

    return this.prisma.bug.findMany({
      where: {
        AND: [
          ...(projectId ? [{ task: { projectId } }] : []),
          ...(user ? [{ task: this.taskScope(user) }] : []),
        ],
        ...(taskId ? { taskId } : {}),
        ...(effectiveAssigneeId ? { assigneeId: effectiveAssigneeId } : {}),
        ...(status ? { status } : {}),
      },
      include: bugInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string, user?: RequestUser) {
    const bug = await this.prisma.bug.findUnique({
      where: { id },
      include: bugInclude,
    });
    if (!bug) {
      throw new NotFoundException("Bug not found");
    }
    if (user) {
      this.assertCanAccessTask(bug.task, user);
    }
    return bug;
  }

  // Same visibility rule as tasks/time logs/task updates: Admin sees all;
  // everyone else sees their own department's tasks, unscoped legacy tasks,
  // and any task they created, are assigned to, or test.
  private taskScope(user: RequestUser) {
    if (user.role.name === RoleName.ADMIN) return {};
    return {
      OR: [
        { departmentId: null },
        ...(user.department?.id ? [{ departmentId: user.department.id }] : []),
        { creatorId: user.id },
        { assigneeId: user.id },
        { testerId: user.id },
        { assignees: { some: { userId: user.id } } },
      ],
    };
  }

  private isTaskContributor(
    task: {
      creatorId?: string | null;
      assigneeId: string | null;
      testerId: string | null;
      assignees?: { userId: string }[];
    },
    user: RequestUser,
  ): boolean {
    return (
      task.creatorId === user.id ||
      task.assigneeId === user.id ||
      task.testerId === user.id ||
      (task.assignees?.some((a) => a.userId === user.id) ?? false)
    );
  }

  private assertCanAccessTask(
    task: {
      departmentId?: string | null;
      creatorId?: string | null;
      assigneeId: string | null;
      testerId: string | null;
      assignees?: { userId: string }[];
    },
    user: RequestUser,
  ) {
    if (user.role.name === RoleName.ADMIN) return;
    const inScope =
      task.departmentId === null ||
      task.departmentId === user.department?.id ||
      this.isTaskContributor(task, user);
    if (!inScope) {
      throw new ForbiddenException("You do not have access to this bug");
    }
  }

  async create(dto: CreateBugDto, reporter: RequestUser) {
    const task = await this.prisma.task.findUnique({
      where: { id: dto.taskId },
      include: { assignees: { select: { userId: true } } },
    });
    if (!task) {
      throw new NotFoundException("Associated task not found");
    }
    this.assertCanAccessTask(task, reporter);

    const bugStatus = dto.status ?? (dto.assigneeId ? BugStatus.ASSIGNED : BugStatus.OPEN);

    const bug = await this.prisma.bug.create({
      data: {
        title: dto.title,
        description: dto.description,
        taskId: dto.taskId,
        subtaskId: dto.subtaskId,
        reporterId: reporter.id,
        assigneeId: dto.assigneeId,
        severity: dto.severity ?? BugSeverity.MEDIUM,
        priority: dto.priority ?? BugPriority.MEDIUM,
        status: bugStatus,
        attachments: dto.attachments ?? [],
      },
      include: bugInclude,
    });

    // Log Activity
    await this.prisma.bugActivityLog.create({
      data: {
        bugId: bug.id,
        userId: reporter.id,
        action: "BUG_CREATED",
        details: `Bug created with status ${bug.status}${dto.assigneeId ? " and assigned" : ""}`,
      },
    });

    await this.prisma.taskActivityLog.create({
      data: {
        taskId: dto.taskId,
        userId: reporter.id,
        action: "BUG_CREATED",
        details: `Bug #${bug.bugNumber}: "${bug.title}" logged.`,
      },
    });

    // Notify assignee if assigned
    if (dto.assigneeId && dto.assigneeId !== reporter.id) {
      await this.notifications.create({
        userId: dto.assigneeId,
        type: "TASK_ASSIGNED",
        title: "Bug Assigned to You",
        message: `Bug #${bug.bugNumber}: "${bug.title}" has been assigned to you.`,
        link: bug.taskId ? `/tasks?taskId=${bug.taskId}` : "/tasks",
      });
    }

    return bug;
  }

  async update(id: string, dto: UpdateBugDto, user: RequestUser) {
    const bug = await this.findOne(id, user);
    const isManagerOrAdmin =
      user.role.name === RoleName.ADMIN || user.role.name === RoleName.MANAGER;

    // Beyond task visibility, editing needs a stake in the bug: a manager/admin,
    // its reporter or assignee, or a contributor on its task.
    const hasStake =
      isManagerOrAdmin ||
      bug.reporterId === user.id ||
      bug.assigneeId === user.id ||
      this.isTaskContributor(bug.task, user);
    if (!hasStake) {
      throw new ForbiddenException("You do not have permission to modify this bug");
    }
    // Reassigning is a triage decision, not a developer's call.
    if (
      dto.assigneeId !== undefined &&
      dto.assigneeId !== bug.assigneeId &&
      !isManagerOrAdmin &&
      bug.reporterId !== user.id &&
      bug.task.testerId !== user.id
    ) {
      throw new ForbiddenException("Only the reporter, tester, a manager, or an admin can reassign a bug");
    }

    // Workflow validation: Developers cannot directly mark bugs as FIXED, CLOSED, REOPENED, or REWORK_REQUIRED
    if (
      dto.status &&
      (dto.status === BugStatus.FIXED ||
        dto.status === BugStatus.CLOSED ||
        dto.status === BugStatus.REOPENED ||
        dto.status === BugStatus.REWORK_REQUIRED)
    ) {
      if (!isManagerOrAdmin && bug.task.testerId !== user.id) {
        throw new ForbiddenException(
          "Developers cannot directly mark bugs as Fixed, Resolved, Closed, or Rework Required. Please use 'Submit Fix for Review' to submit completed work for Manager review.",
        );
      }
    }

    // Determine new status if assignee updated
    let nextStatus = dto.status;
    if (!nextStatus && dto.assigneeId && bug.status === BugStatus.OPEN) {
      nextStatus = BugStatus.ASSIGNED;
    }

    const updated = await this.prisma.bug.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        assigneeId: dto.assigneeId,
        severity: dto.severity,
        priority: dto.priority,
        status: nextStatus,
        attachments: dto.attachments,
      },
      include: bugInclude,
    });

    // Log status change if changed
    if (nextStatus && nextStatus !== bug.status) {
      await this.prisma.bugActivityLog.create({
        data: {
          bugId: bug.id,
          userId: user.id,
          action: "STATUS_CHANGED",
          details: `Status changed from ${bug.status} to ${nextStatus}`,
        },
      });

      await this.prisma.taskActivityLog.create({
        data: {
          taskId: bug.taskId,
          userId: user.id,
          action: "BUG_STATUS_CHANGED",
          details: `Bug #${bug.bugNumber} status updated to ${nextStatus}`,
        },
      });

      // Notifications based on status transitions
      if (nextStatus === BugStatus.TO_BE_TESTED) {
        const notifyTarget = bug.task.testerId || bug.reporterId;
        if (notifyTarget && notifyTarget !== user.id) {
          await this.notifications.create({
            userId: notifyTarget,
            type: "TASK_UPDATED",
            title: "Bug Ready for Testing",
            message: `Bug #${bug.bugNumber}: "${bug.title}" fix submitted. Ready for retesting.`,
            link: bug.taskId ? `/tasks?taskId=${bug.taskId}` : "/tasks",
          });
        }
      } else if (nextStatus === BugStatus.REOPENED) {
        if (updated.assigneeId && updated.assigneeId !== user.id) {
          await this.notifications.create({
            userId: updated.assigneeId,
            type: "TASK_UPDATED",
            title: "Bug Reopened",
            message: `Bug #${bug.bugNumber}: "${bug.title}" was reopened.`,
            link: updated.taskId ? `/tasks?taskId=${updated.taskId}` : "/tasks",
          });
        }
      }
    }

    return updated;
  }

  async submitFix(id: string, dto: SubmitBugFixDto, user: RequestUser) {
    const bug = await this.findOne(id, user);
    if (
      bug.status === BugStatus.FIXED ||
      bug.status === BugStatus.CLOSED ||
      bug.status === BugStatus.PENDING_REVIEW
    ) {
      throw new BadRequestException(
        `A fix cannot be submitted for a bug that is ${bug.status.replace(/_/g, " ").toLowerCase()}.`,
      );
    }

    // Permission check: assigned developer, task contributor, reporter, manager, or admin
    const isAssignee = bug.assigneeId === user.id;
    const isTaskAssignee =
      bug.task.assigneeId === user.id ||
      bug.task.assignees.some((a) => a.userId === user.id);
    const isReporter = bug.reporterId === user.id;
    const isManagerOrAdmin =
      user.role.name === RoleName.ADMIN || user.role.name === RoleName.MANAGER;

    if (!isAssignee && !isTaskAssignee && !isReporter && !isManagerOrAdmin) {
      throw new ForbiddenException("Only the assigned developer or task contributor can submit a fix for review.");
    }

    const updated = await this.prisma.bug.update({
      where: { id },
      data: {
        status: BugStatus.PENDING_REVIEW,
        fixSummary: dto.fixSummary,
        rootCause: dto.rootCause ?? null,
        testingNotes: dto.testingNotes ?? null,
        prLink: dto.prLink ?? null,
        fixAttachmentUrl: dto.fixAttachmentUrl ?? null,
        fixSubmittedAt: new Date(),
        fixSubmittedById: user.id,
      },
      include: bugInclude,
    });

    // Log Activity
    await this.prisma.bugActivityLog.create({
      data: {
        bugId: bug.id,
        userId: user.id,
        action: "FIX_SUBMITTED",
        details: `Fix submitted for Manager Review. Summary: "${dto.fixSummary}"${dto.prLink ? ` | PR: ${dto.prLink}` : ""}`,
      },
    });

    await this.prisma.taskActivityLog.create({
      data: {
        taskId: bug.taskId,
        userId: user.id,
        action: "BUG_FIX_SUBMITTED",
        details: `Fix submitted for Bug #${bug.bugNumber} ("${bug.title}") by ${user.firstName} ${user.lastName}. Pending Manager Review.`,
      },
    });

    // Notify Managers & Admins
    try {
      const managersAndAdmins = await this.prisma.user.findMany({
        where: {
          role: { name: { in: [RoleName.ADMIN, RoleName.MANAGER] } },
          isActive: true,
        },
        select: { id: true },
      });

      for (const m of managersAndAdmins) {
        if (m.id !== user.id) {
          await this.notifications.create({
            userId: m.id,
            type: "TASK_UPDATED",
            title: "Bug Fix Pending Review",
            message: `${user.firstName} ${user.lastName} submitted a fix for Bug #${bug.bugNumber}: "${bug.title}". Please review and approve.`,
            link: bug.taskId ? `/tasks?taskId=${bug.taskId}` : "/tasks",
          });
        }
      }
    } catch (err) {
      console.error("Failed to notify managers about bug fix submission:", err);
    }

    return updated;
  }

  async reviewFix(id: string, dto: ReviewBugFixDto, user: RequestUser) {
    const bug = await this.findOne(id, user);
    const isManagerOrAdmin =
      user.role.name === RoleName.ADMIN || user.role.name === RoleName.MANAGER;

    if (!isManagerOrAdmin) {
      throw new ForbiddenException(
        "Only Managers and Admins have permission to review, approve, or reject bug fixes.",
      );
    }
    if (bug.status !== BugStatus.PENDING_REVIEW) {
      throw new BadRequestException("Only a bug with a fix pending review can be reviewed.");
    }
    if (bug.fixSubmittedById === user.id && user.role.name !== RoleName.ADMIN) {
      throw new ForbiddenException("You cannot review a fix you submitted yourself.");
    }

    let targetStatus: BugStatus;
    let actionName: string;
    let actionDetails: string;
    let notificationTitle: string;
    let notificationOutcome: string;

    if (dto.decision === BugReviewDecision.APPROVE) {
      targetStatus = BugStatus.FIXED;
      actionName = "FIX_APPROVED";
      actionDetails = `Fix approved by ${user.firstName} ${user.lastName}. Status set to FIXED.${dto.managerComments ? ` Review comments: "${dto.managerComments}"` : ""}`;
      notificationTitle = "Bug Fix Approved";
      notificationOutcome = "approved as FIXED";
    } else if (dto.decision === BugReviewDecision.REJECT) {
      targetStatus = BugStatus.IN_PROGRESS;
      actionName = "FIX_REJECTED";
      actionDetails = `Fix rejected by ${user.firstName} ${user.lastName}. Status returned to IN_PROGRESS.${dto.managerComments ? ` Reason: "${dto.managerComments}"` : ""}`;
      notificationTitle = "Bug Fix Rejected";
      notificationOutcome = "rejected and returned to In Progress";
    } else if (dto.decision === BugReviewDecision.REQUEST_CHANGES) {
      targetStatus = BugStatus.REWORK_REQUIRED;
      actionName = "REWORK_REQUESTED";
      actionDetails = `Additional rework requested by ${user.firstName} ${user.lastName}. Status set to REWORK_REQUIRED.${dto.managerComments ? ` Feedback: "${dto.managerComments}"` : ""}`;
      notificationTitle = "Bug Rework Required";
      notificationOutcome = "marked as Rework Required";
    } else {
      throw new BadRequestException("Invalid review decision");
    }

    const updated = await this.prisma.bug.update({
      where: { id },
      data: {
        status: targetStatus,
        managerComments: dto.managerComments ?? null,
        reviewedAt: new Date(),
        reviewedById: user.id,
      },
      include: bugInclude,
    });

    // Log Activity
    await this.prisma.bugActivityLog.create({
      data: {
        bugId: bug.id,
        userId: user.id,
        action: actionName,
        details: actionDetails,
      },
    });

    await this.prisma.taskActivityLog.create({
      data: {
        taskId: bug.taskId,
        userId: user.id,
        action: actionName,
        details: `Bug #${bug.bugNumber} ("${bug.title}") fix ${notificationOutcome} by ${user.firstName} ${user.lastName}.`,
      },
    });

    // Notify Developer (assignee or fix submitter)
    const targetUserId = bug.assigneeId || bug.fixSubmittedById;
    if (targetUserId && targetUserId !== user.id) {
      await this.notifications.create({
        userId: targetUserId,
        type: "TASK_UPDATED",
        title: notificationTitle,
        message: `Your submitted fix for Bug #${bug.bugNumber} ("${bug.title}") was ${notificationOutcome}.${dto.managerComments ? ` Manager Note: "${dto.managerComments}"` : ""}`,
        link: bug.taskId ? `/tasks?taskId=${bug.taskId}` : "/tasks",
      });
    }

    return updated;
  }

  async addComment(id: string, dto: AddBugCommentDto, user: RequestUser) {
    const bug = await this.findOne(id, user);
    const comment = await this.prisma.bugComment.create({
      data: {
        bugId: id,
        userId: user.id,
        content: dto.content,
      },
      include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    });

    await this.prisma.bugActivityLog.create({
      data: {
        bugId: id,
        userId: user.id,
        action: "COMMENT_ADDED",
        details: `Comment added: "${dto.content.slice(0, 40)}..."`,
      },
    });

    // Notify assignee and reporter
    try {
      const targets = new Set<string>();
      if (bug.assigneeId) targets.add(bug.assigneeId);
      if (bug.reporterId) targets.add(bug.reporterId);
      targets.delete(user.id);

      const snippet = dto.content.length > 80 ? dto.content.slice(0, 80) + "..." : dto.content;
      for (const targetId of targets) {
        await this.notifications.create({
          userId: targetId,
          type: "TASK_UPDATED",
          title: `Comment on Bug #${bug.bugNumber}: "${bug.title}"`,
          message: `${user.firstName} ${user.lastName}: ${snippet}`,
          link: bug.taskId ? `/tasks?taskId=${bug.taskId}` : "/tasks",
        });
      }
    } catch (err) {
      console.error("Failed to notify about bug comment:", err);
    }

    return comment;
  }

  async remove(id: string, user: RequestUser) {
    const bug = await this.findOne(id, user);
    if (
      user.role.name !== RoleName.ADMIN &&
      user.role.name !== RoleName.MANAGER &&
      bug.reporterId !== user.id
    ) {
      throw new ForbiddenException("Only the reporter, manager, or admin can delete a bug.");
    }
    await this.prisma.bug.delete({ where: { id } });
  }
}
