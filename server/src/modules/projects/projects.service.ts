import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ProjectStatus, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { GithubService } from "../github-integration/github.service";
import type { RequestUser } from "../../common/types/request-user.type";

const projectInclude = {
  owner: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  _count: { select: { tasks: true } },
} as const;

const memberSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  githubUsername: true,
} as const;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly githubService: GithubService,
  ) {}

  findAll(filters: { status?: ProjectStatus; ownerId?: string; departmentId?: string }, user: RequestUser) {
    return this.prisma.project.findMany({
      where: {
        status: filters.status,
        ownerId: filters.ownerId,
        ...this.visibilityScope(user, filters.departmentId),
      },
      include: projectInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  private visibilityScope(user: RequestUser, requestedDepartmentId?: string) {
    if (user.role.name === RoleName.ADMIN) {
      return requestedDepartmentId ? { departmentId: requestedDepartmentId } : {};
    }
    const isDev = (user.department?.name || "").toLowerCase().includes("dev");
    if (!isDev) {
      throw new ForbiddenException("Access denied: You do not have access to Development projects");
    }
    if (user.role.name === RoleName.MANAGER) {
      // A manager with no department only sees unscoped projects, never all of them.
      return user.department?.id
        ? { OR: [{ departmentId: user.department.id }, { departmentId: null }] }
        : { departmentId: null };
    }
    // Dev Employee: only assigned/member projects, owned projects, or projects with tasks assigned to them
    return {
      ...(requestedDepartmentId ? { departmentId: requestedDepartmentId } : {}),
      OR: [
        { ownerId: user.id },
        { members: { some: { id: user.id } } },
        {
          tasks: {
            some: {
              OR: [
                { assigneeId: user.id },
                { assignees: { some: { userId: user.id } } },
                { testerId: user.id },
                { creatorId: user.id },
                {
                  subtasks: {
                    some: {
                      OR: [
                        { assigneeId: user.id },
                        { assignees: { some: { userId: user.id } } },
                        { testerId: user.id },
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
      ],
    };
  }

  async findOne(id: string, user?: RequestUser) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        ...projectInclude,
        members: { select: memberSelect, orderBy: { firstName: "asc" } },
        tasks: {
          include: {
            assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
            assignees: { include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } } },
            taskList: { select: { id: true, name: true } },
            timeLogs: { select: { minutes: true } },
            subtasks: {
              select: {
                id: true,
                assigneeId: true,
                testerId: true,
                assignees: { select: { userId: true } },
              },
            },
            // Latest progress note only, so a Kanban card can show "what
            // happened most recently" at a glance without opening the task.
            updates: {
              take: 1,
              orderBy: { createdAt: "desc" },
              include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
            },
          },
          orderBy: { position: "asc" },
        },
        taskLists: { include: { _count: { select: { tasks: true } } }, orderBy: { position: "asc" } },
      },
    });
    if (!project) {
      throw new NotFoundException("Project not found");
    }
    if (user && user.role.name !== RoleName.ADMIN) {
      const isDev = (user.department?.name || "").toLowerCase().includes("dev");
      if (!isDev) {
        throw new ForbiddenException("Access denied: You do not have access to Development projects");
      }
      if (user.role.name === RoleName.MANAGER && project.departmentId && project.departmentId !== user.department?.id) {
        throw new ForbiddenException("Access denied: This project belongs to another department");
      }
      if (user.role.name === RoleName.EMPLOYEE) {
        const isMember = project.members.some((m) => m.id === user.id);
        const isOwner = project.ownerId === user.id;
        const hasAssignedTask = project.tasks.some(
          (t) =>
            t.assigneeId === user.id ||
            t.testerId === user.id ||
            t.creatorId === user.id ||
            t.assignees?.some((a) => a.userId === user.id || (a as any).user?.id === user.id) ||
            (t as any).subtasks?.some(
              (st: any) =>
                st.assigneeId === user.id ||
                st.testerId === user.id ||
                st.assignees?.some((a: any) => a.userId === user.id),
            ),
        );
        if (!isMember && !isOwner && !hasAssignedTask) {
          throw new ForbiddenException("Access denied: You are not assigned to this project");
        }
      }
    }
    return project;
  }

  async create(dto: CreateProjectDto, owner: RequestUser) {
    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        status: dto.status ?? ProjectStatus.ACTIVE,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        ownerId: dto.ownerId ?? owner.id,
        departmentId: dto.departmentId ?? owner.department?.id,
        // githubUrl is intentionally NOT taken from the DTO -- it's set below
        // from the repo the app actually creates, not free-text client input.
        projectPassword: dto.projectPassword,
      },
      include: projectInclude,
    });

    // Best-effort: if GitHub is connected, auto-create a private repo and
    // store its URL. Any GitHub failure is swallowed inside the service and
    // returns null -- the project already exists and must not be rolled back.
    const repo = await this.githubService.createRepoForProject(project.name, project.description);
    if (repo) {
      return this.prisma.project.update({
        where: { id: project.id },
        data: { githubUrl: repo.htmlUrl },
        include: projectInclude,
      });
    }

    return project;
  }

  async update(id: string, dto: UpdateProjectDto, user: RequestUser) {
    const project = await this.getOwned(id);
    this.assertCanMutate(project, user);

    return this.prisma.project.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        status: dto.status,
        startDate: dto.startDate === undefined ? undefined : dto.startDate ? new Date(dto.startDate) : null,
        dueDate: dto.dueDate === undefined ? undefined : dto.dueDate ? new Date(dto.dueDate) : null,
        ownerId: dto.ownerId,
        departmentId: dto.departmentId,
        githubUrl: dto.githubUrl,
        projectPassword: dto.projectPassword,
      },
      include: projectInclude,
    });
  }

  // Soft-archive rather than delete -- keeps task history intact.
  async archive(id: string, user: RequestUser) {
    const project = await this.getOwned(id);
    this.assertCanMutate(project, user);

    return this.prisma.project.update({
      where: { id },
      data: { status: ProjectStatus.ARCHIVED },
      include: projectInclude,
    });
  }

  async remove(id: string, user: RequestUser) {
    const project = await this.getOwned(id);
    this.assertCanMutate(project, user);

    return this.prisma.project.delete({
      where: { id },
    });
  }

  // Adds a Venus CRM user as a project member, and -- if the project has a repo
  // and the member has linked their GitHub username -- invites them to the
  // repo as a collaborator (best-effort). githubInvited reflects whether that
  // invite call succeeded so the UI can show it.
  async addMember(projectId: string, userId: string, actor: RequestUser) {
    const project = await this.getOwned(projectId);
    this.assertCanMutate(project, actor);

    const member = await this.prisma.user.findUnique({
      where: { id: userId },
      select: memberSelect,
    });
    if (!member) {
      throw new NotFoundException("User not found");
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: { members: { connect: { id: userId } } },
    });

    let githubInvited = false;
    const repoName = this.githubService.repoNameFromUrl(project.githubUrl);
    if (repoName && member.githubUsername) {
      githubInvited = await this.githubService.inviteCollaborator(repoName, member.githubUsername);
    }

    return { githubInvited, project: await this.findOne(projectId) };
  }

  async removeMember(projectId: string, userId: string, actor: RequestUser) {
    const project = await this.getOwned(projectId);
    this.assertCanMutate(project, actor);

    const member = await this.prisma.user.findUnique({
      where: { id: userId },
      select: memberSelect,
    });

    await this.prisma.project.update({
      where: { id: projectId },
      data: { members: { disconnect: { id: userId } } },
    });

    const repoName = this.githubService.repoNameFromUrl(project.githubUrl);
    if (repoName && member?.githubUsername) {
      await this.githubService.removeCollaborator(repoName, member.githubUsername);
    }

    return this.findOne(projectId);
  }

  private async getOwned(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundException("Project not found");
    }
    return project;
  }

  // TODO: revisit ACL model -- owner, ADMIN, or a same-department MANAGER
  // only, for now. See TasksService.assertCanMutate for the full rationale
  // (phase 6): MANAGER privilege is scoped to their own department; ADMIN
  // stays a global override; departmentId === null (legacy/unscoped) is
  // manageable by any MANAGER.
  private assertCanMutate(project: { ownerId: string; departmentId: string | null }, user: RequestUser) {
    if (user.role.name === RoleName.ADMIN) return;
    const isDev = (user.department?.name || "").toLowerCase().includes("dev");
    if (!isDev) {
      throw new ForbiddenException("Access denied: You do not belong to the Development department");
    }
    const isOwner = project.ownerId === user.id;
    const isDeptManager =
      user.role.name === RoleName.MANAGER &&
      (project.departmentId === user.department?.id || project.departmentId === null);
    if (!isOwner && !isDeptManager) {
      throw new ForbiddenException("You do not have permission to modify this project");
    }
  }
}
