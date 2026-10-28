import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { VendorsService } from "./vendors.service";
import { PrismaService } from "../../prisma/prisma.service";
import { ADMIN_USER, createPrismaMock, PrismaMock, RECRUITMENT_EMPLOYEE, makeUser } from "../../test/prisma-mock";

describe("VendorsService", () => {
  let service: VendorsService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const module = await Test.createTestingModule({
      providers: [VendorsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(VendorsService);
  });

  describe("create", () => {
    it("stamps createdById from the requesting user", () => {
      prisma.vendor.create.mockResolvedValue({ id: "vendor-1" });

      service.create({ name: "Staffing Partners Inc" }, RECRUITMENT_EMPLOYEE);

      const { data } = prisma.vendor.create.mock.calls[0][0];
      expect(data.createdById).toBe(RECRUITMENT_EMPLOYEE.id);
      expect(data.name).toBe("Staffing Partners Inc");
    });
  });

  describe("update", () => {
    it("stamps modifiedById with whoever is doing the edit", async () => {
      prisma.vendor.findUnique.mockResolvedValue({ id: "v1", createdById: ADMIN_USER.id });
      prisma.vendor.update.mockResolvedValue({ id: "v1" });
      const editor = makeUser({ id: "editor-1", role: { id: "role-admin", name: ADMIN_USER.role.name } });

      await service.update("v1", { name: "Renamed" }, editor);

      const { data } = prisma.vendor.update.mock.calls[0][0];
      expect(data.modifiedById).toBe("editor-1");
    });

    it("blocks a non-Admin, non-creator from editing", async () => {
      prisma.vendor.findUnique.mockResolvedValue({ id: "v1", createdById: "someone-else" });
      await expect(service.update("v1", { name: "X" }, RECRUITMENT_EMPLOYEE)).rejects.toThrow(ForbiddenException);
      expect(prisma.vendor.update).not.toHaveBeenCalled();
    });

    it("throws NotFoundException for a missing vendor", async () => {
      prisma.vendor.findUnique.mockResolvedValue(null);
      await expect(service.update("missing", { name: "X" }, ADMIN_USER)).rejects.toThrow(NotFoundException);
    });
  });

  describe("remove", () => {
    it("deletes once ownership is confirmed", async () => {
      prisma.vendor.findUnique.mockResolvedValue({ id: "v1", createdById: ADMIN_USER.id });
      await service.remove("v1", ADMIN_USER);
      expect(prisma.vendor.delete).toHaveBeenCalledWith({ where: { id: "v1" } });
    });

    it("blocks a non-Admin, non-creator from deleting", async () => {
      prisma.vendor.findUnique.mockResolvedValue({ id: "v1", createdById: "someone-else" });
      await expect(service.remove("v1", RECRUITMENT_EMPLOYEE)).rejects.toThrow(ForbiddenException);
      expect(prisma.vendor.delete).not.toHaveBeenCalled();
    });
  });

  describe("findOne", () => {
    it("throws NotFoundException when missing", async () => {
      prisma.vendor.findUnique.mockResolvedValue(null);
      await expect(service.findOne("missing")).rejects.toThrow(NotFoundException);
    });
  });
});
