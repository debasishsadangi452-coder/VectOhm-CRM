import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { LeadsService } from "./leads.service";
import { PrismaService } from "../../prisma/prisma.service";
import { ADMIN_USER, createPrismaMock, PrismaMock, RECRUITMENT_EMPLOYEE } from "../../test/prisma-mock";

describe("LeadsService", () => {
  let service: LeadsService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const module = await Test.createTestingModule({
      providers: [LeadsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(LeadsService);
  });

  describe("create", () => {
    it("stamps createdById and an initial lastActivityAt", () => {
      prisma.lead.create.mockResolvedValue({ id: "lead-1" });

      service.create({ name: "Referral from Jane" }, RECRUITMENT_EMPLOYEE);

      const { data } = prisma.lead.create.mock.calls[0][0];
      expect(data.createdById).toBe(RECRUITMENT_EMPLOYEE.id);
      expect(data.lastActivityAt).toBeInstanceOf(Date);
    });
  });

  describe("update", () => {
    it("bumps lastActivityAt on every edit", async () => {
      prisma.lead.findUnique.mockResolvedValue({ id: "l1", createdById: ADMIN_USER.id });
      prisma.lead.update.mockResolvedValue({ id: "l1" });

      await service.update("l1", { status: "Contacted" }, ADMIN_USER);

      const { data } = prisma.lead.update.mock.calls[0][0];
      expect(data.lastActivityAt).toBeInstanceOf(Date);
      expect(data.status).toBe("Contacted");
    });

    it("blocks a non-Admin, non-creator from editing", async () => {
      prisma.lead.findUnique.mockResolvedValue({ id: "l1", createdById: "someone-else" });
      await expect(service.update("l1", { status: "Contacted" }, RECRUITMENT_EMPLOYEE)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.lead.update).not.toHaveBeenCalled();
    });

    it("throws NotFoundException for a missing lead", async () => {
      prisma.lead.findUnique.mockResolvedValue(null);
      await expect(service.update("missing", { status: "Contacted" }, ADMIN_USER)).rejects.toThrow(NotFoundException);
    });
  });

  describe("remove", () => {
    it("blocks a non-Admin, non-creator from deleting", async () => {
      prisma.lead.findUnique.mockResolvedValue({ id: "l1", createdById: "someone-else" });
      await expect(service.remove("l1", RECRUITMENT_EMPLOYEE)).rejects.toThrow(ForbiddenException);
      expect(prisma.lead.delete).not.toHaveBeenCalled();
    });

    it("deletes once ownership is confirmed", async () => {
      prisma.lead.findUnique.mockResolvedValue({ id: "l1", createdById: ADMIN_USER.id });
      await service.remove("l1", ADMIN_USER);
      expect(prisma.lead.delete).toHaveBeenCalledWith({ where: { id: "l1" } });
    });
  });

  describe("findOne", () => {
    it("throws NotFoundException when missing", async () => {
      prisma.lead.findUnique.mockResolvedValue(null);
      await expect(service.findOne("missing")).rejects.toThrow(NotFoundException);
    });
  });
});
