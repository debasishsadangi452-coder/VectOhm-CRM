import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { ProjectStatus, RoleName } from "@prisma/client";
import { ProjectsService } from "./projects.service";
import type { RequestUser } from "../../common/types/request-user.type";

function buildPrismaMock() {
  return {
    project: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };
}

function buildUser(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: "user-1",
    email: "dev@company.com",
    firstName: "Dev",
    lastName: "One",
    role: { id: "role-1", name: RoleName.EMPLOYEE },
    department: { id: "dept-dev", name: "Development", managerTitle: "Dev Lead" },
    ...overrides,
  };
}

const admin = () =>
  buildUser({ id: "admin-1", role: { id: "r-admin", name: RoleName.ADMIN }, department: null });

const devManager = (id = "mgr-dev") =>
  buildUser({
    id,
    role: { id: "r-mgr", name: RoleName.MANAGER },
    department: { id: "dept-dev", name: "Development", managerTitle: "Dev Lead" },
  });

const nonDevManager = () =>
  buildUser({
    id: "mgr-sales",
    role: { id: "r-mgr", name: RoleName.MANAGER },
    department: { id: "dept-sales", name: "Sales", managerTitle: "Sales Manager" },
  });

const devEmployee = (id = "dev-emp-1") =>
  buildUser({
    id,
    role: { id: "r-emp", name: RoleName.EMPLOYEE },
    department: { id: "dept-dev", name: "Development", managerTitle: "Dev Lead" },
  });

