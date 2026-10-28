import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { CandidateStage, OfferStatus } from "@prisma/client";
import { OffersService } from "./offers.service";
import { PrismaService } from "../../prisma/prisma.service";
import { ADMIN_USER, createPrismaMock, PrismaMock, RECRUITMENT_EMPLOYEE, RECRUITMENT_MANAGER, makeUser } from "../../test/prisma-mock";

describe("OffersService", () => {
  let service: OffersService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const module = await Test.createTestingModule({
      providers: [OffersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(OffersService);
  });

  describe("create", () => {
    it("throws NotFoundException if the candidate doesn't exist", async () => {
      prisma.candidate.findUnique.mockResolvedValue(null);
      await expect(service.create({ candidateId: "missing", salary: 100000 } as any, ADMIN_USER)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.offer.create).not.toHaveBeenCalled();
    });

    it("defaults to DRAFT, inherits the candidate's department, and only stamps sentAt when sent immediately", async () => {
      prisma.candidate.findUnique.mockResolvedValue({ id: "cand-1", departmentId: "dept-recruitment" });
      prisma.offer.create.mockResolvedValue({ id: "offer-1" });

      await service.create({ candidateId: "cand-1", salary: 100000 } as any, ADMIN_USER);

      const { data } = prisma.offer.create.mock.calls[0][0];
      expect(data.status).toBe(OfferStatus.DRAFT);
      expect(data.departmentId).toBe("dept-recruitment");
      expect(data.sentAt).toBeUndefined();
    });

    it("stamps sentAt when created directly with status SENT", async () => {
      prisma.candidate.findUnique.mockResolvedValue({ id: "cand-1", departmentId: "dept-recruitment" });
      prisma.offer.create.mockResolvedValue({ id: "offer-1" });

      await service.create({ candidateId: "cand-1", salary: 100000, status: OfferStatus.SENT } as any, ADMIN_USER);

      const { data } = prisma.offer.create.mock.calls[0][0];
      expect(data.sentAt).toBeInstanceOf(Date);
    });
  });

  describe("update", () => {
    const existingOffer = { id: "offer-1", candidateId: "cand-1", status: OfferStatus.SENT, departmentId: "dept-recruitment", createdById: ADMIN_USER.id };

    it("cascades an ACCEPTED offer into HIRED on the candidate, in the same transaction", async () => {
      prisma.offer.findUnique.mockResolvedValue(existingOffer);
      prisma.offer.update.mockResolvedValue({ id: "offer-1", status: OfferStatus.ACCEPTED });
      prisma.candidate.update.mockResolvedValue({ id: "cand-1", stage: CandidateStage.HIRED });

      await service.update("offer-1", { status: OfferStatus.ACCEPTED } as any, ADMIN_USER);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.candidate.update).toHaveBeenCalledWith({
        where: { id: "cand-1" },
        data: { stage: CandidateStage.HIRED, closedAt: expect.any(Date) },
      });
      const { data } = prisma.offer.update.mock.calls[0][0];
      expect(data.respondedAt).toBeInstanceOf(Date);
    });

    it("cascades a DECLINED offer into REJECTED on the candidate with a rejection reason", async () => {
      prisma.offer.findUnique.mockResolvedValue(existingOffer);
      prisma.offer.update.mockResolvedValue({ id: "offer-1", status: OfferStatus.DECLINED });
      prisma.candidate.update.mockResolvedValue({ id: "cand-1" });

      await service.update("offer-1", { status: OfferStatus.DECLINED } as any, ADMIN_USER);

      expect(prisma.candidate.update).toHaveBeenCalledWith({
        where: { id: "cand-1" },
        data: { stage: CandidateStage.REJECTED, closedAt: expect.any(Date), rejectionReason: "Candidate declined offer" },
      });
    });

    it("does not touch the candidate when the status isn't changing", async () => {
      prisma.offer.findUnique.mockResolvedValue(existingOffer);
      prisma.offer.update.mockResolvedValue({ id: "offer-1", status: OfferStatus.SENT });

      await service.update("offer-1", { notes: "Following up" } as any, ADMIN_USER);

      expect(prisma.candidate.update).not.toHaveBeenCalled();
    });

    it("blocks an employee who didn't create the offer and isn't its department's manager", async () => {
      prisma.offer.findUnique.mockResolvedValue({ ...existingOffer, createdById: "someone-else" });
      await expect(service.update("offer-1", { notes: "x" } as any, RECRUITMENT_EMPLOYEE)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("lets the department manager mutate an offer they didn't create", async () => {
      prisma.offer.findUnique.mockResolvedValue({ ...existingOffer, createdById: "someone-else", departmentId: RECRUITMENT_MANAGER.department!.id });
      prisma.offer.update.mockResolvedValue({ id: "offer-1" });

      await expect(service.update("offer-1", { notes: "x" } as any, RECRUITMENT_MANAGER)).resolves.toBeDefined();
    });

    it("throws NotFoundException for a missing offer", async () => {
      prisma.offer.findUnique.mockResolvedValue(null);
      await expect(service.update("missing", { notes: "x" } as any, ADMIN_USER)).rejects.toThrow(NotFoundException);
    });
  });

  describe("findOne", () => {
    it("blocks access to an offer outside the caller's department", async () => {
      prisma.offer.findUnique.mockResolvedValue({ id: "offer-1", departmentId: "dept-other" });
      const outsider = makeUser({ department: { id: "dept-mine", name: "Recruitment", managerTitle: "Manager" }, role: { id: "role-employee", name: RECRUITMENT_EMPLOYEE.role.name } });
      await expect(service.findOne("offer-1", outsider)).rejects.toThrow(ForbiddenException);
    });

    it("allows access to a department-less (legacy) offer", async () => {
      prisma.offer.findUnique.mockResolvedValue({ id: "offer-1", departmentId: null });
      await expect(service.findOne("offer-1", RECRUITMENT_EMPLOYEE)).resolves.toMatchObject({ id: "offer-1" });
    });

    it("throws NotFoundException when missing", async () => {
      prisma.offer.findUnique.mockResolvedValue(null);
      await expect(service.findOne("missing", ADMIN_USER)).rejects.toThrow(NotFoundException);
    });
  });

  describe("remove", () => {
    it("blocks a non-Admin, non-creator, non-manager from deleting", async () => {
      prisma.offer.findUnique.mockResolvedValue({ id: "offer-1", createdById: "someone-else", departmentId: "dept-other" });
      await expect(service.remove("offer-1", RECRUITMENT_EMPLOYEE)).rejects.toThrow(ForbiddenException);
      expect(prisma.offer.delete).not.toHaveBeenCalled();
    });

    it("deletes once permission is confirmed", async () => {
      prisma.offer.findUnique.mockResolvedValue({ id: "offer-1", createdById: ADMIN_USER.id, departmentId: null });
      await service.remove("offer-1", ADMIN_USER);
      expect(prisma.offer.delete).toHaveBeenCalledWith({ where: { id: "offer-1" } });
    });
  });
});
