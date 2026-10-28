import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { UsersService } from "./users.service";
import { TaskUpdatesService } from "../task-updates/task-updates.service";
import type { RequestUser } from "../../common/types/request-user.type";

const u = (id: string, role: RoleName, dept: string | null = "d1"): RequestUser =>
  ({ id, email: `${id}@x.com`, firstName: id, lastName: "T", role: { id: "r", name: role }, department: dept ? { id: dept, name: "Dev", managerTitle: "Lead" } : null }) as RequestUser;

const row = (id: string, role: RoleName = RoleName.EMPLOYEE) => ({
  id, role: { id: "r", name: role }, department: { id: "d1" }, monthlyTarget: 5000, shiftStart: "09:00", shiftEnd: "18:00",
});

describe("UsersService guards", () => {
  let prisma: any;
  let service: UsersService;
  beforeEach(() => {
    prisma = {
      user: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}), count: jest.fn() },
      refreshToken: { deleteMany: jest.fn() },
      role: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "r" }) },
    };
    service = new UsersService(prisma);
  });

  it("hides other people's target and shift from plain employees, not from self/managers/admin", async () => {
    prisma.user.findMany.mockResolvedValue([row("a"), row("b")]);
    const seen = await service.findAll(undefined, u("a", RoleName.EMPLOYEE));
    expect(seen.find((x: any) => x.id === "a")!.monthlyTarget).toBe(5000);
    expect(seen.find((x: any) => x.id === "b")).toMatchObject({ monthlyTarget: null, shiftStart: null, shiftEnd: null });
    expect((await service.findAll(undefined, u("m", RoleName.MANAGER)))[1].monthlyTarget).toBe(5000);
    expect((await service.findAll(undefined, u("ad", RoleName.ADMIN, null)))[1].monthlyTarget).toBe(5000);
  });

  it("refuses to deactivate or demote the last active admin", async () => {
    prisma.user.findUnique.mockResolvedValue(row("ad", RoleName.ADMIN));
    prisma.user.count.mockResolvedValue(0);
    const admin = u("boss", RoleName.ADMIN, null);
    await expect(service.deactivate("ad", admin)).rejects.toThrow(BadRequestException);
    await expect(service.update("ad", { isActive: false } as any, admin)).rejects.toThrow(BadRequestException);
    await expect(service.update("ad", { role: RoleName.EMPLOYEE } as any, admin)).rejects.toThrow(BadRequestException);
    prisma.user.count.mockResolvedValue(1);
    await expect(service.deactivate("ad", admin)).resolves.toBeDefined();
  });

  it("password change deletes every refresh token", async () => {
    prisma.user.findUnique.mockResolvedValue(row("e"));
    await service.update("e", { password: "NewPassw0rd!" } as any, u("boss", RoleName.ADMIN, null));
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: "e" } });
  });

  describe("screen recording switch", () => {
    // u()'s department is always "Dev", so build a real HR user explicitly.
    const hr = { ...u("h", RoleName.EMPLOYEE), department: { id: "hr", name: "HR", managerTitle: "L" } } as RequestUser;
    beforeEach(() => prisma.user.findUnique.mockResolvedValue(row("e")));

    it("only an admin can turn it off or on; HR and managers are refused", async () => {
      await expect(service.update("e", { screenRecordingEnabled: false } as any, hr)).rejects.toThrow(/Only an admin can turn screen recording/);
      // a manager is refused too (by the directory check, before the switch is even reached)
      await expect(service.update("e", { screenRecordingEnabled: false } as any, u("m", RoleName.MANAGER))).rejects.toThrow(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("an admin can, and the value reaches the database", async () => {
      await service.update("e", { screenRecordingEnabled: false } as any, u("boss", RoleName.ADMIN, null));
      expect(prisma.user.update.mock.calls[0][0].data.screenRecordingEnabled).toBe(false);
    });

    it("HR can still edit other things without touching it", async () => {
      await service.update("e", { firstName: "New" } as any, hr);
      expect(prisma.user.update.mock.calls[0][0].data.screenRecordingEnabled).toBeUndefined();
    });
  });

  it("a department-less manager cannot set targets", async () => {
    prisma.user.findUnique.mockResolvedValue({ ...row("e"), department: null });
    await expect(service.updateTarget("e", 1, u("m", RoleName.MANAGER, null))).rejects.toThrow(ForbiddenException);
  });
});

describe("TaskUpdatesService.findForDepartment", () => {
  it("does not return every department's updates for a user with no department", async () => {
    const prisma: any = { taskUpdate: { findMany: jest.fn() } };
    const svc = new TaskUpdatesService(prisma, { create: jest.fn() } as any);
    await expect(svc.findForDepartment(undefined, u("x", RoleName.EMPLOYEE, null))).rejects.toThrow(ForbiddenException);
    expect(prisma.taskUpdate.findMany).not.toHaveBeenCalled();
  });
});
