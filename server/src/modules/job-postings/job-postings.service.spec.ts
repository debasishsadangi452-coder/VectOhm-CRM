import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { JobPostingStatus, RoleName } from "@prisma/client";
import { JobPostingsService } from "./job-postings.service";
import type { RequestUser } from "../../common/types/request-user.type";

function buildPrismaMock() {
  return {
    jobPosting: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

function buildUser(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: "user-1",
    email: "recruiter@x.com",
    firstName: "Rec",
    lastName: "Ruiter",
    role: { id: "role-1", name: RoleName.EMPLOYEE },
    department: { id: "dept-1", name: "Recruitment", managerTitle: "Recruitment Manager" },
    ...overrides,
  };
}

const admin = () =>
  buildUser({ id: "admin-1", role: { id: "r-admin", name: RoleName.ADMIN }, department: null });
const manager = () => buildUser({ id: "mgr-1", role: { id: "r-mgr", name: RoleName.MANAGER } });
const employee = (id = "user-1") =>
  buildUser({ id, role: { id: "r-emp", name: RoleName.EMPLOYEE } });

describe("JobPostingsService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let syndication: { syndicate: jest.Mock };
  let service: JobPostingsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = buildPrismaMock();
    syndication = { syndicate: jest.fn().mockResolvedValue(undefined) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new JobPostingsService(prisma as any, syndication as any);
  });

  describe("findAll / visibilityScope", () => {
    it("ADMIN sees everything with no departmentId filter by default", () => {
      prisma.jobPosting.findMany.mockResolvedValue([]);
      service.findAll({}, admin());
      const where = prisma.jobPosting.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeUndefined();
      expect(where.departmentId).toBeUndefined();
    });

    it("ADMIN can narrow to a specific department via filters.departmentId", () => {
      prisma.jobPosting.findMany.mockResolvedValue([]);
      service.findAll({ departmentId: "dept-9" }, admin());
      const where = prisma.jobPosting.findMany.mock.calls[0][0].where;
      expect(where.departmentId).toBe("dept-9");
    });

    it("a non-admin's requested departmentId filter is ignored -- they only ever see their own dept + unscoped", () => {
      prisma.jobPosting.findMany.mockResolvedValue([]);
      service.findAll({ departmentId: "someone-elses-dept" }, employee());
      const where = prisma.jobPosting.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([{ departmentId: null }, { departmentId: "dept-1" }]);
    });

    it("a non-admin sees both their own department's postings and legacy unscoped ones (OR, not exclusive)", () => {
      prisma.jobPosting.findMany.mockResolvedValue([]);
      service.findAll({}, manager());
      const where = prisma.jobPosting.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([{ departmentId: null }, { departmentId: "dept-1" }]);
    });
  });

  describe("findOne", () => {
    it("throws NotFoundException when missing", async () => {
      prisma.jobPosting.findUnique.mockResolvedValue(null);
      await expect(service.findOne("missing")).rejects.toThrow(NotFoundException);
    });

    it("returns the posting when found (no RBAC gate on read)", async () => {
      prisma.jobPosting.findUnique.mockResolvedValue({ id: "j1" });
      await expect(service.findOne("j1")).resolves.toEqual({ id: "j1" });
    });
  });

  describe("create -- syndication on creation", () => {
    it("syndicates immediately when created directly as OPEN", async () => {
      prisma.jobPosting.create.mockResolvedValue({ id: "j1", status: JobPostingStatus.OPEN });
      prisma.jobPosting.findUniqueOrThrow.mockResolvedValue({
        id: "j1",
        status: JobPostingStatus.OPEN,
      });

      await service.create(
        { title: "Engineer", status: JobPostingStatus.OPEN } as never,
        employee(),
      );

      expect(syndication.syndicate).toHaveBeenCalledWith(expect.objectContaining({ id: "j1" }));
    });

    it("does NOT syndicate a draft/on-hold posting created without OPEN status", async () => {
      prisma.jobPosting.create.mockResolvedValue({ id: "j1", status: JobPostingStatus.ON_HOLD });
      prisma.jobPosting.findUniqueOrThrow.mockResolvedValue({
        id: "j1",
        status: JobPostingStatus.ON_HOLD,
      });

      await service.create(
        { title: "Engineer", status: JobPostingStatus.ON_HOLD } as never,
        employee(),
      );

      expect(syndication.syndicate).not.toHaveBeenCalled();
    });

    it("defaults ownerId/departmentId to the creator when not explicitly provided", async () => {
      prisma.jobPosting.create.mockResolvedValue({ id: "j1", status: JobPostingStatus.ON_HOLD });
      prisma.jobPosting.findUniqueOrThrow.mockResolvedValue({});

      await service.create({ title: "Engineer" } as never, employee());

      const data = prisma.jobPosting.create.mock.calls[0][0].data;
      expect(data.ownerId).toBe("user-1");
      expect(data.departmentId).toBe("dept-1");
    });
  });

  describe("update -- syndication only fires on the transition edge into OPEN", () => {
    const owned = { id: "j1", ownerId: "user-1", departmentId: "dept-1" };

    it("DRAFT/ON_HOLD -> OPEN triggers syndication and re-fetches the posting", async () => {
      prisma.jobPosting.findUnique.mockResolvedValue({
        ...owned,
        status: JobPostingStatus.ON_HOLD,
      });
      prisma.jobPosting.update.mockResolvedValue({ ...owned, status: JobPostingStatus.OPEN });
      prisma.jobPosting.findUniqueOrThrow.mockResolvedValue({
        ...owned,
        status: JobPostingStatus.OPEN,
        refetched: true,
      });

      const result = await service.update(
        "j1",
        { status: JobPostingStatus.OPEN } as never,
        employee(),
      );

      expect(syndication.syndicate).toHaveBeenCalledWith(
        expect.objectContaining({ status: JobPostingStatus.OPEN }),
      );
      expect(prisma.jobPosting.findUniqueOrThrow).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ refetched: true }));
    });

    it("OPEN -> OPEN (unrelated field change) does NOT re-syndicate", async () => {
      prisma.jobPosting.findUnique.mockResolvedValue({ ...owned, status: JobPostingStatus.OPEN });
      prisma.jobPosting.update.mockResolvedValue({ ...owned, status: JobPostingStatus.OPEN });

      await service.update("j1", { title: "New Title" } as never, employee());

      expect(syndication.syndicate).not.toHaveBeenCalled();
      expect(prisma.jobPosting.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it("OPEN -> CLOSED does NOT syndicate", async () => {
      prisma.jobPosting.findUnique.mockResolvedValue({ ...owned, status: JobPostingStatus.OPEN });
      prisma.jobPosting.update.mockResolvedValue({ ...owned, status: JobPostingStatus.CLOSED });

      await service.update("j1", { status: JobPostingStatus.CLOSED } as never, employee());

      expect(syndication.syndicate).not.toHaveBeenCalled();
    });

    it("DRAFT -> DRAFT (no transition at all) does NOT syndicate", async () => {
      prisma.jobPosting.findUnique.mockResolvedValue({
        ...owned,
        status: JobPostingStatus.ON_HOLD,
      });
      prisma.jobPosting.update.mockResolvedValue({ ...owned, status: JobPostingStatus.ON_HOLD });

      await service.update("j1", { title: "x" } as never, employee());

      expect(syndication.syndicate).not.toHaveBeenCalled();
    });
  });

  describe("assertCanMutate", () => {
    const posting = (departmentId: string | null = "dept-1") => ({
      id: "j1",
      ownerId: "owner-x",
      departmentId,
    });

    beforeEach(() => {
      prisma.jobPosting.update.mockResolvedValue({ status: JobPostingStatus.ON_HOLD });
    });

    it("rejects a non-owner, non-manager employee", async () => {
      prisma.jobPosting.findUnique.mockResolvedValue(posting());
      await expect(service.update("j1", {} as never, employee("someone-else"))).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("allows the owner even as a plain employee", async () => {
      prisma.jobPosting.findUnique.mockResolvedValue(posting());
      await expect(service.update("j1", {} as never, employee("owner-x"))).resolves.toBeDefined();
    });

    it("allows a same-department manager", async () => {
      prisma.jobPosting.findUnique.mockResolvedValue(posting("dept-1"));
      await expect(service.update("j1", {} as never, manager())).resolves.toBeDefined();
    });

    it("allows ANY manager when the posting's departmentId is null (unscoped)", async () => {
      prisma.jobPosting.findUnique.mockResolvedValue(posting(null));
      const otherManager = buildUser({
        role: { id: "r-mgr", name: RoleName.MANAGER },
        department: {
          id: "completely-different-dept",
          name: "Engineering",
          managerTitle: "Eng Manager",
        },
      });
      await expect(service.update("j1", {} as never, otherManager)).resolves.toBeDefined();
    });

    it("rejects a manager from a different department when the posting IS scoped", async () => {
      prisma.jobPosting.findUnique.mockResolvedValue(posting("dept-1"));
      const otherManager = buildUser({
        role: { id: "r-mgr", name: RoleName.MANAGER },
        department: {
          id: "completely-different-dept",
          name: "Engineering",
          managerTitle: "Eng Manager",
        },
      });
      await expect(service.update("j1", {} as never, otherManager)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("ADMIN can always mutate", async () => {
      prisma.jobPosting.findUnique.mockResolvedValue(posting());
      await expect(service.update("j1", {} as never, admin())).resolves.toBeDefined();
    });
  });

  describe("close", () => {
    it("sets status to CLOSED for an authorized user", async () => {
      prisma.jobPosting.findUnique.mockResolvedValue({
        id: "j1",
        ownerId: "user-1",
        departmentId: "dept-1",
      });
      prisma.jobPosting.update.mockResolvedValue({ id: "j1", status: JobPostingStatus.CLOSED });

      await service.close("j1", employee());

      expect(prisma.jobPosting.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: JobPostingStatus.CLOSED } }),
      );
    });

    it("throws NotFoundException for a missing posting", async () => {
      prisma.jobPosting.findUnique.mockResolvedValue(null);
      await expect(service.close("missing", admin())).rejects.toThrow(NotFoundException);
    });
  });
});
