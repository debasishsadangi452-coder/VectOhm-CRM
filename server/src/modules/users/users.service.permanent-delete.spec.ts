import { ConflictException, ForbiddenException } from "@nestjs/common";
import { Prisma, RoleName } from "@prisma/client";
import { UsersService } from "./users.service";
import type { RequestUser } from "../../common/types/request-user.type";

const actor = (role: string, department: string | null = null, id = "actor1") =>
  ({
    id,
    email: `${id}@x.com`,
    role: { id: "r", name: role },
    department: department ? { id: "d", name: department } : null,
  }) as unknown as RequestUser;

const admin = actor("ADMIN", null, "admin1");
const hr = actor("EMPLOYEE", "HR", "hr1");
const manager = actor("MANAGER", "Sales", "mgr1");
const employee = actor("EMPLOYEE", "Sales", "emp1");

function targetRow(over: Partial<{ id: string; firstName: string; lastName: string; role: string }> = {}) {
  return {
    id: over.id ?? "target1",
    email: "target@x.com",
    firstName: over.firstName ?? "Taylor",
    lastName: over.lastName ?? "Target",
    avatarUrl: null,
    githubUsername: null,
    isActive: false,
    monthlyTarget: null,
    shiftStart: "10:00",
    shiftEnd: "19:00",
    createdAt: new Date(),
    updatedAt: new Date(),
    role: { id: "r", name: over.role ?? "EMPLOYEE" },
    department: null,
  };
}

function makeService(opts: {
  target?: ReturnType<typeof targetRow>;
  deals?: number;
  leads?: number;
  tasks?: number;
  projects?: number;
  otherAdmins?: number;
  deleteError?: unknown;
} = {}) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(opts.target ?? targetRow()),
      count: jest.fn().mockResolvedValue(opts.otherAdmins ?? 1),
      delete: opts.deleteError
        ? jest.fn().mockRejectedValue(opts.deleteError)
        : jest.fn().mockResolvedValue({}),
    },
    deal: { count: jest.fn().mockResolvedValue(opts.deals ?? 0) },
    lead: { count: jest.fn().mockResolvedValue(opts.leads ?? 0) },
    task: { count: jest.fn().mockResolvedValue(opts.tasks ?? 0) },
    project: { count: jest.fn().mockResolvedValue(opts.projects ?? 0) },
  };
  // UsersService's constructor only needs PrismaService -- the mock above
  // covers every model method permanentlyDelete touches.
  const service = new UsersService(prisma as never);
  return { service, prisma };
}

function p2003() {
  return new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed", {
    code: "P2003",
    clientVersion: "test",
  });
}

describe("UsersService.permanentlyDelete", () => {
  it("Admin and HR can permanently delete an employee with nothing linked to them", async () => {
    for (const who of [admin, hr]) {
      const { service, prisma } = makeService();
      await expect(service.permanentlyDelete("target1", who)).resolves.toEqual({ success: true });
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: "target1" } });
    }
  });

  it.each([["a manager", manager], ["an employee", employee]])(
    "%s cannot permanently delete anyone",
    async (_l, who) => {
      const { service, prisma } = makeService();
      await expect(service.permanentlyDelete("target1", who)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.user.delete).not.toHaveBeenCalled();
    },
  );

  it("refuses when the account still owns deals, leads, tasks or projects, naming each", async () => {
    const { service, prisma } = makeService({ deals: 2, leads: 1, tasks: 3, projects: 1 });
    await expect(service.permanentlyDelete("target1", admin)).rejects.toThrow(
      /2 deals, 1 lead, 3 tasks they created, 1 project/,
    );
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it("singular vs plural wording", async () => {
    const { service } = makeService({ deals: 1 });
    await expect(service.permanentlyDelete("target1", admin)).rejects.toThrow(/owns 1 deal\. Reassign it/);
  });

  it("falls back to a clear message for any OTHER linked record the counts above don't cover (P2003)", async () => {
    const { service, prisma } = makeService({ deleteError: p2003() });
    await expect(service.permanentlyDelete("target1", admin)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.permanentlyDelete("target1", admin)).rejects.toThrow(/other records linked to them/);
    expect(prisma.user.delete).toHaveBeenCalled();
  });

  it("an unrelated database error is not swallowed as a conflict", async () => {
    const { service } = makeService({ deleteError: new Error("connection lost") });
    await expect(service.permanentlyDelete("target1", admin)).rejects.toThrow("connection lost");
  });

  it("only an admin can permanently delete an admin account", async () => {
    const { service, prisma } = makeService({ target: targetRow({ role: "ADMIN" }), otherAdmins: 1 });
    await expect(service.permanentlyDelete("target1", hr)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.delete).not.toHaveBeenCalled();

    const again = makeService({ target: targetRow({ role: "ADMIN" }), otherAdmins: 1 });
    await expect(again.service.permanentlyDelete("target1", admin)).resolves.toEqual({ success: true });
  });

  it("refuses to delete the last admin", async () => {
    const { service, prisma } = makeService({ target: targetRow({ role: "ADMIN" }), otherAdmins: 0 });
    await expect(service.permanentlyDelete("target1", admin)).rejects.toThrow(/last active admin/);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it("404s for an unknown user", async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.permanentlyDelete("ghost", admin)).rejects.toThrow("User not found");
  });
});
