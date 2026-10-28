import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { BugStatus, RoleName } from "@prisma/client";
import { BugsService } from "./bugs.service";
import { BugReviewDecision } from "./dto/review-bug-fix.dto";
import type { RequestUser } from "../../common/types/request-user.type";

const user = (id: string, role: RoleName, dept = "dept-dev"): RequestUser =>
  ({
    id,
    email: `${id}@x.com`,
    firstName: id,
    lastName: "T",
    role: { id: `r-${role}`, name: role },
    department: dept ? { id: dept, name: "Dev", managerTitle: "Lead" } : null,
  }) as RequestUser;

const bugRow = (over: Record<string, unknown> = {}) => ({
  id: "b1",
  bugNumber: 1,
  title: "Crash",
  taskId: "t1",
  status: BugStatus.OPEN,
  reporterId: "reporter",
  assigneeId: "dev",
  fixSubmittedById: null,
  task: {
    id: "t1",
    departmentId: "dept-dev",
    creatorId: "creator",
    assigneeId: "dev",
    testerId: "tester",
    assignees: [],
  },
  ...over,
});

describe("BugsService access control", () => {
  let prisma: any;
  let service: BugsService;

  beforeEach(() => {
    prisma = {
      bug: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}) },
      task: { findUnique: jest.fn() },
      bugActivityLog: { create: jest.fn() },
      taskActivityLog: { create: jest.fn() },
      user: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new BugsService(prisma, { create: jest.fn() } as any);
  });

  it("hides a bug from a user outside the task's department who is not a contributor", async () => {
    prisma.bug.findUnique.mockResolvedValue(bugRow());
    await expect(service.findOne("b1", user("sales", RoleName.EMPLOYEE, "dept-sales"))).rejects.toThrow(ForbiddenException);
    await expect(service.findOne("b1", user("admin", RoleName.ADMIN, ""))).resolves.toBeDefined();
    await expect(service.findOne("b1", user("dev", RoleName.EMPLOYEE, "dept-sales"))).resolves.toBeDefined();
  });

  it("scopes the list query to the caller's visible tasks (not for admin)", async () => {
    await service.findAll(user("m", RoleName.MANAGER), undefined, undefined, undefined, "p1");
    const where = prisma.bug.findMany.mock.calls[0][0].where;
    expect(JSON.stringify(where)).toContain("dept-dev");
    expect(JSON.stringify(where)).toContain("p1");
    await service.findAll(user("a", RoleName.ADMIN, ""));
    expect(prisma.bug.findMany.mock.calls[1][0].where.AND).toEqual([{ task: {} }]);
  });

  it("blocks bystanders from editing and non-triagers from reassigning", async () => {
    prisma.bug.findUnique.mockResolvedValue(bugRow());
    await expect(
      service.update("b1", { title: "x" }, user("peer", RoleName.EMPLOYEE)),
    ).rejects.toThrow("permission to modify");
    await expect(
      service.update("b1", { assigneeId: "someone" }, user("dev", RoleName.EMPLOYEE)),
    ).rejects.toThrow("reassign");
    await expect(
      service.update("b1", { assigneeId: "someone" }, user("reporter", RoleName.EMPLOYEE)),
    ).resolves.toBeDefined();
  });

  it("refuses to create a bug on a task the user cannot see", async () => {
    prisma.task.findUnique.mockResolvedValue({ ...bugRow().task, assignees: [] });
    await expect(
      service.create({ title: "x", description: "y", taskId: "t1" } as any, user("sales", RoleName.EMPLOYEE, "dept-sales")),
    ).rejects.toThrow(ForbiddenException);
  });

  it("only accepts a fix submission for a bug that is not already fixed/closed/pending", async () => {
    for (const status of [BugStatus.FIXED, BugStatus.CLOSED, BugStatus.PENDING_REVIEW]) {
      prisma.bug.findUnique.mockResolvedValue(bugRow({ status }));
      await expect(
        service.submitFix("b1", { fixSummary: "done" } as any, user("dev", RoleName.EMPLOYEE)),
      ).rejects.toThrow(BadRequestException);
    }
  });

  it("only reviews bugs pending review, and not your own fix", async () => {
    prisma.bug.findUnique.mockResolvedValue(bugRow({ status: BugStatus.OPEN }));
    await expect(
      service.reviewFix("b1", { decision: BugReviewDecision.APPROVE } as any, user("m", RoleName.MANAGER)),
    ).rejects.toThrow(BadRequestException);

    prisma.bug.findUnique.mockResolvedValue(bugRow({ status: BugStatus.PENDING_REVIEW, fixSubmittedById: "m" }));
    await expect(
      service.reviewFix("b1", { decision: BugReviewDecision.APPROVE } as any, user("m", RoleName.MANAGER)),
    ).rejects.toThrow("yourself");

    prisma.bug.findUnique.mockResolvedValue(bugRow({ status: BugStatus.PENDING_REVIEW, fixSubmittedById: "dev" }));
    await expect(
      service.reviewFix("b1", { decision: BugReviewDecision.APPROVE } as any, user("m", RoleName.MANAGER)),
    ).resolves.toBeDefined();
  });
});
