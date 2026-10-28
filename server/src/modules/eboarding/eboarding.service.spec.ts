import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { EboardingService } from "./eboarding.service";
import { PrismaService } from "../../prisma/prisma.service";
import { ADMIN_USER, createPrismaMock, PrismaMock, RECRUITMENT_EMPLOYEE } from "../../test/prisma-mock";

describe("EboardingService", () => {
  let service: EboardingService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const module = await Test.createTestingModule({
      providers: [EboardingService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(EboardingService);
  });

  describe("create", () => {
    it("stamps createdById and defaults initiatedOn to today", () => {
      prisma.eboarding.create.mockResolvedValue({ id: "eb-1" });

      service.create({ name: "New Hire" } as any, RECRUITMENT_EMPLOYEE);

      const { data } = prisma.eboarding.create.mock.calls[0][0];
      expect(data.createdById).toBe(RECRUITMENT_EMPLOYEE.id);
      expect(data.initiatedOn).toBe(new Date().toISOString().split("T")[0]);
    });

    it("strips checklist items down to plain {id, name, completed} JSON", () => {
      prisma.eboarding.create.mockResolvedValue({ id: "eb-1" });

      service.create(
        {
          name: "New Hire",
          checklist: [
            { id: "1", name: "Offer letter", completed: true, extraneousField: "should not leak" } as any,
          ],
        } as any,
        RECRUITMENT_EMPLOYEE,
      );

      const { data } = prisma.eboarding.create.mock.calls[0][0];
      expect(data.checklist).toEqual([{ id: "1", name: "Offer letter", completed: true }]);
    });
  });

  describe("update / updateStatus", () => {
    it("blocks a non-Admin, non-creator from editing", async () => {
      prisma.eboarding.findUnique.mockResolvedValue({ id: "eb-1", createdById: "someone-else" });
      await expect(service.update("eb-1", { name: "X" } as any, RECRUITMENT_EMPLOYEE)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.eboarding.update).not.toHaveBeenCalled();
    });

    it("lets the creator update just the status", async () => {
      prisma.eboarding.findUnique.mockResolvedValue({ id: "eb-1", createdById: ADMIN_USER.id });
      prisma.eboarding.update.mockResolvedValue({ id: "eb-1", status: "IN_PROGRESS" });

      const result = await service.updateStatus("eb-1", { status: "IN_PROGRESS" } as any, ADMIN_USER);

      expect(prisma.eboarding.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "eb-1" }, data: { status: "IN_PROGRESS" } }),
      );
      expect(result.status).toBe("IN_PROGRESS");
    });

    it("throws NotFoundException updating a record that doesn't exist", async () => {
      prisma.eboarding.findUnique.mockResolvedValue(null);
      await expect(service.update("missing", { name: "X" } as any, ADMIN_USER)).rejects.toThrow(NotFoundException);
    });
  });

  describe("remove", () => {
    it("blocks a non-Admin, non-creator from deleting", async () => {
      prisma.eboarding.findUnique.mockResolvedValue({ id: "eb-1", createdById: "someone-else" });
      await expect(service.remove("eb-1", RECRUITMENT_EMPLOYEE)).rejects.toThrow(ForbiddenException);
      expect(prisma.eboarding.delete).not.toHaveBeenCalled();
    });
  });
});
