import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { DealApprovalStatus, DealStage, RoleName } from "@prisma/client";
import { DealsService } from "./deals.service";
import type { RequestUser } from "../../common/types/request-user.type";

function buildPrismaMock() {
  return {
    deal: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    department: { findUnique: jest.fn() },
    company: { findUnique: jest.fn() },
    contact: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    activity: { create: jest.fn().mockResolvedValue({}) },
  };
}

function buildUser(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: "user-1",
    email: "rep@x.com",
    firstName: "Rep",
    lastName: "One",
    role: { id: "role-1", name: RoleName.EMPLOYEE },
    department: { id: "dept-1", name: "Sales", managerTitle: "Sales Manager" },
    ...overrides,
  };
}

const admin = () =>
  buildUser({ id: "admin-1", role: { id: "r-admin", name: RoleName.ADMIN }, department: null });
const salesManager = () =>
  buildUser({ id: "mgr-1", role: { id: "r-mgr", name: RoleName.MANAGER } });
const salesEmployee = (id = "user-1") =>
  buildUser({ id, role: { id: "r-emp", name: RoleName.EMPLOYEE } });
const nonSalesEmployee = () =>
  buildUser({
    role: { id: "r-emp", name: RoleName.EMPLOYEE },
    department: { id: "dept-2", name: "Engineering", managerTitle: "Eng Manager" },
  });

