import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { BugStatus, NotificationType, RoleName, TaskPriority, TaskStatus, TaskType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import type { RequestUser } from "../../common/types/request-user.type";
import { NotificationsService } from "../notifications/notifications.service";
import { EngagementEventsService } from "../engagement/engagement-events.service";
import { sendEmail } from "../../common/utils/mailer";

const taskInclude = {
  assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, departmentId: true } },
  assignees: {
    include: {
      user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, departmentId: true } },
    },
  },
  tester: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, departmentId: true } },
  creator: { select: { id: true, firstName: true, lastName: true, departmentId: true } },
  project: { select: { id: true, name: true, departmentId: true } },
  taskList: { select: { id: true, name: true } },
  timeLogs: {
    select: {
      id: true,
      minutes: true,
      date: true,
      startTime: true,
      endTime: true,
      note: true,
      userId: true,
      status: true,
      reviewNote: true,
      reviewedAt: true,
      reviewedBy: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "desc" as const },
  },
  subtasks: {
    include: {
      assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      tester: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      timeLogs: {
        select: {
          id: true,
          minutes: true,
          date: true,
          startTime: true,
          endTime: true,
          note: true,
          userId: true,
          status: true,
          reviewNote: true,
          reviewedAt: true,
          reviewedBy: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "desc" as const },
      },
      updates: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "desc" as const },
      },
      bugs: {
        include: {
          reporter: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          comments: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
            },
            orderBy: { createdAt: "asc" as const },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
  updates: {
    orderBy: { createdAt: "desc" as const },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  },
  bugs: {
    include: {
      reporter: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      comments: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "asc" as const },
      },
      activityLogs: {
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: "asc" as const },
      },
    },
    orderBy: { createdAt: "desc" as const },
  },
  activityLogs: {
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" as const },
  },
  _count: { select: { updates: true, bugs: true, subtasks: true, timeLogs: true } },
} as const;

interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string;
  assigneeId?: string;
  departmentId?: string;
  taskListId?: string;
  testerId?: string;
}

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly engagementEvents: EngagementEventsService,
  ) {}

  findAll(filters: TaskFilters, user: RequestUser) {
    const andConditions: Record<string, unknown>[] = [];

    if (filters.status) andConditions.push({ status: filters.status });
    if (filters.priority) andConditions.push({ priority: filters.priority });
    if (filters.projectId) andConditions.push({ projectId: filters.projectId });
    if (filters.taskListId) andConditions.push({ taskListId: filters.taskListId });
    if (filters.testerId) andConditions.push({ testerId: filters.testerId });

    if (filters.assigneeId) {
      andConditions.push({
        OR: [
          { assigneeId: filters.assigneeId },
          { assignees: { some: { userId: filters.assigneeId } } },
        ],
      });
    }

    const scopeConditions = this.visibilityScope(user, filters.departmentId);
    if (scopeConditions.length > 0) {
      andConditions.push({ OR: scopeConditions });
    }

    return this.prisma.task.findMany({
      where: andConditions.length > 0 ? { AND: andConditions } : {},
      include: taskInclude,
      orderBy: [{ status: "asc" }, { position: "asc" }],
    });
  }

  private visibilityScope(
    user: RequestUser,
    requestedDepartmentId?: string,
  ): Record<string, unknown>[] {
    if (user.role.name === RoleName.ADMIN) {
      if (requestedDepartmentId) {
        return [
          { departmentId: requestedDepartmentId },
          { project: { departmentId: requestedDepartmentId } },
        ];
      }
      return [];
    }

    const targetDeptId = requestedDepartmentId || user.department?.id;

    if (user.role.name === RoleName.MANAGER) {
      const conditions: Record<string, unknown>[] = [
        { assigneeId: user.id },
        { creatorId: user.id },
        { testerId: user.id },
        { assignees: { some: { userId: user.id } } },
        { subtasks: { some: { assigneeId: user.id } } },
        { departmentId: null },
      ];

      if (targetDeptId) {
        conditions.push(
          { departmentId: targetDeptId },
          { project: { departmentId: targetDeptId } },
          { assignee: { departmentId: targetDeptId } },
          { assignees: { some: { user: { departmentId: targetDeptId } } } },
          { creator: { departmentId: targetDeptId } },
        );
      }

      return conditions;
    }

    // EMPLOYEE role:
    // Strictly sees only tasks assigned to them, created by them, tested by them, or where they are a subtask assignee.
    // Department-wide tasks are only visible to managers and admins.
    return [
      { assigneeId: user.id },
      { assignees: { some: { userId: user.id } } },
      { testerId: user.id },
      { creatorId: user.id },
      { subtasks: { some: { assigneeId: user.id } } },
    ];
  }

  async findOne(id: string, user?: RequestUser) {
    const task = await this.prisma.task.findUnique({ where: { id }, include: taskInclude });
    if (!task) {
      throw new NotFoundException("Task not found");
    }

    if (user && user.role.name === RoleName.EMPLOYEE) {
      const isSelfInvolved =
        task.assigneeId === user.id ||
        task.creatorId === user.id ||
        task.testerId === user.id ||
        task.assignees?.some((a) => a.userId === user.id) ||
        task.subtasks?.some((st) => st.assigneeId === user.id);

      if (!isSelfInvolved) {
        throw new ForbiddenException("Access denied: You do not have permission to view this task");
      }
    } else if (user && user.role.name === RoleName.MANAGER) {
      const isSelfInvolved =
        task.assigneeId === user.id ||
        task.creatorId === user.id ||
        task.testerId === user.id ||
        task.assignees?.some((a) => a.userId === user.id) ||
        task.subtasks?.some((st) => st.assigneeId === user.id);

      const isDeptMatch =
        !task.departmentId ||
        (user.department?.id && (
          task.departmentId === user.department.id ||
          task.project?.departmentId === user.department.id ||
          task.assignee?.departmentId === user.department.id ||
          task.creator?.departmentId === user.department.id ||
          task.assignees?.some((a) => a.user?.departmentId === user.department?.id)
        ));

      if (!isSelfInvolved && !isDeptMatch) {
        throw new ForbiddenException("Access denied: You do not have permission to view this task");
      }
    }

    return task;
  }

  async create(dto: CreateTaskDto, creator: RequestUser) {
    const status = dto.status ?? TaskStatus.TODO;
    if (status === TaskStatus.DONE && !this.isAdminOrManager(creator)) {
      throw new ForbiddenException("Only a manager, admin, or tester can complete a task.");
    }
    if (dto.parentId && !this.isAdminOrManager(creator)) {
      throw new ForbiddenException("Only managers and admins can add subtasks.");
    }
    const position = await this.nextPosition(dto.projectId ?? null, status);

    // Primary assignee
    const primaryAssigneeId =
      dto.assigneeId ??
      (dto.assigneeIds && dto.assigneeIds.length > 0 ? dto.assigneeIds[0] : undefined);

    const validTaskTypes: TaskType[] = ["FEATURE", "BUG", "REFACTOR", "CHORE"];
    const resolvedType = dto.type && validTaskTypes.includes(dto.type) ? dto.type : "FEATURE";

    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        status,
        priority: dto.priority ?? TaskPriority.MEDIUM,
        projectId: dto.projectId,
        assigneeId: primaryAssigneeId,
        testerId: dto.testerId,
        testingNotes: dto.testingNotes,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        position,
        creatorId: creator.id,
        departmentId: dto.departmentId ?? creator.department?.id,
        storyPoints: dto.storyPoints,
        type: resolvedType,
        sprintId: dto.sprintId,
        parentId: dto.parentId,
        taskListId: dto.taskListId,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        tags: dto.tags ?? [],
      },
      include: taskInclude,
    });

    // Create TaskAssignee join entries for multiple assignees
    if (dto.assigneeIds && dto.assigneeIds.length > 0) {
      const uniqueAssigneeIds = Array.from(new Set(dto.assigneeIds));
      await this.prisma.taskAssignee.createMany({
        data: uniqueAssigneeIds.map((uId) => ({ taskId: task.id, userId: uId })),
        skipDuplicates: true,
      });
    }

    // Log Activity
    await this.prisma.taskActivityLog.create({
      data: {
        taskId: task.id,
        userId: creator.id,
        action: dto.parentId ? "SUBTASK_CREATED" : "TASK_CREATED",
        details: `Task "${task.title}" created.`,
      },
    });

    // Ensure assigned users are connected to project members
    const effectiveProjectId = dto.projectId || task.projectId;
    if (effectiveProjectId) {
      const userIdsToConnect = [
        ...(dto.assigneeIds || []),
        primaryAssigneeId,
        dto.testerId,
      ].filter((uId): uId is string => Boolean(uId));

      if (userIdsToConnect.length > 0) {
        await this.prisma.project
          .update({
            where: { id: effectiveProjectId },
            data: {
              members: {
                connect: userIdsToConnect.map((uId) => ({ id: uId })),
              },
            },
          })
          .catch(() => null);
      }
    }

    // Notify assignees safely (both in-app notification & email alert)
    try {
      const assigneesToNotify =
        dto.assigneeIds && dto.assigneeIds.length > 0
          ? dto.assigneeIds
          : primaryAssigneeId
            ? [primaryAssigneeId]
            : [];
      for (const uId of assigneesToNotify) {
        if (uId !== creator.id) {
          await this.notifications.create({
            userId: uId,
            type: NotificationType.TASK_ASSIGNED,
            title: "New Task Assigned",
            message: `You have been assigned: "${dto.title}" by ${creator.firstName} ${creator.lastName}.`,
            link: `/tasks?taskId=${task.id}`,
          }).catch((err) => this.logger.warn(`Failed to dispatch in-app notification: ${err}`));
        }
      }

      await this.sendTaskAssignmentEmails({
        assigneeUserIds: assigneesToNotify,
        assigner: creator,
        task: {
          id: task.id,
          title: dto.title,
          description: dto.description,
          priority: task.priority,
          status: task.status,
          projectId: task.projectId,
          dueDate: task.dueDate,
          storyPoints: task.storyPoints,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to notify assigned user on task creation: ${err}`);
    }

    return this.findOne(task.id);
  }

  async update(id: string, dto: UpdateTaskDto, user: RequestUser) {
    const task = await this.getOwned(id);
    this.assertCanMutate(task, user);
    this.assertCanChangeOwnership(task, dto, user);

    if (dto.status !== undefined && dto.status !== task.status) {
      await this.validateStatusTransition(task, dto.status, user);
    }

    // Only the designated Tester (or Manager/Admin) may record testing approval.
    if (dto.testingApproved !== undefined) {
      const isTesterOrAdmin =
        user.role.name === RoleName.ADMIN ||
        user.role.name === RoleName.MANAGER ||
        task.testerId === user.id;
      if (!isTesterOrAdmin) {
        throw new ForbiddenException(
          "Only the assigned Tester, Manager, or Admin can approve testing.",
        );
      }
    }

    // Update multiple assignees if provided
    // Replaced atomically so a failed insert can't leave the task with no assignees.
    if (dto.assigneeIds !== undefined) {
      const uniqueIds = Array.from(new Set(dto.assigneeIds));
      await this.prisma.$transaction([
        this.prisma.taskAssignee.deleteMany({ where: { taskId: id } }),
        this.prisma.taskAssignee.createMany({
          data: uniqueIds.map((uId) => ({ taskId: id, userId: uId })),
          skipDuplicates: true,
        }),
      ]);
    }

    const primaryAssigneeId =
      dto.assigneeId !== undefined
        ? dto.assigneeId
        : dto.assigneeIds && dto.assigneeIds.length > 0
          ? dto.assigneeIds[0]
          : task.assigneeId;

    const isTransitioningToDone = dto.status === TaskStatus.DONE;
    const isTransitioningOutOfDone =
      dto.status !== undefined && dto.status !== TaskStatus.DONE && task.status === TaskStatus.DONE;

    let nextTestingApproved: boolean | undefined = dto.testingApproved;
    let nextTestingCompletedAt: Date | null | undefined =
      dto.testingApproved === false ? null : undefined;

    if (isTransitioningToDone) {
      nextTestingApproved = true;
      nextTestingCompletedAt = new Date();
    } else if (isTransitioningOutOfDone && dto.testingApproved === undefined) {
      nextTestingApproved = false;
      nextTestingCompletedAt = null;
    } else if (dto.testingApproved === true) {
      nextTestingCompletedAt = new Date();
    }

    const nextDueTime =
      dto.dueDate === undefined ? undefined : dto.dueDate ? new Date(dto.dueDate).getTime() : null;
    const dueDateChanged =
      nextDueTime !== undefined && nextDueTime !== (task.dueDate ? task.dueDate.getTime() : null);

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        projectId: dto.projectId,
        assigneeId: primaryAssigneeId,
        testerId: dto.testerId,
        testingNotes: dto.testingNotes,
        testingApproved: nextTestingApproved,
        testingCompletedAt: nextTestingCompletedAt,
        dueDate: dto.dueDate === undefined ? undefined : dto.dueDate ? new Date(dto.dueDate) : null,
        // Only re-arm the overdue alert when the deadline really moved -- the edit
        // form re-sends the unchanged dueDate on every save.
        overdueNotifiedAt: dueDateChanged ? null : undefined,
        position: dto.position,
        departmentId: dto.departmentId,
        storyPoints: dto.storyPoints,
        type: dto.type,
        sprintId: dto.sprintId,
        parentId: dto.parentId,
        taskListId: dto.taskListId,
        startDate:
          dto.startDate === undefined ? undefined : dto.startDate ? new Date(dto.startDate) : null,
        tags: dto.tags,
      },
      include: taskInclude,
    });

    // Log Activity
    if (dto.status !== undefined && dto.status !== task.status) {
      await this.prisma.taskActivityLog.create({
        data: {
          taskId: id,
          userId: user.id,
          action: "STATUS_CHANGED",
          details: `Status changed from ${task.status} to ${dto.status}.`,
        },
      });

      await this.notifyStatusChange(
        {
          id: updated.id,
          creatorId: updated.creatorId,
          assigneeId: updated.assigneeId,
          testerId: updated.testerId,
          sprintId: updated.sprintId,
          assignees: updated.assignees,
        },
        updated.title,
        dto.status,
        user,
        updated.testerId,
      );

      if (dto.status === TaskStatus.DONE) {
        // No dealId/contactId on Task (it's Project-scoped, not CRM-scoped)
        // -- this event has no score effect, it exists purely for the
        // Engagement Center's cross-module activity feed.
        await this.engagementEvents.record({
          type: "TASK_COMPLETED",
          ownerId: updated.assigneeId ?? updated.creatorId,
          departmentId: updated.departmentId,
        });
      }
    }

    // Notify newly assigned users if assignee changed (both in-app notification & email alert)
    try {
      const existingAssigneeIds = new Set<string>();
      if (task.assigneeId) existingAssigneeIds.add(task.assigneeId);
      if (task.assignees) {
        task.assignees.forEach((a) => existingAssigneeIds.add(a.userId));
      }

      const currentAssigneeIds = new Set<string>();
      if (primaryAssigneeId) currentAssigneeIds.add(primaryAssigneeId);
      if (dto.assigneeIds) {
        dto.assigneeIds.forEach((id) => currentAssigneeIds.add(id));
      }

      const newlyAssignedUserIds = Array.from(currentAssigneeIds).filter(
        (id) => !existingAssigneeIds.has(id) && id !== user.id,
      );

      for (const uId of newlyAssignedUserIds) {
        await this.notifications.create({
          userId: uId,
          type: NotificationType.TASK_ASSIGNED,
          title: "Task Assigned to You",
          message: `You have been assigned: "${updated.title}" by ${user.firstName} ${user.lastName}.`,
          link: `/tasks?taskId=${updated.id}`,
        }).catch(() => null);
      }

      if (newlyAssignedUserIds.length > 0) {
        await this.sendTaskAssignmentEmails({
          assigneeUserIds: newlyAssignedUserIds,
          assigner: user,
          task: {
            id: updated.id,
            title: updated.title,
            description: updated.description,
            priority: updated.priority,
            status: updated.status,
            projectId: updated.projectId,
            dueDate: updated.dueDate,
            storyPoints: updated.storyPoints,
          },
        });
      }
    } catch (err) {
      this.logger.warn(`Failed to notify newly assigned users on update: ${err}`);
    }

    // Ensure assigned users are connected to project members
    const effectiveProjectId = dto.projectId !== undefined ? dto.projectId : task.projectId;
    if (effectiveProjectId) {
      const userIdsToConnect = [
        ...(dto.assigneeIds || []),
        primaryAssigneeId,
        dto.testerId,
      ].filter((uId): uId is string => Boolean(uId));

      if (userIdsToConnect.length > 0) {
        await this.prisma.project
          .update({
            where: { id: effectiveProjectId },
            data: {
              members: {
                connect: userIdsToConnect.map((uId) => ({ id: uId })),
              },
            },
          })
          .catch(() => null);
      }
    }

    return updated;
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const task = await this.getOwned(id);
    this.assertCanMutate(task, user);
    if (!this.isTaskController(task, user)) {
      throw new ForbiddenException("Only the task creator, a Manager, or an Admin can delete a task");
    }
    await this.prisma.task.delete({ where: { id } });
  }

  private async validateStatusTransition(
    task: {
      id: string;
      status: TaskStatus;
      parentId: string | null;
      testerId: string | null;
      creatorId: string;
    },
    nextStatus: TaskStatus,
    user: RequestUser,
  ) {
    // Only the designated Tester (or a Manager/Admin override) may approve completion.
    // Note: deliberately excludes task.creatorId -- a developer who self-created/self-assigned
    // a task must not be able to bypass tester validation just by being its creator.
    const isTesterOrAdmin =
      user.role.name === RoleName.ADMIN ||
      user.role.name === RoleName.MANAGER ||
      task.testerId === user.id;

    // Strict Rule: Developer cannot directly complete a task
    if (nextStatus === TaskStatus.DONE) {
      if (!isTesterOrAdmin) {
        throw new ForbiddenException(
          "Developers cannot directly mark a task as Completed. Please set status to 'Ready for Testing' for Tester validation.",
        );
      }

      // Fetch task with full relation checks for completion logic
      const fullTask = await this.prisma.task.findUnique({
        where: { id: task.id },
        include: {
          updates: true,
          timeLogs: true,
          bugs: true,
          subtasks: {
            include: {
              updates: true,
              timeLogs: true,
              bugs: true,
            },
          },
        },
      });

      if (!fullTask) throw new NotFoundException("Task not found");

      // Requirement 1: Daily updates check (at least 1 update on task or subtasks)
      const totalUpdates =
        fullTask.updates.length + fullTask.subtasks.reduce((acc, st) => acc + st.updates.length, 0);
      if (totalUpdates === 0) {
        throw new BadRequestException(
          "Task cannot be completed until at least one Daily Work Update is logged.",
        );
      }

      // Requirement 2: Time logs check (at least 1 time log on task or subtasks)
      const totalTimeLogs =
        fullTask.timeLogs.length +
        fullTask.subtasks.reduce((acc, st) => acc + st.timeLogs.length, 0);
      if (totalTimeLogs === 0) {
        throw new BadRequestException(
          "Task cannot be completed until at least one Time Log is submitted.",
        );
      }

      // Requirement 3: Open bugs check (all bugs must be CLOSED or FIXED)
      const allBugs = [...fullTask.bugs, ...fullTask.subtasks.flatMap((st) => st.bugs)];
      const openBugs = allBugs.filter(
        (b) => b.status !== BugStatus.CLOSED && b.status !== BugStatus.FIXED,
      );

      if (openBugs.length > 0) {
        const openList = openBugs
          .map((b) => `Bug #${b.bugNumber} (${b.status}): "${b.title}"`)
          .join(", ");
        throw new BadRequestException(
          `Cannot complete task! ${openBugs.length} unresolved bug(s) remain: ${openList}. All bugs must be FIXED or CLOSED first.`,
        );
      }

      // Requirement 4: Parent Task Completion Rule (all subtasks must be DONE)
      if (fullTask.subtasks.length > 0) {
        const unfinishedSubtasks = fullTask.subtasks.filter((st) => st.status !== TaskStatus.DONE);
        if (unfinishedSubtasks.length > 0) {
          const subList = unfinishedSubtasks.map((st) => `"${st.title}" (${st.status})`).join(", ");
          throw new BadRequestException(
            `Cannot complete parent task! ${unfinishedSubtasks.length} subtask(s) are incomplete: ${subList}.`,
          );
        }
      }
    }
  }

  private async notifyStatusChange(
    before: {
      id?: string;
      creatorId: string;
      assigneeId: string | null;
      testerId: string | null;
      sprintId?: string | null;
      assignees?: { userId: string }[];
    },
    title: string,
    nextStatus: TaskStatus,
    actor: RequestUser,
    currentTesterId?: string | null,
  ) {
    const targetTester = currentTesterId || before.testerId;
    const link = before.id ? `/tasks?taskId=${before.id}` : "/tasks";

    if (nextStatus === TaskStatus.READY_FOR_TESTING) {
      if (targetTester && targetTester !== actor.id) {
        await this.notifications.create({
          userId: targetTester,
          type: "TASK_UPDATED",
          title: "Task Ready for Testing",
          message: `"${title}" has been moved to Ready for Testing by ${actor.firstName} ${actor.lastName}.`,
          link,
        });
      }
      if (before.creatorId && before.creatorId !== actor.id && before.creatorId !== targetTester) {
        await this.notifications.create({
          userId: before.creatorId,
          type: "TASK_UPDATED",
          title: "Task Sent to Testing Queue",
          message: `"${title}" was submitted for testing by ${actor.firstName} ${actor.lastName}.`,
          link,
        });
      }
    } else if (nextStatus === TaskStatus.DONE) {
      const targets = new Set<string>();
      if (before.assigneeId) targets.add(before.assigneeId);
      if (before.creatorId) targets.add(before.creatorId);
      before.assignees?.forEach((a) => targets.add(a.userId));
      targets.delete(actor.id);

      for (const targetId of targets) {
        await this.notifications.create({
          userId: targetId,
          type: "TASK_UPDATED",
          title: "Task Approved & Completed",
          message: `"${title}" has been marked Completed after validation by ${actor.firstName} ${actor.lastName}.`,
          link,
        });
      }
    } else {
      const targets = new Set<string>();
      if (before.assigneeId) targets.add(before.assigneeId);
      if (before.creatorId) targets.add(before.creatorId);
      if (targetTester) targets.add(targetTester);
      before.assignees?.forEach((a) => targets.add(a.userId));
      targets.delete(actor.id);

      const statusLabels: Record<TaskStatus, string> = {
        [TaskStatus.TODO]: "To Do",
        [TaskStatus.IN_PROGRESS]: "In Progress",
        [TaskStatus.IN_REVIEW]: "In Review",
        [TaskStatus.READY_FOR_TESTING]: "Ready for Testing",
        [TaskStatus.CHANGES_REQUIRED]: "Changes Required",
        [TaskStatus.DONE]: "Done",
      };

      for (const targetId of targets) {
        await this.notifications.create({
          userId: targetId,
          type: "TASK_UPDATED",
          title: `Task Status: ${statusLabels[nextStatus] || nextStatus}`,
          message: `"${title}" was moved to ${statusLabels[nextStatus] || nextStatus} by ${actor.firstName} ${actor.lastName}.`,
          link,
        });
      }
    }
  }

  private async nextPosition(projectId: string | null, status: TaskStatus): Promise<number> {
    const last = await this.prisma.task.findFirst({
      where: { projectId, status },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }

  private async getOwned(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { assignees: { select: { userId: true } } },
    });
    if (!task) {
      throw new NotFoundException("Task not found");
    }
    return task;
  }

  private isAdminOrManager(user: RequestUser): boolean {
    return user.role.name === RoleName.ADMIN || user.role.name === RoleName.MANAGER;
  }

  // Creator, Admin, or the department's Manager (same rule as assertCanMutate's manager branch).
  private isTaskController(
    task: { creatorId: string; departmentId: string | null },
    user: RequestUser,
  ): boolean {
    if (user.role.name === RoleName.ADMIN || task.creatorId === user.id) return true;
    return (
      user.role.name === RoleName.MANAGER &&
      (task.departmentId === user.department?.id || task.departmentId === null)
    );
  }

  // Assignees/testers may work on a task but must not move its deadline, reassign
  // it, or appoint a tester. Unchanged values are allowed because the edit form
  // re-sends every field on save.
  private assertCanChangeOwnership(
    task: {
      creatorId: string;
      departmentId: string | null;
      dueDate: Date | null;
      assigneeId: string | null;
      testerId: string | null;
      projectId: string | null;
      assignees?: Array<{ userId: string }>;
    },
    dto: UpdateTaskDto,
    user: RequestUser,
  ) {
    if (this.isTaskController(task, user)) return;
    const sameSet = (a: string[], b: string[]) =>
      a.length === b.length && a.every((x) => b.includes(x));
    const currentIds = (task.assignees ?? []).map((a) => a.userId);
    const nextDue =
      dto.dueDate === undefined ? undefined : dto.dueDate ? new Date(dto.dueDate).getTime() : null;
    const changed =
      (nextDue !== undefined && nextDue !== (task.dueDate ? task.dueDate.getTime() : null)) ||
      (dto.assigneeId !== undefined && dto.assigneeId !== task.assigneeId) ||
      (dto.testerId !== undefined && dto.testerId !== task.testerId) ||
      (dto.departmentId !== undefined && dto.departmentId !== task.departmentId) ||
      (dto.projectId !== undefined && dto.projectId !== task.projectId) ||
      (dto.assigneeIds !== undefined && !sameSet(Array.from(new Set(dto.assigneeIds)), currentIds));
    if (changed) {
      throw new ForbiddenException(
        "Only the task creator, a Manager, or an Admin can change the deadline, assignees, tester, project, or department",
      );
    }
  }

  private assertCanMutate(
    task: {
      creatorId: string;
      assigneeId: string | null;
      departmentId: string | null;
      testerId?: string | null;
      assignees?: Array<{ userId: string }>;
    },
    user: RequestUser,
  ) {
    if (user.role.name === RoleName.ADMIN) return;
    const isOwner =
      task.creatorId === user.id ||
      task.assigneeId === user.id ||
      task.testerId === user.id ||
      (task.assignees?.some((a) => a.userId === user.id) ?? false);
    const isDeptManager =
      user.role.name === RoleName.MANAGER &&
      (task.departmentId === user.department?.id || task.departmentId === null);
    if (!isOwner && !isDeptManager) {
      throw new ForbiddenException("You do not have permission to modify this task");
    }
  }

  private async sendTaskAssignmentEmails(params: {
    assigneeUserIds: string[];
    assigner: RequestUser;
    task: {
      id: string;
      title: string;
      description?: string | null;
      priority: TaskPriority;
      status: TaskStatus;
      projectId?: string | null;
      dueDate?: Date | null;
      storyPoints?: number | null;
    };
  }): Promise<void> {
    const rawIds = (params.assigneeUserIds || []).filter(
      (id) => typeof id === "string" && id.trim().length > 0 && id !== params.assigner.id,
    );
    const targetIds = Array.from(new Set(rawIds));
    if (targetIds.length === 0) return;

    try {
      const users =
        (await this.prisma.user?.findMany?.({
          where: { id: { in: targetIds } },
          select: { id: true, email: true, firstName: true, lastName: true },
        })) || [];

      if (!users || users.length === 0) return;

      let projectName: string | null = null;
      if (params.task.projectId) {
        try {
          const proj = await this.prisma.project?.findUnique?.({
            where: { id: params.task.projectId },
            select: { name: true },
          });
          projectName = proj?.name ?? null;
        } catch {
          projectName = null;
        }
      }

      const appUrl = (process.env.APP_URL || process.env.CORS_ORIGIN || "http://localhost:8080").replace(/\/+$/, "");
      const taskUrl = `${appUrl}/tasks?taskId=${params.task.id}`;
      const assignerName =
        `${params.assigner.firstName || ""} ${params.assigner.lastName || ""}`.trim() ||
        params.assigner.email ||
        "A team member";

      for (const recipient of users) {
        if (!recipient.email) continue;
        const recipientName =
          `${recipient.firstName || ""} ${recipient.lastName || ""}`.trim() || recipient.email;

        const html = this.buildTaskAssignmentEmailHtml({
          recipientName,
          assignerName,
          task: params.task,
          projectName,
          taskUrl,
        });

        const subject = `[Task Assigned] ${params.task.title} (${params.task.priority})`;

        await sendEmail({
          to: recipient.email,
          subject,
          html,
          replyTo: params.assigner.email || undefined,
        }).catch((err) => {
          this.logger.warn(`Failed to send task assignment email to ${recipient.email}: ${err}`);
        });
      }
    } catch (err) {
      this.logger.warn(`Error in sendTaskAssignmentEmails: ${err}`);
    }
  }

  private buildTaskAssignmentEmailHtml(params: {
    recipientName: string;
    assignerName: string;
    task: {
      id: string;
      title: string;
      description?: string | null;
      priority: TaskPriority;
      status: TaskStatus;
      projectId?: string | null;
      dueDate?: Date | null;
      storyPoints?: number | null;
    };
    projectName: string | null;
    taskUrl: string;
  }): string {
    const escapedTitle = this.escapeHtml(params.task.title || "Untitled Task");
    const escapedDesc = params.task.description
      ? this.escapeHtml(params.task.description).replace(/\n/g, "<br/>")
      : "<em>No description provided.</em>";
    const priorityBadge = this.formatPriorityBadge(params.task.priority);
    const statusLabel = this.formatStatusLabel(params.task.status);
    const dueDateStr = this.formatDueDate(params.task.dueDate);
    const pointsStr =
      params.task.storyPoints !== null && params.task.storyPoints !== undefined
        ? `${params.task.storyPoints} pts`
        : "Not estimated";

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>New Task Assignment</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f9; margin: 0; padding: 24px; color: #1e293b; line-height: 1.5; }
    .card { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.06); }
    .header { background: linear-gradient(135deg, #0b5ed7 0%, #1e40af 100%); padding: 24px 28px; color: #ffffff; }
    .header-logo { font-size: 18px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 4px; }
    .header-subtitle { font-size: 12px; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.08em; }
    .content { padding: 28px; }
    .banner { background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 14px 18px; border-radius: 0 8px 8px 0; margin-bottom: 24px; }
    .banner-title { font-weight: 700; color: #1e3a8a; font-size: 15px; margin: 0 0 4px 0; }
    .banner-desc { font-size: 13px; color: #3b82f6; margin: 0; }
    .task-title { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-top: 24px; margin-bottom: 10px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; }
    .grid { display: table; width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    .grid-row { display: table-row; }
    .grid-label { display: table-cell; width: 32%; padding: 8px 0; font-size: 13px; color: #64748b; font-weight: 600; vertical-align: top; }
    .grid-value { display: table-cell; width: 68%; padding: 8px 0; font-size: 13px; color: #0f172a; font-weight: 500; vertical-align: top; }
    .desc-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; font-size: 13px; color: #334155; line-height: 1.6; margin-top: 6px; word-break: break-word; }
    .btn-container { text-align: center; margin-top: 32px; margin-bottom: 16px; }
    .btn { display: inline-block; background: #0b5ed7; color: #ffffff !important; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 700; font-size: 14px; box-shadow: 0 2px 8px rgba(11,94,215,0.3); }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 24px; text-align: center; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="header-logo">Venus Consultancy</div>
      <div class="header-subtitle">CRM Operating System &bull; Task Assignment</div>
    </div>
    <div class="content">
      <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">Hello <strong>${this.escapeHtml(params.recipientName)}</strong>,</p>
      <div class="banner">
        <p class="banner-title">&#9679; Task Assigned to You</p>
        <p class="banner-desc">You have been assigned to a task by <strong>${this.escapeHtml(params.assignerName)}</strong>.</p>
      </div>

      <div class="task-title">${escapedTitle}</div>

      <div class="section-title">Task Details</div>
      <div class="grid">
        <div class="grid-row">
          <div class="grid-label">Project:</div>
          <div class="grid-value"><strong>${this.escapeHtml(params.projectName || "General (No Project)")}</strong></div>
        </div>
        <div class="grid-row">
          <div class="grid-label">Priority:</div>
          <div class="grid-value">${priorityBadge}</div>
        </div>
        <div class="grid-row">
          <div class="grid-label">Status:</div>
          <div class="grid-value">${statusLabel}</div>
        </div>
        <div class="grid-row">
          <div class="grid-label">Due Date:</div>
          <div class="grid-value">${dueDateStr}</div>
        </div>
        <div class="grid-row">
          <div class="grid-label">Story Points:</div>
          <div class="grid-value">${pointsStr}</div>
        </div>
        <div class="grid-row">
          <div class="grid-label">Assigned By:</div>
          <div class="grid-value">${this.escapeHtml(params.assignerName)}</div>
        </div>
      </div>

      <div class="section-title">Description</div>
      <div class="desc-box">
        ${escapedDesc}
      </div>

      <div class="btn-container">
        <a href="${params.taskUrl}" class="btn" target="_blank" rel="noopener noreferrer">View Task in CRM</a>
      </div>
    </div>
    <div class="footer">
      This is an automated notification from Venus Consultancy CRM.<br/>
      You received this because you were assigned to a task. Reply directly to this email to reach ${this.escapeHtml(params.assignerName)}.
    </div>
  </div>
</body>
</html>`;
  }

  private formatPriorityBadge(priority: TaskPriority): string {
    const p = String(priority).toUpperCase();
    if (p === "URGENT") {
      return `<span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;">URGENT</span>`;
    }
    if (p === "HIGH") {
      return `<span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;background:#fff7ed;color:#ea580c;border:1px solid #fed7aa;">HIGH</span>`;
    }
    if (p === "MEDIUM") {
      return `<span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;">MEDIUM</span>`;
    }
    return `<span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0;">LOW</span>`;
  }

  private formatStatusLabel(status: TaskStatus): string {
    return String(status)
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private formatDueDate(date?: Date | null): string {
    if (!date) return "No deadline set";
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return "No deadline set";
      return d.toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "No deadline set";
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
