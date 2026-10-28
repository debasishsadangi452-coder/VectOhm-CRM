import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { RoleName, TaskStatus } from "@prisma/client";
import { TaskCommunicationService } from "./task-communication.service";
import type { RequestUser } from "../../common/types/request-user.type";

const u = (id: string, role: RoleName): RequestUser =>
  ({ id, email: "x@x.com", firstName: id, lastName: "T", role: { id: "r", name: role }, department: { id: "d1", name: "Dev", managerTitle: "L" } }) as RequestUser;

describe("TaskCommunicationService guards", () => {
  let prisma: any;
  let service: TaskCommunicationService;
  const task = { id: "t", title: "T", status: TaskStatus.IN_PROGRESS, assigneeId: "dev", creatorId: "mgr", testerId: "tester", departmentId: "d1", assignees: [], project: null };

  beforeEach(() => {
    prisma = {
      task: { findUnique: jest.fn().mockResolvedValue(task), update: jest.fn() },
      user: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
      taskMessage: { create: jest.fn().mockResolvedValue({ id: "m" }), findFirst: jest.fn(), update: jest.fn() },
      taskUpdate: { create: jest.fn().mockResolvedValue({}) },
    };
    service = new TaskCommunicationService(prisma, { getOrCreateDM: jest.fn().mockResolvedValue({ id: "c" }), sendMessage: jest.fn().mockResolvedValue({ id: "cm" }) } as any, { create: jest.fn() } as any);
  });

  it("refuses an explicit recipient who has nothing to do with the task", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "stranger", isActive: true, departmentId: "d9", role: { name: RoleName.EMPLOYEE } });
    await expect(service.sendMessage("t", { message: "hi", recipientId: "stranger" } as any, u("dev", RoleName.EMPLOYEE))).rejects.toThrow(ForbiddenException);
    expect(prisma.taskMessage.create).not.toHaveBeenCalled();
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.sendMessage("t", { message: "hi", recipientId: "ghost" } as any, u("dev", RoleName.EMPLOYEE))).rejects.toThrow(NotFoundException);
  });

  it("accepts the task's creator as recipient", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "mgr", isActive: true, departmentId: "d1", role: { name: RoleName.MANAGER } });
    await expect(service.sendMessage("t", { message: "hi", recipientId: "mgr" } as any, u("dev", RoleName.EMPLOYEE))).resolves.toBeDefined();
  });

  it("an assignee cannot complete the task through a progress update", async () => {
    await expect(service.submitUpdate("t", { status: TaskStatus.DONE } as any, u("dev", RoleName.EMPLOYEE))).rejects.toThrow(ForbiddenException);
    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it("an assignee can still report in-progress/review states", async () => {
    await expect(service.submitUpdate("t", { status: TaskStatus.READY_FOR_TESTING } as any, u("dev", RoleName.EMPLOYEE))).resolves.toBeDefined();
    expect(prisma.task.update).toHaveBeenCalled();
  });
});
