import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { RoleName } from "@prisma/client";
import { HiringSignalAutomationService } from "./hiring-signal-automation.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../common/types/request-user.type";

// Self-contained mock (not the recruitment module's shared prisma-mock.ts --
// this is a Sales-outreach tool, not part of that module's scope) covering
// only the calls HiringSignalAutomationService actually makes.
function createMockPrisma() {
  return {
    hiringSignalAutomation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    hiringSignal: {
      findMany: jest.fn(),
    },
  };
}

const SALES_USER: RequestUser = {
  id: "sales-1",
  email: "sales@venus.test",
  firstName: "Sales",
  lastName: "Rep",
  role: { id: "role-employee", name: RoleName.EMPLOYEE },
  department: { id: "dept-sales", name: "Sales", managerTitle: "Sales Manager" },
};

const NON_SALES_USER: RequestUser = {
  ...SALES_USER,
  id: "other-1",
  department: { id: "dept-eng", name: "Engineering", managerTitle: "Engineering Manager" },
};

const ADMIN_USER: RequestUser = {
  ...SALES_USER,
  id: "admin-1",
  role: { id: "role-admin", name: RoleName.ADMIN },
  department: null,
};

describe("HiringSignalAutomationService", () => {
  let service: HiringSignalAutomationService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [HiringSignalAutomationService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(HiringSignalAutomationService);
  });

  describe("access control", () => {
    it("allows a Sales department user to list automations", () => {
      prisma.hiringSignalAutomation.findMany.mockResolvedValue([]);
      expect(() => service.findAll(SALES_USER)).not.toThrow();
    });

    it("allows an Admin regardless of department", () => {
      prisma.hiringSignalAutomation.findMany.mockResolvedValue([]);
      expect(() => service.findAll(ADMIN_USER)).not.toThrow();
    });

    it("blocks a non-Sales, non-Admin user", () => {
      expect(() => service.findAll(NON_SALES_USER)).toThrow(ForbiddenException);
      expect(prisma.hiringSignalAutomation.findMany).not.toHaveBeenCalled();
    });
  });

  describe("create", () => {
    it("defaults targetTitles to the built-in list when none are supplied", async () => {
      prisma.hiringSignalAutomation.create.mockResolvedValue({ id: "auto-1" });

      await service.create({ name: "New automation", sequenceId: "seq-1" }, SALES_USER);

      const { data } = prisma.hiringSignalAutomation.create.mock.calls[0][0];
      expect(data.targetTitles.length).toBeGreaterThan(0);
      expect(data.createdById).toBe(SALES_USER.id);
    });

    it("preserves explicitly supplied targetTitles instead of the default", async () => {
      prisma.hiringSignalAutomation.create.mockResolvedValue({ id: "auto-1" });

      await service.create(
        { name: "New automation", sequenceId: "seq-1", targetTitles: ["Head of Growth"] },
        SALES_USER,
      );

      const { data } = prisma.hiringSignalAutomation.create.mock.calls[0][0];
      expect(data.targetTitles).toEqual(["Head of Growth"]);
    });
  });

  describe("update / remove", () => {
    it("throws NotFoundException when the automation doesn't exist", async () => {
      prisma.hiringSignalAutomation.findUnique.mockResolvedValue(null);
      await expect(service.update("missing", { name: "X" }, SALES_USER)).rejects.toThrow(NotFoundException);
    });

    it("blocks a non-Sales user from deleting an automation", async () => {
      await expect(service.remove("auto-1", NON_SALES_USER)).rejects.toThrow(ForbiddenException);
      expect(prisma.hiringSignalAutomation.delete).not.toHaveBeenCalled();
    });
  });
});
