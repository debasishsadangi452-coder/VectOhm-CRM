import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { NotificationType, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateSprintDto } from "./dto/create-sprint.dto";
import { UpdateSprintDto } from "./dto/update-sprint.dto";
import type { RequestUser } from "../../common/types/request-user.type";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class SprintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async findAll(user: RequestUser, projectId?: string) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const departmentId = user.department?.id;

    if (!isAdmin && !departmentId) {
      return [];
    }

    const where: Record<string, unknown> = isAdmin ? {} : { departmentId };
    if (projectId) {
      where.projectId = projectId;
    }

    return this.prisma.sprint.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        tasks: {
          include: {
            assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { startDate: "desc" },
    });
  }

  async findOne(id: string, user: RequestUser) {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true } },
        tasks: {
          include: {
            assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!sprint) {
      throw new NotFoundException("Sprint not found");
    }

    const isAdmin = user.role.name === RoleName.ADMIN;
    if (!isAdmin && sprint.departmentId !== user.department?.id) {
      throw new ForbiddenException("You do not have access to this department's sprints");
    }

    return sprint;
  }

  async create(dto: CreateSprintDto, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const departmentId = dto.departmentId ?? user.department?.id;

    if (!departmentId) {
      throw new ForbiddenException("Sprints must belong to a specific department");
    }

    if (!isAdmin && departmentId !== user.department?.id) {
      throw new ForbiddenException("You cannot create a sprint for another department");
    }

    // If activating this sprint, ensure we transition others first
    if (dto.status === "ACTIVE") {
      await this.prisma.sprint.updateMany({
        where: { departmentId, status: "ACTIVE" },
        data: { status: "COMPLETED" },
      });
    }

    const sprint = await this.prisma.sprint.create({
      data: {
        name: dto.name,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        status: dto.status,
        departmentId,
        projectId: dto.projectId || null,
      },
      include: {
        project: { select: { id: true, name: true } },
        tasks: true,
      },
    });

    // Notify department members about new sprint
    try {
      const deptMembers = await this.prisma.user.findMany({
        where: { departmentId, isActive: true, id: { not: user.id } },
        select: { id: true },
      });
      for (const m of deptMembers) {
        await this.notifications.create({
          userId: m.id,
          type: NotificationType.GENERAL,
          title: `New Sprint Created: "${sprint.name}"`,
          message: `${user.firstName} ${user.lastName} created a new sprint (${sprint.status}).`,
          link: "/dev",
        });
      }
    } catch (err) {
      console.error("Failed to push sprint notification:", err);
    }

    return sprint;
  }

  async update(id: string, dto: UpdateSprintDto, user: RequestUser) {
    const sprint = await this.findOne(id, user);
    this.assertCanMutate(sprint, user);
    const departmentId = sprint.departmentId;

    if (dto.status === "ACTIVE" && sprint.status !== "ACTIVE") {
      // Deactivate other sprints
      await this.prisma.sprint.updateMany({
        where: { departmentId, status: "ACTIVE" },
        data: { status: "COMPLETED" },
      });
    }

    const updated = await this.prisma.sprint.update({
      where: { id },
      data: {
        name: dto.name,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        status: dto.status,
      },
      include: { tasks: true },
    });

    if (dto.status && dto.status !== sprint.status) {
      try {
        const deptMembers = await this.prisma.user.findMany({
          where: { departmentId, isActive: true, id: { not: user.id } },
          select: { id: true },
        });
        for (const m of deptMembers) {
          await this.notifications.create({
            userId: m.id,
            type: NotificationType.GENERAL,
            title: `Sprint Status: "${updated.name}" is now ${updated.status}`,
            message: `${user.firstName} ${user.lastName} changed sprint status to ${updated.status}.`,
            link: "/dev",
          });
        }
      } catch (err) {
        console.error("Failed to push sprint update notification:", err);
      }
    }

    return updated;
  }

  async assignTasks(id: string, taskIds: string[], user: RequestUser) {
    const sprint = await this.findOne(id, user);

    // Filter task list to ensure tasks belong to this department (or legacy NULL)
    const tasks = await this.prisma.task.findMany({
      where: {
        id: { in: taskIds },
        OR: [{ departmentId: null }, { departmentId: sprint.departmentId }],
      },
    });

    if (tasks.length !== taskIds.length) {
      throw new ForbiddenException("Some tasks do not exist or belong to another department");
    }

    // Assign tasks to the sprint
    await this.prisma.task.updateMany({
      where: { id: { in: taskIds } },
      data: { sprintId: id },
    });

    return this.findOne(id, user);
  }

  // Sprints have no individual owner/creator, so unlike Tasks/Deals there's
  // no owner-self-mutate branch -- only Admin or the sprint's own department
  // Manager may edit it (e.g. activating a sprint force-completes every other
  // active sprint in the department, too broad an effect for any EMPLOYEE).
  private assertCanMutate(sprint: { departmentId: string }, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const isDeptManager =
      user.role.name === RoleName.MANAGER && sprint.departmentId === user.department?.id;
    if (!isAdmin && !isDeptManager) {
      throw new ForbiddenException("Only a Manager or Admin can modify sprints");
    }
  }
}
