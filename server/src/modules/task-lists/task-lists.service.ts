import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateTaskListDto } from "./dto/create-task-list.dto";
import { UpdateTaskListDto } from "./dto/update-task-list.dto";
import type { RequestUser } from "../../common/types/request-user.type";

const taskListInclude = {
  _count: { select: { tasks: true } },
} as const;

@Injectable()
export class TaskListsService {
  constructor(private readonly prisma: PrismaService) {}

  findAllForProject(projectId: string) {
    return this.prisma.taskList.findMany({
      where: { projectId },
      include: taskListInclude,
      orderBy: { position: "asc" },
    });
  }

  async create(dto: CreateTaskListDto, user: RequestUser) {
    const project = await this.getOwnedProject(dto.projectId);
    this.assertCanMutate(project, user);

    const position = await this.nextPosition(dto.projectId);
    return this.prisma.taskList.create({
      data: { name: dto.name, projectId: dto.projectId, position },
      include: taskListInclude,
    });
  }

  async update(id: string, dto: UpdateTaskListDto, user: RequestUser) {
    const list = await this.getOwnedList(id);
    const project = await this.getOwnedProject(list.projectId);
    this.assertCanMutate(project, user);

    return this.prisma.taskList.update({
      where: { id },
      data: { name: dto.name, position: dto.position },
      include: taskListInclude,
    });
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const list = await this.getOwnedList(id);
    const project = await this.getOwnedProject(list.projectId);
    this.assertCanMutate(project, user);
    // Tasks in this list are NOT deleted -- Task.taskListId just SetNulls
    // (see schema.prisma), same "grouping, not ownership" relationship as
    // Sprint/Epic/Release.
    await this.prisma.taskList.delete({ where: { id } });
  }

  private async nextPosition(projectId: string): Promise<number> {
    const last = await this.prisma.taskList.findFirst({
      where: { projectId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }

  private async getOwnedList(id: string) {
    const list = await this.prisma.taskList.findUnique({ where: { id } });
    if (!list) {
      throw new NotFoundException("Task list not found");
    }
    return list;
  }

  private async getOwnedProject(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundException("Project not found");
    }
    return project;
  }

  // Same ACL shape as ProjectsService.assertCanMutate -- a task list is
  // managed by whoever can manage its parent project.
  private assertCanMutate(project: { ownerId: string; departmentId: string | null }, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const isOwner = project.ownerId === user.id;
    const isDeptManager =
      user.role.name === RoleName.MANAGER &&
      (project.departmentId === null || project.departmentId === user.department?.id);
    if (!isAdmin && !isOwner && !isDeptManager) {
      throw new ForbiddenException("You do not have permission to modify this project's task lists");
    }
  }
}
