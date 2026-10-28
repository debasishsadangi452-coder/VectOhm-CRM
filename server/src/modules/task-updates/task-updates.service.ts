import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { NotificationType, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateTaskUpdateDto } from "./dto/create-task-update.dto";
import type { RequestUser } from "../../common/types/request-user.type";
import { NotificationsService } from "../notifications/notifications.service";

const taskUpdateInclude = {
  user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
} as const;

@Injectable()
export class TaskUpdatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async findAllForTask(taskId: string, user: RequestUser) {
    const task = await this.getOwned(taskId);
    this.assertCanView(task, user);

    return this.prisma.taskUpdate.findMany({
      where: { taskId },
      include: taskUpdateInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  // Recent updates across every task in a sprint, for the sprint board's
  // activity feed -- same department-scoped visibility as Task/Sprint reads.
  async findForSprint(sprintId: string, user: RequestUser) {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id: sprintId },
      select: { id: true, departmentId: true },
    });
    if (!sprint) {
      throw new NotFoundException("Sprint not found");
    }

    const isAdmin = user.role.name === RoleName.ADMIN;
    const inScope = sprint.departmentId === null || sprint.departmentId === user.department?.id;
    if (!isAdmin && !inScope) {
      throw new ForbiddenException("Access denied");
    }

    return this.prisma.taskUpdate.findMany({
      where: { task: { sprintId } },
      include: {
        ...taskUpdateInclude,
        task: { select: { id: true, taskNumber: true, title: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  // Recent updates across every task in a project, for the project detail
  // page's own "Daily Updates" feed -- same shape/scoping as findForSprint.
  async findForProject(projectId: string, user: RequestUser) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, departmentId: true },
    });
    if (!project) {
      throw new NotFoundException("Project not found");
    }

    const isAdmin = user.role.name === RoleName.ADMIN;
    const inScope = project.departmentId === null || project.departmentId === user.department?.id;
    if (!isAdmin && !inScope) {
      throw new ForbiddenException("Access denied");
    }

    return this.prisma.taskUpdate.findMany({
      where: { task: { projectId } },
      include: {
        ...taskUpdateInclude,
        task: { select: { id: true, taskNumber: true, title: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  // Recent updates across every task in a department, for the /tasks "Daily
  // Updates" tab -- same department-scoped visibility as findForSprint, but
  // scoped directly by department (no parent entity to resolve first) and
  // following this app's standard "Admin unscoped by default" convention
  // (same shape as TasksService's own visibilityScope).
  async findForDepartment(departmentId: string | undefined, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;

    if (isAdmin && !departmentId) {
      return this.prisma.taskUpdate.findMany({
        include: { ...taskUpdateInclude, task: { select: { id: true, title: true, status: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
    }

    const targetDepartmentId = departmentId ?? user.department?.id;
    // Without a department id the filter below would be `undefined`, which
    // Prisma drops -- returning every department's updates.
    if (!targetDepartmentId || (!isAdmin && targetDepartmentId !== user.department?.id)) {
      throw new ForbiddenException("Access denied");
    }

    return this.prisma.taskUpdate.findMany({
      where: { task: { OR: [{ departmentId: null }, { departmentId: targetDepartmentId }] } },
      include: { ...taskUpdateInclude, task: { select: { id: true, title: true, status: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async create(dto: CreateTaskUpdateDto, user: RequestUser) {
    const task = await this.getOwned(dto.taskId);
    this.assertCanPost(task, user);

    const update = await this.prisma.taskUpdate.create({
      data: {
        taskId: dto.taskId,
        userId: user.id,
        content: dto.content,
      },
      include: taskUpdateInclude,
    });

    // Notify task assignees, creator, and tester about the update
    try {
      const targetUserIds = new Set<string>();
      if (task.assigneeId) targetUserIds.add(task.assigneeId);
      if (task.creatorId) targetUserIds.add(task.creatorId);
      if (task.testerId) targetUserIds.add(task.testerId);
      task.assignees?.forEach((a) => targetUserIds.add(a.userId));
      targetUserIds.delete(user.id);
      const panelLink = `/tasks?taskId=${task.id}`;
      const snippet = dto.content.length > 80 ? dto.content.slice(0, 80) + "..." : dto.content;

      for (const targetId of targetUserIds) {
        await this.notifications.create({
          userId: targetId,
          type: NotificationType.TASK_UPDATED,
          title: `Update on Task #${task.taskNumber || ''}: "${task.title}"`,
          message: `${user.firstName} ${user.lastName}: ${snippet}`,
          link: panelLink,
        });
      }
    } catch (err) {
      console.error("Failed to push task update notification:", err);
    }

    return update;
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const update = await this.prisma.taskUpdate.findUnique({
      where: { id },
      include: { task: { select: { departmentId: true } } },
    });
    if (!update) {
      throw new NotFoundException("Task update not found");
    }

    const isAdmin = user.role.name === RoleName.ADMIN;
    const isAuthor = update.userId === user.id;
    const isDeptManager =
      user.role.name === RoleName.MANAGER &&
      (update.task.departmentId === null || update.task.departmentId === user.department?.id);

    if (!isAdmin && !isAuthor && !isDeptManager) {
      throw new ForbiddenException("You do not have permission to delete this update");
    }

    await this.prisma.taskUpdate.delete({ where: { id } });
  }

  private async getOwned(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        taskNumber: true,
        title: true,
        sprintId: true,
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
    return task;
  }

  // Same department-scoped read visibility as Task itself -- anyone in the
  // task's department (or a legacy unscoped task, or assigned contributor) can see its update log.
  private assertCanView(
    task: {
      departmentId: string | null;
      assigneeId?: string | null;
      creatorId?: string;
      testerId?: string | null;
      assignees?: { userId: string }[];
    },
    user: RequestUser,
  ) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const isAssignee =
      task.creatorId === user.id ||
      task.assigneeId === user.id ||
      task.testerId === user.id ||
      task.assignees?.some((a) => a.userId === user.id);
    const inScope = task.departmentId === null || task.departmentId === user.department?.id || isAssignee;
    if (!isAdmin && !inScope) {
      throw new ForbiddenException("Access denied");
    }
  }

  // Allow any employee or manager in the task's department scope, assignees/creators/testers, or admin to submit updates
  private assertCanPost(
    task: {
      assigneeId: string | null;
      creatorId: string;
      departmentId: string | null;
      testerId?: string | null;
      assignees?: { userId: string }[];
    },
    user: RequestUser,
  ) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const isAssignee =
      task.creatorId === user.id ||
      task.assigneeId === user.id ||
      task.testerId === user.id ||
      task.assignees?.some((a) => a.userId === user.id);
    const inScope =
      task.departmentId === null ||
      task.departmentId === user.department?.id ||
      isAssignee;
    if (!isAdmin && !inScope) {
      throw new ForbiddenException("You do not have permission to post updates on this task");
    }
  }
}
