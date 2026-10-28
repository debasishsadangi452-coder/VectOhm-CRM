import { ForbiddenException } from "@nestjs/common";
import { LeaveStatus, RoleName, TimeLogStatus } from "@prisma/client";
import { LeaveRequestsService } from "./leave-requests.service";
import { TimeLogsService } from "../time-logs/time-logs.service";
import type { RequestUser } from "../../common/types/request-user.type";

const emp = (id = "e1"): RequestUser =>
  ({ id, email: "e@x.com", firstName: "E", lastName: "T", role: { id: "r", name: RoleName.EMPLOYEE }, department: { id: "d1", name: "Dev", managerTitle: "Lead" } }) as RequestUser;
const admin = (id = "a1"): RequestUser => ({ ...emp(id), role: { id: "r", name: RoleName.ADMIN } }) as RequestUser;

describe("LeaveRequestsService guards", () => {
  let prisma: any;
  let service: LeaveRequestsService;
  beforeEach(() => {
    prisma = { leaveRequest: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}), delete: jest.fn().mockResolvedValue({}) } };
    service = new LeaveRequestsService(prisma, { create: jest.fn() } as any);
  });

  it("employee cannot delete an approved leave but can delete a pending one; admin can delete either", async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue({ id: "l", userId: "e1", status: LeaveStatus.APPROVED });
    await expect(service.remove("l", emp())).rejects.toThrow(ForbiddenException);
    await expect(service.remove("l", admin())).resolves.toBeDefined();
    prisma.leaveRequest.findUnique.mockResolvedValue({ id: "l", userId: "e1", status: LeaveStatus.PENDING });
    await expect(service.remove("l", emp())).resolves.toBeDefined();
  });

  it("employee cannot write a review note on their own request", async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue({ id: "l", userId: "e1", status: LeaveStatus.PENDING });
    await expect(service.update("l", { reviewNote: "approved by boss" } as any, emp())).rejects.toThrow(ForbiddenException);
  });
});

describe("TimeLogsService guards", () => {
  let prisma: any;
  let service: TimeLogsService;
  beforeEach(() => {
    prisma = {
      timeLog: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
      task: { findUnique: jest.fn() },
    };
    service = new TimeLogsService(prisma, { create: jest.fn() } as any);
  });

  it("employee asking for another department's task logs is refused", async () => {
    prisma.task.findUnique.mockResolvedValue({ departmentId: "d-other", assigneeId: null, creatorId: "x", testerId: null, assignees: [] });
    await expect(service.findAll({ taskId: "t" }, emp())).rejects.toThrow(ForbiddenException);
    expect(prisma.timeLog.findMany).not.toHaveBeenCalled();
  });

  it("owner cannot set a review note on their own pending log", async () => {
    prisma.timeLog.findUnique.mockResolvedValue({ id: "tl", userId: "e1", status: TimeLogStatus.PENDING, taskId: "t", user: { departmentId: "d1" } });
    await expect(service.update("tl", { reviewNote: "fine" } as any, emp())).rejects.toThrow(ForbiddenException);
  });
});
