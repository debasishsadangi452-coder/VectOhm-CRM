import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ClientsService } from "./clients.service";
import { PrismaService } from "../../prisma/prisma.service";
import { ADMIN_USER, createPrismaMock, PrismaMock, RECRUITMENT_EMPLOYEE, makeUser } from "../../test/prisma-mock";

describe("ClientsService", () => {
  let service: ClientsService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const module = await Test.createTestingModule({
      providers: [ClientsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(ClientsService);
  });

  describe("create", () => {
    it("stamps createdById from the requesting user", () => {
      prisma.client.create.mockResolvedValue({ id: "client-1" });

      service.create({ name: "Acme Corp" }, RECRUITMENT_EMPLOYEE);

      const { data } = prisma.client.create.mock.calls[0][0];
      expect(data.createdById).toBe(RECRUITMENT_EMPLOYEE.id);
      expect(data.name).toBe("Acme Corp");
    });
  });

  describe("findOne", () => {
    it("throws NotFoundException when missing", async () => {
      prisma.client.findUnique.mockResolvedValue(null);
      await expect(service.findOne("missing")).rejects.toThrow(NotFoundException);
    });
  });

  describe("update / remove", () => {
    it("lets an Admin edit a client they didn't create", async () => {
      prisma.client.findUnique.mockResolvedValue({ id: "c1", createdById: "someone-else" });
      prisma.client.update.mockResolvedValue({ id: "c1", name: "Renamed" });

      await expect(service.update("c1", { name: "Renamed" }, ADMIN_USER)).resolves.toMatchObject({ name: "Renamed" });
    });

    it("lets the creator edit their own client", async () => {
      const creator = makeUser({ id: "creator-1" });
      prisma.client.findUnique.mockResolvedValue({ id: "c1", createdById: "creator-1" });
      prisma.client.update.mockResolvedValue({ id: "c1" });

      await expect(service.update("c1", { name: "X" }, creator)).resolves.toBeDefined();
    });

    it("blocks a non-Admin, non-creator from editing", async () => {
      prisma.client.findUnique.mockResolvedValue({ id: "c1", createdById: "someone-else" });
      await expect(service.update("c1", { name: "X" }, RECRUITMENT_EMPLOYEE)).rejects.toThrow(ForbiddenException);
      expect(prisma.client.update).not.toHaveBeenCalled();
    });

    it("blocks a non-Admin, non-creator from deleting", async () => {
      prisma.client.findUnique.mockResolvedValue({ id: "c1", createdById: "someone-else" });
      await expect(service.remove("c1", RECRUITMENT_EMPLOYEE)).rejects.toThrow(ForbiddenException);
      expect(prisma.client.delete).not.toHaveBeenCalled();
    });

    it("deletes once ownership is confirmed", async () => {
      prisma.client.findUnique.mockResolvedValue({ id: "c1", createdById: ADMIN_USER.id });
      await service.remove("c1", ADMIN_USER);
      expect(prisma.client.delete).toHaveBeenCalledWith({ where: { id: "c1" } });
    });

    it("throws NotFoundException updating a client that doesn't exist", async () => {
      prisma.client.findUnique.mockResolvedValue(null);
      await expect(service.update("missing", { name: "X" }, ADMIN_USER)).rejects.toThrow(NotFoundException);
    });
  });
});
