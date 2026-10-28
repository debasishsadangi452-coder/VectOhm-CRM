import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { BugPriority, BugSeverity, BugStatus, RoleName, TaskPriority, TaskStatus, TaskType } from "@prisma/client";
import { TasksService } from "./tasks.service";
import type { RequestUser } from "../../common/types/request-user.type";

function buildPrismaMock() {
  return {
    task: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    taskAssignee: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    taskActivityLog: {
      create: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn().mockResolvedValue([]),
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

const devTester = (id = "dev-tester-1") =>
  buildUser({
    id,
    role: { id: "r-emp", name: RoleName.EMPLOYEE },
    department: { id: "dept-dev", name: "Development", managerTitle: "Dev Lead" },
  });

describe("TasksService - Development Manager & Team Strict Unit Tests", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let notifications: { create: jest.Mock };
  let engagementEvents: { record: jest.Mock };
  let service: TasksService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = buildPrismaMock();
    notifications = { create: jest.fn().mockResolvedValue({}) };
    engagementEvents = { record: jest.fn().mockResolvedValue({}) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new TasksService(prisma as any, notifications as any, engagementEvents as any);
  });

  describe("1. Department Scoping & Visibility (findAll)", () => {
    it("ADMIN can view all tasks across all departments without filter", async () => {
      prisma.task.findMany.mockResolvedValue([]);
      await service.findAll({}, admin());
      const where = prisma.task.findMany.mock.calls[0][0].where;
      expect(where.departmentId).toBeUndefined();
    });

    it("DEV MANAGER sees their Development department's tasks", async () => {
      prisma.task.findMany.mockResolvedValue([]);
      await service.findAll({}, devManager());
      const where = prisma.task.findMany.mock.calls[0][0].where;
      expect(where.AND).toEqual(
        expect.arrayContaining([
          { OR: expect.arrayContaining([{ departmentId: "dept-dev" }]) },
        ]),
      );
    });

    it("SALES MANAGER is scoped to their department", async () => {
      prisma.task.findMany.mockResolvedValue([]);
      await service.findAll({}, nonDevManager());
      const where = prisma.task.findMany.mock.calls[0][0].where;
      expect(where.AND).toEqual(
        expect.arrayContaining([
          { OR: expect.arrayContaining([{ departmentId: "dept-sales" }]) },
        ]),
      );
    });

    it("EMPLOYEE strictly sees only tasks they are involved in, never the whole department", async () => {
      prisma.task.findMany.mockResolvedValue([]);
      const emp = devEmployee("dev-1");
      await service.findAll({}, emp);
      const where = prisma.task.findMany.mock.calls[0][0].where;
      expect(where.AND).toEqual(
        expect.arrayContaining([
          {
            OR: [
              { assigneeId: "dev-1" },
              { assignees: { some: { userId: "dev-1" } } },
              { testerId: "dev-1" },
              { creatorId: "dev-1" },
              { subtasks: { some: { assigneeId: "dev-1" } } },
            ],
          },
        ]),
      );
    });
  });

  describe("2. Task Detail Permissions (findOne)", () => {
    it("Throws 404 NotFoundException if task does not exist", async () => {
      prisma.task.findUnique.mockResolvedValue(null);
      await expect(service.findOne("non-existent-id", devManager())).rejects.toThrow(
        new NotFoundException("Task not found"),
      );
    });

    it("DEV MANAGER can view any task in their department", async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: "task-1",
        title: "Build API",
        departmentId: "dept-dev",
      });
      const result = await service.findOne("task-1", devManager());
      expect(result).toBeDefined();
      expect(result.id).toBe("task-1");
    });

    it("DEV MANAGER cannot view a task belonging to another department (403 Forbidden)", async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: "task-other",
        title: "Sales Task",
        departmentId: "dept-sales",
      });
      await expect(service.findOne("task-other", devManager())).rejects.toThrow(
        new ForbiddenException("Access denied: You do not have permission to view this task"),
      );
    });

    it("DEV EMPLOYEE cannot view an unassigned task even in their own department (403 Forbidden)", async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: "task-1",
        title: "Confidential Project Arch",
        departmentId: "dept-dev",
        assigneeId: "other-user",
        assignees: [],
        testerId: "tester-99",
        creatorId: "mgr-dev",
        subtasks: [],
      });
      await expect(service.findOne("task-1", devEmployee("dev-1"))).rejects.toThrow(
        new ForbiddenException("Access denied: You do not have permission to view this task"),
      );
    });

    it("DEV EMPLOYEE cannot view an unassigned task in another department (403 Forbidden)", async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: "task-other",
        title: "Sales Task",
        departmentId: "dept-sales",
        assigneeId: "other-user",
        assignees: [],
        testerId: "tester-99",
        creatorId: "mgr-sales",
        subtasks: [],
      });
      await expect(service.findOne("task-other", devEmployee("dev-1"))).rejects.toThrow(
        new ForbiddenException("Access denied: You do not have permission to view this task"),
      );
    });
  });

  describe("3. Task Creation & Role Checks (create)", () => {
    it("DEV MANAGER can create a task in any status including DONE", async () => {
      prisma.task.findFirst.mockResolvedValue({ position: 2 });
      prisma.task.create.mockResolvedValue({
        id: "task-new",
        title: "Setup CI/CD",
        status: TaskStatus.DONE,
        departmentId: "dept-dev",
      });
      prisma.task.findUnique.mockResolvedValue({
        id: "task-new",
        title: "Setup CI/CD",
        status: TaskStatus.DONE,
      });

      const result = await service.create(
        {
          title: "Setup CI/CD",
          status: TaskStatus.DONE,
        },
        devManager(),
      );

      expect(result).toBeDefined();
      expect(prisma.task.create).toHaveBeenCalled();
    });

    it("DEV EMPLOYEE is forbidden from creating a task directly in DONE status", async () => {
      await expect(
        service.create(
          {
            title: "Quick Fix",
            status: TaskStatus.DONE,
          },
          devEmployee(),
        ),
      ).rejects.toThrow(
        new ForbiddenException("Only a manager, admin, or tester can complete a task."),
      );
    });

    it("Creates multi-assignees and dispatches notifications to assignees", async () => {
      prisma.task.findFirst.mockResolvedValue(null);
      prisma.task.create.mockResolvedValue({
        id: "task-multi",
        title: "Refactor Auth",
        status: TaskStatus.TODO,
        creatorId: "mgr-1",
      });
      prisma.task.findUnique.mockResolvedValue({ id: "task-multi", title: "Refactor Auth" });

      await service.create(
        {
          title: "Refactor Auth",
          assigneeIds: ["dev-1", "dev-2"],
        },
        devManager("mgr-1"),
      );

      expect(prisma.taskAssignee.createMany).toHaveBeenCalledWith({
        data: [
          { taskId: "task-multi", userId: "dev-1" },
          { taskId: "task-multi", userId: "dev-2" },
        ],
        skipDuplicates: true,
      });
      expect(notifications.create).toHaveBeenCalledTimes(2);
    });
  });

  describe("4. Task Completion Validation Rules (Status -> DONE)", () => {
    const baseTaskRecord = {
      id: "t-1",
      title: "Core Engine",
      status: TaskStatus.READY_FOR_TESTING,
      parentId: null,
      testerId: "tester-1",
      creatorId: "dev-1",
      assigneeId: "dev-1",
      departmentId: "dept-dev",
    };

    beforeEach(() => {
      prisma.task.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
        if (where.id === "t-1") {
          return Promise.resolve(baseTaskRecord);
        }
        return Promise.resolve(null);
      });
    });

    it("Developer cannot directly change status to DONE (403 Forbidden)", async () => {
      prisma.task.findUnique.mockResolvedValue(baseTaskRecord);

      await expect(
        service.update("t-1", { status: TaskStatus.DONE }, devEmployee("dev-1")),
      ).rejects.toThrow(
        new ForbiddenException(
          "Developers cannot directly mark a task as Completed. Please set status to 'Ready for Testing' for Tester validation.",
        ),
      );
    });

    it("Manager cannot complete task if 0 Daily Work Updates logged (Rule 1)", async () => {
      prisma.task.findUnique
        .mockResolvedValueOnce(baseTaskRecord) // for getOwned
        .mockResolvedValueOnce({
          ...baseTaskRecord,
          updates: [], // 0 updates
          timeLogs: [{ id: "tl-1", minutes: 60 }],
          bugs: [],
          subtasks: [],
        }); // for fullTask

      await expect(
        service.update("t-1", { status: TaskStatus.DONE }, devManager()),
      ).rejects.toThrow(
        new BadRequestException("Task cannot be completed until at least one Daily Work Update is logged."),
      );
    });

    it("Manager cannot complete task if 0 Time Logs logged (Rule 2)", async () => {
      prisma.task.findUnique
        .mockResolvedValueOnce(baseTaskRecord) // for getOwned
        .mockResolvedValueOnce({
          ...baseTaskRecord,
          updates: [{ id: "up-1", content: "Done unit tests" }],
          timeLogs: [], // 0 time logs
          bugs: [],
          subtasks: [],
        }); // for fullTask

      await expect(
        service.update("t-1", { status: TaskStatus.DONE }, devManager()),
      ).rejects.toThrow(
        new BadRequestException("Task cannot be completed until at least one Time Log is submitted."),
      );
    });

    it("Manager cannot complete task if open / unresolved bugs exist (Rule 3)", async () => {
      prisma.task.findUnique
        .mockResolvedValueOnce(baseTaskRecord) // for getOwned
        .mockResolvedValueOnce({
          ...baseTaskRecord,
          updates: [{ id: "up-1" }],
          timeLogs: [{ id: "tl-1" }],
          bugs: [
            {
              id: "b-1",
              bugNumber: 101,
              title: "Null pointer on submit",
              status: BugStatus.OPEN,
            },
          ],
          subtasks: [],
        }); // for fullTask

      await expect(
        service.update("t-1", { status: TaskStatus.DONE }, devManager()),
      ).rejects.toThrow(
        new BadRequestException(
          'Cannot complete task! 1 unresolved bug(s) remain: Bug #101 (OPEN): "Null pointer on submit". All bugs must be FIXED or CLOSED first.',
        ),
      );
    });

    it("Manager cannot complete parent task if subtasks are incomplete (Rule 4)", async () => {
      prisma.task.findUnique
        .mockResolvedValueOnce(baseTaskRecord) // for getOwned
        .mockResolvedValueOnce({
          ...baseTaskRecord,
          updates: [{ id: "up-1" }],
          timeLogs: [{ id: "tl-1" }],
          bugs: [],
          subtasks: [
            { id: "st-1", title: "Subtask 1", status: TaskStatus.IN_PROGRESS, updates: [], timeLogs: [], bugs: [] },
          ],
        }); // for fullTask

      await expect(
        service.update("t-1", { status: TaskStatus.DONE }, devManager()),
      ).rejects.toThrow(
        new BadRequestException(
          'Cannot complete parent task! 1 subtask(s) are incomplete: "Subtask 1" (IN_PROGRESS).',
        ),
      );
    });

    it("Manager successfully completes task when all 4 rules pass and records engagement", async () => {
      prisma.task.findUnique
        .mockResolvedValueOnce(baseTaskRecord) // for getOwned
        .mockResolvedValueOnce({
          ...baseTaskRecord,
          updates: [{ id: "up-1" }],
          timeLogs: [{ id: "tl-1" }],
          bugs: [{ id: "b-1", status: BugStatus.CLOSED }],
          subtasks: [
            { id: "st-1", title: "Subtask 1", status: TaskStatus.DONE, updates: [], timeLogs: [], bugs: [] },
          ],
        }); // for fullTask

      prisma.task.update.mockResolvedValue({
        ...baseTaskRecord,
        status: TaskStatus.DONE,
        testingApproved: true,
        assigneeId: "dev-1",
        testerId: "tester-1",
      });

      const updated = await service.update("t-1", { status: TaskStatus.DONE }, devManager("mgr-dev"));

      expect(updated.status).toBe(TaskStatus.DONE);
      expect(engagementEvents.record).toHaveBeenCalledWith({
        type: "TASK_COMPLETED",
        ownerId: "dev-1",
        departmentId: "dept-dev",
      });
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "TASK_UPDATED",
          title: "Task Approved & Completed",
          userId: "dev-1",
        }),
      );
    });

    it("Moving a completed task back to IN_PROGRESS resets testingApproved to false and testingCompletedAt to null", async () => {
      const completedTaskRecord = {
        ...baseTaskRecord,
        status: TaskStatus.DONE,
        testingApproved: true,
        testingCompletedAt: new Date(),
      };

      prisma.task.findUnique.mockResolvedValue(completedTaskRecord);
      prisma.task.update.mockResolvedValue({
        ...completedTaskRecord,
        status: TaskStatus.IN_PROGRESS,
        testingApproved: false,
        testingCompletedAt: null,
      });

      await service.update("t-1", { status: TaskStatus.IN_PROGRESS }, devManager());

      const updateCall = prisma.task.update.mock.calls[0][0];
      expect(updateCall.data.testingApproved).toBe(false);
      expect(updateCall.data.testingCompletedAt).toBeNull();
    });
  });

  describe("5. Mutation Authorization (assertCanMutate)", () => {
    it("Dev Manager can mutate any task in their department", async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: "t-1",
        creatorId: "other-dev",
        assigneeId: "other-dev",
        departmentId: "dept-dev",
      });
      prisma.task.update.mockResolvedValue({ id: "t-1", title: "Updated Title" });

      const res = await service.update("t-1", { title: "Updated Title" }, devManager());
      expect(res).toBeDefined();
    });

    it("Dev Manager can mutate legacy/unscoped task with null departmentId", async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: "t-null-dept",
        creatorId: "other-dev",
        assigneeId: "other-dev",
        departmentId: null,
      });
      prisma.task.update.mockResolvedValue({ id: "t-null-dept", title: "Migrated Title" });

      const res = await service.update("t-null-dept", { title: "Migrated Title" }, devManager());
      expect(res).toBeDefined();
    });

    it("Dev Employee in multi-assignees list can mutate task", async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: "t-multi",
        creatorId: "mgr-1",
        assigneeId: "dev-primary",
        testerId: "tester-1",
        departmentId: "dept-dev",
        assignees: [{ userId: "dev-secondary" }],
      });
      prisma.task.update.mockResolvedValue({ id: "t-multi", title: "Progress Update" });

      const res = await service.update(
        "t-multi",
        { title: "Progress Update" },
        devEmployee("dev-secondary"),
      );
      expect(res).toBeDefined();
    });

    it("Dev Manager cannot mutate task belonging to a different department", async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: "t-1",
        creatorId: "sales-rep",
        assigneeId: "sales-rep",
        departmentId: "dept-sales",
      });

      await expect(
        service.update("t-1", { title: "Updated Title" }, devManager()),
      ).rejects.toThrow(
        new ForbiddenException("You do not have permission to modify this task"),
      );
    });

    it("Dev Employee cannot mutate unassigned task (403 Forbidden)", async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: "t-1",
        creatorId: "dev-2",
        assigneeId: "dev-2",
        testerId: "tester-1",
        departmentId: "dept-dev",
      });

      await expect(
        service.update("t-1", { title: "Hacked Title" }, devEmployee("dev-1")),
      ).rejects.toThrow(
        new ForbiddenException("You do not have permission to modify this task"),
      );
    });

  describe("6. Ownership changes & deletion (assignee restrictions)", () => {
    const base = {
      id: "t-own",
      creatorId: "mgr-dev",
      assigneeId: "dev-1",
      testerId: "tester-1",
      departmentId: "dept-dev",
      projectId: null,
      dueDate: new Date("2026-10-10T00:00:00.000Z"),
      assignees: [],
    };

    beforeEach(() => {
      prisma.task.findUnique.mockResolvedValue(base);
      prisma.task.update.mockResolvedValue({ id: "t-own" });
    });

    it("assignee cannot move the deadline", async () => {
      await expect(
        service.update("t-own", { dueDate: "2026-12-10T00:00:00.000Z" }, devEmployee("dev-1")),
      ).rejects.toThrow(ForbiddenException);
    });

    it("assignee cannot reassign, appoint a tester, or move department/project", async () => {
      for (const dto of [
        { assigneeId: "dev-2" },
        { testerId: "dev-1" },
        { departmentId: "dept-sales" },
        { projectId: "p-1" },
        { assigneeIds: ["dev-2"] },
      ]) {
        await expect(service.update("t-own", dto, devEmployee("dev-1"))).rejects.toThrow(
          ForbiddenException,
        );
      }
    });

    it("assignee may re-send unchanged values and edit other fields", async () => {
      await expect(
        service.update(
          "t-own",
          {
            title: "Progress",
            dueDate: "2026-10-10T00:00:00.000Z",
            assigneeId: "dev-1",
            testerId: "tester-1",
          },
          devEmployee("dev-1"),
        ),
      ).resolves.toBeDefined();
    });

    it("manager and creator can change ownership fields", async () => {
      await expect(
        service.update("t-own", { assigneeId: "dev-2" }, devManager()),
      ).resolves.toBeDefined();
      await expect(
        service.update("t-own", { dueDate: "2026-12-10T00:00:00.000Z" }, devEmployee("mgr-dev")),
      ).resolves.toBeDefined();
    });

    it("replaces assignees in one transaction", async () => {
      await service.update("t-own", { assigneeIds: ["a", "b", "a"] }, devManager());
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.taskAssignee.createMany).toHaveBeenCalledWith({
        data: [
          { taskId: "t-own", userId: "a" },
          { taskId: "t-own", userId: "b" },
        ],
        skipDuplicates: true,
      });
    });

    it("assignee and tester cannot delete; creator, manager and admin can", async () => {
      await expect(service.remove("t-own", devEmployee("dev-1"))).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.remove("t-own", devTester("tester-1"))).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.remove("t-own", devManager())).resolves.toBeUndefined();
      await expect(service.remove("t-own", admin())).resolves.toBeUndefined();
      await expect(service.remove("t-own", devEmployee("mgr-dev"))).resolves.toBeUndefined();
    });
  });
  });

  describe("6. Task Deletion (remove)", () => {
    it("Dev Manager can delete a task in their department", async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: "t-del",
        creatorId: "dev-1",
        assigneeId: "dev-1",
        departmentId: "dept-dev",
      });
      prisma.task.delete.mockResolvedValue({});

      await expect(service.remove("t-del", devManager())).resolves.toBeUndefined();
      expect(prisma.task.delete).toHaveBeenCalledWith({ where: { id: "t-del" } });
    });

    it("Unrelated Dev Employee cannot delete a task", async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: "t-del",
        creatorId: "dev-2",
        assigneeId: "dev-2",
        departmentId: "dept-dev",
      });

      await expect(service.remove("t-del", devEmployee("dev-1"))).rejects.toThrow(
        new ForbiddenException("You do not have permission to modify this task"),
      );
    });
  });
});