describe("DealsService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let engagementEvents: { record: jest.Mock };
  let service: DealsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = buildPrismaMock();
    engagementEvents = { record: jest.fn().mockResolvedValue({}) };
    const offlineConversions = { uploadDealWonConversion: jest.fn().mockResolvedValue({}) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new DealsService(prisma as any, engagementEvents as any, offlineConversions as any);
  });

  describe("findAll / visibilityScope", () => {
    it("ADMIN sees everything -- no extra filter", async () => {
      prisma.deal.findMany.mockResolvedValue([]);
      await service.findAll({}, admin());
      const where = prisma.deal.findMany.mock.calls[0][0].where;
      expect(where.departmentId).toBeUndefined();
      expect(where.ownerId).toBeUndefined();
    });

    it("non-sales users are rejected outright", () => {
      // visibilityScope throws synchronously (findAll isn't declared async),
      // so the exception surfaces at call time, not as a rejected promise.
      expect(() => service.findAll({}, nonSalesEmployee())).toThrow(
        "Access denied: You do not have access to Sales deals",
      );
    });

    it("matches a department whose name merely contains 'sales' (substring, case-insensitive)", async () => {
      prisma.deal.findMany.mockResolvedValue([]);
      const user = buildUser({
        role: { id: "r-mgr", name: RoleName.MANAGER },
        department: { id: "d1", name: "Sales & Marketing", managerTitle: "Manager" },
      });
      await expect(service.findAll({}, user)).resolves.toEqual([]);
    });

    it("MANAGER is scoped to their department only (sees every rep's deals)", async () => {
      prisma.deal.findMany.mockResolvedValue([]);
      await service.findAll({}, salesManager());
      const where = prisma.deal.findMany.mock.calls[0][0].where;
      expect(where.departmentId).toBe("dept-1");
      expect(where.ownerId).toBeUndefined();
    });

    it("EMPLOYEE is scoped to their own department AND their own deals only", async () => {
      prisma.deal.findMany.mockResolvedValue([]);
      await service.findAll({}, salesEmployee());
      const where = prisma.deal.findMany.mock.calls[0][0].where;
      expect(where.departmentId).toBe("dept-1");
      expect(where.ownerId).toBe("user-1");
    });
  });

  describe("findOne", () => {
    it("throws NotFoundException for a missing deal", async () => {
      prisma.deal.findUnique.mockResolvedValue(null);
      await expect(service.findOne("missing")).rejects.toThrow(NotFoundException);
    });

    it("skips all RBAC when called with no user (internal use)", async () => {
      prisma.deal.findUnique.mockResolvedValue({
        id: "d1",
        ownerId: "someone-else",
        departmentId: "other-dept",
      });
      await expect(service.findOne("d1")).resolves.toBeDefined();
    });

    it("EMPLOYEE cannot view a deal they don't own", async () => {
      prisma.deal.findUnique.mockResolvedValue({
        id: "d1",
        ownerId: "someone-else",
        departmentId: "dept-1",
      });
      await expect(service.findOne("d1", salesEmployee())).rejects.toThrow(
        "Access denied: You can only view deals assigned to you",
      );
    });

    it("EMPLOYEE can view their own deal", async () => {
      prisma.deal.findUnique.mockResolvedValue({
        id: "d1",
        ownerId: "user-1",
        departmentId: "dept-1",
      });
      await expect(service.findOne("d1", salesEmployee())).resolves.toBeDefined();
    });

    it("MANAGER cannot view a deal scoped to a different department", async () => {
      prisma.deal.findUnique.mockResolvedValue({
        id: "d1",
        ownerId: "other",
        departmentId: "dept-9",
      });
      await expect(service.findOne("d1", salesManager())).rejects.toThrow(
        "Access denied: This deal belongs to another department",
      );
    });

    it("MANAGER CAN view a deal with a null departmentId regardless of their own department (unscoped)", async () => {
      prisma.deal.findUnique.mockResolvedValue({ id: "d1", ownerId: "other", departmentId: null });
      await expect(service.findOne("d1", salesManager())).resolves.toBeDefined();
    });
  });

  describe("update -- approval threshold", () => {
    const baseDeal = {
      id: "d1",
      stage: DealStage.NEGOTIATION,
      value: 5000,
      ownerId: "user-1",
      departmentId: "dept-1",
    };

    beforeEach(() => {
      prisma.deal.findUnique.mockResolvedValue(baseDeal);
      prisma.deal.update.mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...baseDeal, ...args.data }),
      );
    });

    it("defaults to a $10,000 threshold when the deal has no department", async () => {
      prisma.deal.findUnique.mockResolvedValue({ ...baseDeal, departmentId: null });

      await service.update("d1", { stage: DealStage.WON, value: 10001 }, salesEmployee());

      const data = prisma.deal.update.mock.calls[0][0].data;
      expect(data.stage).toBeUndefined(); // withheld -- requires approval
      expect(data.approvalStatus).toBe(DealApprovalStatus.PENDING);
    });

    it("does NOT require approval at exactly the threshold value (strictly greater-than)", async () => {
      prisma.department.findUnique.mockResolvedValue({ dealApprovalThreshold: 10000 });

      await service.update("d1", { stage: DealStage.WON, value: 10000 }, salesEmployee());

      const data = prisma.deal.update.mock.calls[0][0].data;
      expect(data.stage).toBe(DealStage.WON);
      expect(data.approvalStatus).toBe(DealApprovalStatus.NONE);
    });

    it("requires approval one dollar above the threshold", async () => {
      prisma.department.findUnique.mockResolvedValue({ dealApprovalThreshold: 10000 });

      await service.update("d1", { stage: DealStage.WON, value: 10001 }, salesEmployee());

      const data = prisma.deal.update.mock.calls[0][0].data;
      expect(data.stage).toBeUndefined();
      expect(data.approvalStatus).toBe(DealApprovalStatus.PENDING);
    });

    it("uses the department's configured threshold instead of the $10,000 default when one exists", async () => {
      prisma.department.findUnique.mockResolvedValue({ dealApprovalThreshold: 50000 });

      // Above the default $10k but below this department's $50k limit -- should NOT require approval.
      await service.update("d1", { stage: DealStage.WON, value: 25000 }, salesEmployee());

      const data = prisma.deal.update.mock.calls[0][0].data;
      expect(data.stage).toBe(DealStage.WON);
    });

    it("never gates a MANAGER or ADMIN closing a big deal, regardless of value", async () => {
      prisma.department.findUnique.mockResolvedValue({ dealApprovalThreshold: 10000 });

      await service.update("d1", { stage: DealStage.WON, value: 999999 }, salesManager());

      const data = prisma.deal.update.mock.calls[0][0].data;
      expect(data.stage).toBe(DealStage.WON);
      expect(data.approvalStatus).toBe(DealApprovalStatus.NONE);
    });

    it("does not re-trigger approval when the deal is already WON (only on the transition into WON)", async () => {
      prisma.deal.findUnique.mockResolvedValue({ ...baseDeal, stage: DealStage.WON });
      prisma.department.findUnique.mockResolvedValue({ dealApprovalThreshold: 100 });

      await service.update("d1", { stage: DealStage.WON, value: 999999 }, salesEmployee());

      const data = prisma.deal.update.mock.calls[0][0].data;
      expect(data.stage).toBe(DealStage.WON);
    });

    it("uses the deal's existing value when no new value is provided in the update", async () => {
      prisma.deal.findUnique.mockResolvedValue({ ...baseDeal, value: 999999 });
      prisma.department.findUnique.mockResolvedValue({ dealApprovalThreshold: 10000 });

      await service.update("d1", { stage: DealStage.WON }, salesEmployee());

      const data = prisma.deal.update.mock.calls[0][0].data;
      expect(data.stage).toBeUndefined();
      expect(data.approvalStatus).toBe(DealApprovalStatus.PENDING);
    });

    it("logs an activity entry when approval is requested", async () => {
      prisma.department.findUnique.mockResolvedValue({ dealApprovalThreshold: 100 });

      await service.update("d1", { stage: DealStage.WON, value: 500 }, salesEmployee());

      expect(prisma.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ content: expect.stringContaining("Approval requested") }),
        }),
      );
    });
  });

  describe("update -- assertCanMutate", () => {
    const baseDeal = {
      id: "d1",
      stage: DealStage.NEW_LEAD,
      value: 100,
      ownerId: "owner-x",
      departmentId: "dept-1",
    };

    beforeEach(() => {
      prisma.deal.findUnique.mockResolvedValue(baseDeal);
      prisma.deal.update.mockResolvedValue(baseDeal);
    });

    it("rejects a non-owner, non-manager Sales employee", async () => {
      await expect(
        service.update("d1", { notes: "x" }, salesEmployee("someone-else")),
      ).rejects.toThrow("You do not have permission to modify this deal");
    });

    it("allows the owner", async () => {
      await expect(
        service.update("d1", { notes: "x" }, salesEmployee("owner-x")),
      ).resolves.toBeDefined();
    });

    it("allows a same-department manager", async () => {
      await expect(service.update("d1", { notes: "x" }, salesManager())).resolves.toBeDefined();
    });

    it("rejects a non-sales-department user outright, even an owner in name", async () => {
      await expect(service.update("d1", { notes: "x" }, nonSalesEmployee())).rejects.toThrow(
        "Access denied: You do not belong to the Sales department",
      );
    });
  });

  describe("approve / reject", () => {
    const pendingDeal = {
      id: "d1",
      stage: DealStage.NEGOTIATION,
      ownerId: "user-1",
      departmentId: "dept-1",
      approvalStatus: DealApprovalStatus.PENDING,
    };

    it("throws BadRequestException if there's no pending approval, before any role check", async () => {
      prisma.deal.findUnique.mockResolvedValue({
        ...pendingDeal,
        approvalStatus: DealApprovalStatus.NONE,
      });
      await expect(service.approve("d1", admin())).rejects.toThrow(BadRequestException);
    });

    it("the deal owner (an Employee) cannot approve their own request even though they're in Sales", async () => {
      prisma.deal.findUnique.mockResolvedValue(pendingDeal);
      await expect(service.approve("d1", salesEmployee("user-1"))).rejects.toThrow(
        "You do not have permission to approve this deal",
      );
    });

    it("a same-department manager can approve", async () => {
      prisma.deal.findUnique.mockResolvedValue(pendingDeal);
      prisma.deal.update.mockResolvedValue({
        ...pendingDeal,
        stage: DealStage.WON,
        approvalStatus: DealApprovalStatus.APPROVED,
      });

      const result = await service.approve("d1", salesManager());

      expect(prisma.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stage: DealStage.WON,
            approvalStatus: DealApprovalStatus.APPROVED,
            closedAt: expect.any(Date),
          }),
        }),
      );
      expect(result.stage).toBe(DealStage.WON);
    });

    it("ADMIN can approve regardless of department", async () => {
      prisma.deal.findUnique.mockResolvedValue(pendingDeal);
      prisma.deal.update.mockResolvedValue({ ...pendingDeal, stage: DealStage.WON });
      await expect(service.approve("d1", admin())).resolves.toBeDefined();
    });

    it("reject() sets approvalStatus to REJECTED without touching stage", async () => {
      prisma.deal.findUnique.mockResolvedValue(pendingDeal);
      prisma.deal.update.mockResolvedValue({
        ...pendingDeal,
        approvalStatus: DealApprovalStatus.REJECTED,
      });

      await service.reject("d1", salesManager());

      const data = prisma.deal.update.mock.calls[0][0].data;
      expect(data).toEqual({ approvalStatus: DealApprovalStatus.REJECTED });
    });
  });

  describe("resolveClosedAt (via update)", () => {
    const openDeal = {
      id: "d1",
      stage: DealStage.LOST,
      value: 100,
      ownerId: "user-1",
      departmentId: "dept-1",
    };

    it("stamps closedAt when moving into WON", async () => {
      prisma.deal.findUnique.mockResolvedValue({ ...openDeal, stage: DealStage.NEGOTIATION });
      prisma.department.findUnique.mockResolvedValue({ dealApprovalThreshold: 999999 });
      prisma.deal.update.mockResolvedValue({});

      await service.update("d1", { stage: DealStage.WON }, salesManager());

      expect(prisma.deal.update.mock.calls[0][0].data.closedAt).toBeInstanceOf(Date);
    });

    it("clears closedAt when reopening a Lost deal back to an open stage", async () => {
      prisma.deal.findUnique.mockResolvedValue(openDeal);
      prisma.deal.update.mockResolvedValue({});

      await service.update("d1", { stage: DealStage.NEGOTIATION }, salesManager());

      expect(prisma.deal.update.mock.calls[0][0].data.closedAt).toBeNull();
    });

    it("leaves closedAt untouched when stage isn't part of the update", async () => {
      prisma.deal.findUnique.mockResolvedValue(openDeal);
      prisma.deal.update.mockResolvedValue({});

      await service.update("d1", { notes: "just a note" }, salesManager());

      expect(prisma.deal.update.mock.calls[0][0].data.closedAt).toBeUndefined();
    });
  });
});