describe("ProjectsService - Development Manager & Project Administration Unit Tests", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let githubService: {
    createRepoForProject: jest.Mock;
    inviteCollaborator: jest.Mock;
    removeCollaborator: jest.Mock;
    repoNameFromUrl: jest.Mock;
  };
  let service: ProjectsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = buildPrismaMock();
    githubService = {
      createRepoForProject: jest.fn().mockResolvedValue(null),
      inviteCollaborator: jest.fn().mockResolvedValue(true),
      removeCollaborator: jest.fn().mockResolvedValue(true),
      repoNameFromUrl: jest.fn().mockReturnValue("org/repo"),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new ProjectsService(prisma as any, githubService as any);
  });

  describe("1. Visibility Scope (findAll)", () => {
    it("ADMIN can view all projects", async () => {
      prisma.project.findMany.mockResolvedValue([]);
      await service.findAll({}, admin());
      const where = prisma.project.findMany.mock.calls[0][0].where;
      expect(where.departmentId).toBeUndefined();
    });

    it("DEV MANAGER is scoped to their department and sees all department projects", async () => {
      prisma.project.findMany.mockResolvedValue([]);
      await service.findAll({}, devManager());
      const where = prisma.project.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([{ departmentId: "dept-dev" }, { departmentId: null }]);
    });

    it("NON-DEV user is rejected (403 Forbidden)", () => {
      expect(() => service.findAll({}, nonDevManager())).toThrow(
        new ForbiddenException("Access denied: You do not have access to Development projects"),
      );
    });

    it("DEV EMPLOYEE sees projects they own, are member of, or have tasks in", async () => {
      prisma.project.findMany.mockResolvedValue([]);
      await service.findAll({}, devEmployee("dev-1"));
      const where = prisma.project.findMany.mock.calls[0][0].where;
      expect(where.departmentId).toBeUndefined();
      expect(where.OR).toEqual([
        { ownerId: "dev-1" },
        { members: { some: { id: "dev-1" } } },
        {
          tasks: {
            some: {
              OR: [
                { assigneeId: "dev-1" },
                { assignees: { some: { userId: "dev-1" } } },
                { testerId: "dev-1" },
                { creatorId: "dev-1" },
                {
                  subtasks: {
                    some: {
                      OR: [
                        { assigneeId: "dev-1" },
                        { assignees: { some: { userId: "dev-1" } } },
                        { testerId: "dev-1" },
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
      ]);
    });
  });

  describe("2. Project Creation & Detail (create / findOne)", () => {
    it("DEV MANAGER can create project with assigned ownerId", async () => {
      prisma.project.create.mockResolvedValue({
        id: "p-new",
        name: "Venus 2.0",
        ownerId: "dev-lead-1",
        departmentId: "dept-dev",
      });

      const res = await service.create(
        {
          name: "Venus 2.0",
          ownerId: "dev-lead-1",
          departmentId: "dept-dev",
        },
        devManager(),
      );

      expect(prisma.project.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "Venus 2.0",
          ownerId: "dev-lead-1",
          departmentId: "dept-dev",
        }),
        include: expect.any(Object),
      });
      expect(res.id).toBe("p-new");
    });

    it("DEV MANAGER can view any project in their department", async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: "p-1",
        name: "Enterprise Core",
        departmentId: "dept-dev",
        members: [],
      });
      const res = await service.findOne("p-1", devManager());
      expect(res.id).toBe("p-1");
    });

    it("DEV MANAGER cannot view project from other department (403 Forbidden)", async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: "p-sales",
        name: "Sales Outreach",
        departmentId: "dept-sales",
        members: [],
      });
      await expect(service.findOne("p-sales", devManager())).rejects.toThrow(
        new ForbiddenException("Access denied: This project belongs to another department"),
      );
    });
  });

  describe("3. Project Member Management by Manager (addMember / removeMember)", () => {
    it("Dev Manager can add team member to project and send GitHub invite", async () => {
      prisma.project.findUnique
        .mockResolvedValueOnce({
          id: "p-1",
          ownerId: "other-dev",
          departmentId: "dept-dev",
          githubUrl: "https://github.com/org/repo",
        })
        .mockResolvedValueOnce({
          id: "p-1",
          name: "Enterprise Core",
          departmentId: "dept-dev",
          members: [{ id: "dev-2", firstName: "Alice", githubUsername: "alice-dev" }],
        });

      prisma.user.findUnique.mockResolvedValue({
        id: "dev-2",
        firstName: "Alice",
        githubUsername: "alice-dev",
      });
      prisma.project.update.mockResolvedValue({});

      const res = await service.addMember("p-1", "dev-2", devManager());

      expect(res.githubInvited).toBe(true);
      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id: "p-1" },
        data: { members: { connect: { id: "dev-2" } } },
      });
    });

    it("Dev Manager can remove team member from project", async () => {
      prisma.project.findUnique
        .mockResolvedValueOnce({
          id: "p-1",
          ownerId: "other-dev",
          departmentId: "dept-dev",
          githubUrl: "https://github.com/org/repo",
        })
        .mockResolvedValueOnce({
          id: "p-1",
          name: "Enterprise Core",
          departmentId: "dept-dev",
          members: [],
        });

      prisma.user.findUnique.mockResolvedValue({
        id: "dev-2",
        githubUsername: "alice-dev",
      });
      prisma.project.update.mockResolvedValue({});

      await service.removeMember("p-1", "dev-2", devManager());

      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id: "p-1" },
        data: { members: { disconnect: { id: "dev-2" } } },
      });
      expect(githubService.removeCollaborator).toHaveBeenCalledWith("org/repo", "alice-dev");
    });
  });

  describe("4. Project Archival (archive)", () => {
    it("Dev Manager can archive a project in their department", async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: "p-1",
        ownerId: "dev-1",
        departmentId: "dept-dev",
      });
      prisma.project.update.mockResolvedValue({ id: "p-1", status: ProjectStatus.ARCHIVED });

      const res = await service.archive("p-1", devManager());
      expect(res.status).toBe(ProjectStatus.ARCHIVED);
    });

    it("Non-manager non-owner employee cannot archive a project (403 Forbidden)", async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: "p-1",
        ownerId: "dev-2",
        departmentId: "dept-dev",
      });

      await expect(service.archive("p-1", devEmployee("dev-1"))).rejects.toThrow(
        new ForbiddenException("You do not have permission to modify this project"),
      );
    });
  });
});
