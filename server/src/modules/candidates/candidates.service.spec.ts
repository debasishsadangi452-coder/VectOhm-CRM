import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { CandidateStage, JobPostingStatus, Prisma, RoleName } from "@prisma/client";
import { CandidatesService } from "./candidates.service";
import type { RequestUser } from "../../common/types/request-user.type";

function buildTx() {
  return {
    candidate: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
  };
}

function buildPrismaMock() {
  const tx = buildTx();
  const transaction = jest.fn();
  // Default: run the callback against the shared tx mock, same shape as
  // the real Prisma interactive-transaction API. Individual tests override
  // this via mockImplementation/mockRejectedValue to simulate conflicts.
  transaction.mockImplementation((cb: (tx: unknown) => unknown) => Promise.resolve(cb(tx)));

  return {
    candidate: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    jobPosting: { findUnique: jest.fn() },
    $transaction: transaction,
    __tx: tx,
  };
}

function buildStorageMock() {
  return {
    listOrphaned: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue(undefined),
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
const nonRecruitmentEmployee = () =>
  buildUser({
    role: { id: "r-emp", name: RoleName.EMPLOYEE },
    department: { id: "dept-2", name: "Engineering", managerTitle: "Eng Manager" },
  });

function conflictError() {
  return new Prisma.PrismaClientKnownRequestError("write conflict", {
    code: "P2034",
    clientVersion: "test",
  });
}

describe("CandidatesService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let storage: ReturnType<typeof buildStorageMock>;
  let service: CandidatesService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = buildPrismaMock();
    storage = buildStorageMock();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new CandidatesService(prisma as any, storage as any);
  });

  describe("visibilityScope (via findAll)", () => {
    it("ADMIN sees everything by default", () => {
      prisma.candidate.findMany.mockResolvedValue([]);
      service.findAll({}, admin());
      const where = prisma.candidate.findMany.mock.calls[0][0].where;
      expect(where.departmentId).toBeUndefined();
      expect(where.ownerId).toBeUndefined();
    });

    it("rejects a user outside Recruitment", () => {
      expect(() => service.findAll({}, nonRecruitmentEmployee())).toThrow(
        "Access denied: You do not have access to Recruitment candidates",
      );
    });

    it("MANAGER is scoped to their department (sees every recruiter's candidates)", () => {
      prisma.candidate.findMany.mockResolvedValue([]);
      service.findAll({}, manager());
      const where = prisma.candidate.findMany.mock.calls[0][0].where;
      expect(where.departmentId).toBe("dept-1");
      expect(where.ownerId).toBeUndefined();
    });

    it("EMPLOYEE is scoped to their own assigned candidates only", () => {
      prisma.candidate.findMany.mockResolvedValue([]);
      service.findAll({}, employee());
      const where = prisma.candidate.findMany.mock.calls[0][0].where;
      expect(where.departmentId).toBe("dept-1");
      expect(where.ownerId).toBe("user-1");
    });
  });

  describe("findOne / assertCanAccess", () => {
    function mockFound(candidate: Record<string, unknown>) {
      prisma.candidate.findUnique.mockResolvedValue(candidate);
    }

    it("throws NotFoundException when missing", async () => {
      prisma.candidate.findUnique.mockResolvedValue(null);
      await expect(service.findOne("missing", admin())).rejects.toThrow(NotFoundException);
    });

    it("EMPLOYEE cannot view a candidate assigned to someone else", async () => {
      mockFound({ id: "c1", ownerId: "someone-else", departmentId: "dept-1" });
      await expect(service.findOne("c1", employee())).rejects.toThrow(
        "Access denied: You can only view candidates assigned to you",
      );
    });

    it("EMPLOYEE can view their own assigned candidate", async () => {
      mockFound({ id: "c1", ownerId: "user-1", departmentId: "dept-1" });
      await expect(service.findOne("c1", employee())).resolves.toBeDefined();
    });

    it("MANAGER cannot view a candidate scoped to a different department", async () => {
      mockFound({ id: "c1", ownerId: "other", departmentId: "dept-9" });
      await expect(service.findOne("c1", manager())).rejects.toThrow(
        "Access denied: This candidate belongs to another department",
      );
    });
  });

  describe("createPublicApplication", () => {
    const openJob = {
      id: "job-1",
      status: JobPostingStatus.OPEN,
      ownerId: "recruiter-1",
      departmentId: "dept-1",
    };

    it("rejects a nonexistent job posting", async () => {
      prisma.jobPosting.findUnique.mockResolvedValue(null);
      await expect(
        service.createPublicApplication({
          jobPostingId: "missing",
          firstName: "A",
          lastName: "B",
          email: "a@b.com",
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("rejects a closed job posting", async () => {
      prisma.jobPosting.findUnique.mockResolvedValue({
        ...openJob,
        status: JobPostingStatus.CLOSED,
      });
      await expect(
        service.createPublicApplication({
          jobPostingId: "job-1",
          firstName: "A",
          lastName: "B",
          email: "a@b.com",
        }),
      ).rejects.toThrow("Job posting not found or no longer accepting applications");
    });

    it("defaults ownerId and departmentId from the job posting, not from any caller", async () => {
      prisma.jobPosting.findUnique.mockResolvedValue(openJob);
      prisma.__tx.candidate.create.mockResolvedValue({ id: "cand-1" });

      await service.createPublicApplication({
        jobPostingId: "job-1",
        firstName: "Jane",
        lastName: "Applicant",
        email: "jane@example.com",
      });

      const data = prisma.__tx.candidate.create.mock.calls[0][0].data;
      expect(data.ownerId).toBe("recruiter-1");
      expect(data.departmentId).toBe("dept-1");
      expect(data.stage).toBe(CandidateStage.APPLIED);
    });

    it("uppercases the source and defaults to CAREERS_SITE when not provided", async () => {
      prisma.jobPosting.findUnique.mockResolvedValue(openJob);
      prisma.__tx.candidate.create.mockResolvedValue({ id: "cand-1" });

      await service.createPublicApplication({
        jobPostingId: "job-1",
        firstName: "A",
        lastName: "B",
        email: "a@b.com",
      });
      expect(prisma.__tx.candidate.create.mock.calls[0][0].data.source).toBe("CAREERS_SITE");

      await service.createPublicApplication({
        jobPostingId: "job-1",
        firstName: "A",
        lastName: "B",
        email: "a@b.com",
        source: "linkedin",
      });
      expect(prisma.__tx.candidate.create.mock.calls[1][0].data.source).toBe("LINKEDIN");
    });

    it("assigns position 0 for the first candidate in a stage, incrementing from the highest existing position", async () => {
      prisma.jobPosting.findUnique.mockResolvedValue(openJob);
      prisma.__tx.candidate.findFirst.mockResolvedValue({ position: 4 });
      prisma.__tx.candidate.create.mockResolvedValue({ id: "cand-1" });

      await service.createPublicApplication({
        jobPostingId: "job-1",
        firstName: "A",
        lastName: "B",
        email: "a@b.com",
      });

      expect(prisma.__tx.candidate.create.mock.calls[0][0].data.position).toBe(5);
    });
  });

  describe("createWithNextPosition retry behavior (via createPublicApplication)", () => {
    const openJob = {
      id: "job-1",
      status: JobPostingStatus.OPEN,
      ownerId: "recruiter-1",
      departmentId: "dept-1",
    };

    beforeEach(() => {
      prisma.jobPosting.findUnique.mockResolvedValue(openJob);
    });

    it("retries once on a P2034 serialization conflict and succeeds", async () => {
      let attempt = 0;
      prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) => {
        attempt += 1;
        if (attempt === 1) {
          return Promise.reject(conflictError());
        }
        return Promise.resolve(cb(prisma.__tx));
      });
      prisma.__tx.candidate.create.mockResolvedValue({ id: "cand-1" });

      const result = await service.createPublicApplication({
        jobPostingId: "job-1",
        firstName: "A",
        lastName: "B",
        email: "a@b.com",
      });

      expect(result).toEqual({ id: "cand-1" });
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it("gives up after exhausting retries and throws a clean ConflictException, not a raw error", async () => {
      prisma.$transaction.mockRejectedValue(conflictError());

      await expect(
        service.createPublicApplication({
          jobPostingId: "job-1",
          firstName: "A",
          lastName: "B",
          email: "a@b.com",
        }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.$transaction).toHaveBeenCalledTimes(3); // MAX_POSITION_ATTEMPTS
    });

    it("does not retry a non-conflict error -- propagates immediately", async () => {
      prisma.$transaction.mockRejectedValue(new Error("totally unrelated DB error"));

      await expect(
        service.createPublicApplication({
          jobPostingId: "job-1",
          firstName: "A",
          lastName: "B",
          email: "a@b.com",
        }),
      ).rejects.toThrow("totally unrelated DB error");
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe("create (authenticated, internal)", () => {
    it("rejects a job posting that doesn't exist", async () => {
      prisma.jobPosting.findUnique.mockResolvedValue(null);
      await expect(
        service.create(
          { firstName: "A", lastName: "B", jobPostingId: "missing" } as never,
          employee(),
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("defaults ownerId/departmentId to the creator when not explicitly provided", async () => {
      prisma.jobPosting.findUnique.mockResolvedValue({ id: "job-1" });
      prisma.__tx.candidate.create.mockResolvedValue({ id: "cand-1" });

      await service.create(
        { firstName: "A", lastName: "B", jobPostingId: "job-1" } as never,
        employee(),
      );

      const data = prisma.__tx.candidate.create.mock.calls[0][0].data;
      expect(data.ownerId).toBe("user-1");
      expect(data.departmentId).toBe("dept-1");
    });

    it("skips the position-assignment transaction entirely when an explicit position is given", async () => {
      prisma.jobPosting.findUnique.mockResolvedValue({ id: "job-1" });
      prisma.candidate.create.mockResolvedValue({ id: "cand-1" });

      await service.create(
        { firstName: "A", lastName: "B", jobPostingId: "job-1", position: 7 } as never,
        employee(),
      );

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.candidate.create.mock.calls[0][0].data.position).toBe(7);
    });

    it("stamps closedAt when created directly into a closed stage (HIRED/REJECTED)", async () => {
      prisma.jobPosting.findUnique.mockResolvedValue({ id: "job-1" });
      prisma.candidate.create.mockResolvedValue({ id: "cand-1" });

      await service.create(
        {
          firstName: "A",
          lastName: "B",
          jobPostingId: "job-1",
          position: 0,
          stage: CandidateStage.REJECTED,
        } as never,
        employee(),
      );

      expect(prisma.candidate.create.mock.calls[0][0].data.closedAt).toBeInstanceOf(Date);
    });

    it("persists every profile field collected on the create/detail panels", async () => {
      // Regression coverage: addApplicant() in the frontend used to only send
      // firstName/lastName/email/phone/city/state/isStarred/source/jobPostingId
      // and the rest (resume, skills, comp, education, ...) silently vanished.
      prisma.jobPosting.findUnique.mockResolvedValue({ id: "job-1" });
      prisma.candidate.create.mockResolvedValue({ id: "cand-1" });

      await service.create(
        {
          firstName: "Jane",
          lastName: "Doe",
          jobPostingId: "job-1",
          position: 0,
          resumeUrl: "/candidates/resumes/abc123.pdf",
          currentTitle: "Senior Full Stack Engineer",
          totalExperienceYears: 6,
          currentSalary: 115000,
          expectedSalary: 135000,
          noticePeriodDays: 30,
          skills: ["TypeScript", "React", "AWS"],
          summary: "Full stack engineer with 6 years of experience.",
          educationDegree: "B.S. Computer Science",
          educationInstitution: "University of Toronto",
          educationYear: "2018",
          certifications: ["AWS Certified Solutions Architect"],
          workAuthorization: "Authorized / Citizen",
          willingToRelocate: "Yes (Hybrid / Remote)",
        } as never,
        employee(),
      );

      expect(prisma.candidate.create.mock.calls[0][0].data).toMatchObject({
        resumeUrl: "/candidates/resumes/abc123.pdf",
        currentTitle: "Senior Full Stack Engineer",
        totalExperienceYears: 6,
        currentSalary: 115000,
        expectedSalary: 135000,
        noticePeriodDays: 30,
        skills: ["TypeScript", "React", "AWS"],
        summary: "Full stack engineer with 6 years of experience.",
        educationDegree: "B.S. Computer Science",
        educationInstitution: "University of Toronto",
        educationYear: "2018",
        certifications: ["AWS Certified Solutions Architect"],
        workAuthorization: "Authorized / Citizen",
        willingToRelocate: "Yes (Hybrid / Remote)",
      });
    });
  });

  describe("update", () => {
    it("throws NotFoundException for a missing candidate", async () => {
      prisma.candidate.findUnique.mockResolvedValue(null);
      await expect(service.update("missing", { firstName: "X" } as never, admin())).rejects.toThrow(
        NotFoundException,
      );
    });

    it("blocks an employee from updating a candidate they don't own", async () => {
      prisma.candidate.findUnique.mockResolvedValue({ id: "c1", departmentId: "dept-1", ownerId: "someone-else" });
      await expect(service.update("c1", { firstName: "X" } as never, employee())).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.candidate.update).not.toHaveBeenCalled();
    });

    it("validates the new job posting exists when re-parenting", async () => {
      prisma.candidate.findUnique.mockResolvedValue({ id: "c1", departmentId: "dept-1", ownerId: "user-1" });
      prisma.jobPosting.findUnique.mockResolvedValue(null);
      await expect(
        service.update("c1", { jobPostingId: "job-does-not-exist" } as never, employee()),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.candidate.update).not.toHaveBeenCalled();
    });

    it("persists updated profile fields (resumeUrl, skills, summary, etc.)", async () => {
      prisma.candidate.findUnique.mockResolvedValue({ id: "c1", departmentId: "dept-1", ownerId: "user-1" });
      prisma.candidate.update.mockResolvedValue({ id: "c1" });

      await service.update(
        "c1",
        {
          resumeUrl: "/candidates/resumes/new.pdf",
          skills: ["Go", "Kubernetes"],
          summary: "Updated summary",
          certifications: ["CKA"],
        } as never,
        employee(),
      );

      expect(prisma.candidate.update.mock.calls[0][0].data).toMatchObject({
        resumeUrl: "/candidates/resumes/new.pdf",
        skills: ["Go", "Kubernetes"],
        summary: "Updated summary",
        certifications: ["CKA"],
      });
    });

    it("stamps closedAt when moving into HIRED and clears it when reopened", async () => {
      prisma.candidate.findUnique.mockResolvedValue({ id: "c1", departmentId: "dept-1", ownerId: "user-1" });
      prisma.candidate.update.mockResolvedValue({ id: "c1" });

      await service.update("c1", { stage: CandidateStage.HIRED } as never, employee());
      expect(prisma.candidate.update.mock.calls[0][0].data.closedAt).toBeInstanceOf(Date);

      await service.update("c1", { stage: CandidateStage.SCREENING } as never, employee());
      expect(prisma.candidate.update.mock.calls[1][0].data.closedAt).toBeNull();
    });

    it("leaves closedAt untouched when the stage isn't part of the update", async () => {
      prisma.candidate.findUnique.mockResolvedValue({ id: "c1", departmentId: "dept-1", ownerId: "user-1" });
      prisma.candidate.update.mockResolvedValue({ id: "c1" });

      await service.update("c1", { firstName: "Renamed" } as never, employee());
      expect(prisma.candidate.update.mock.calls[0][0].data.closedAt).toBeUndefined();
    });
  });

  describe("remove", () => {
    it("deletes when the caller can mutate the candidate", async () => {
      prisma.candidate.findUnique.mockResolvedValue({ id: "c1", departmentId: "dept-1", ownerId: "user-1" });
      await service.remove("c1", employee());
      expect(prisma.candidate.delete).toHaveBeenCalledWith({ where: { id: "c1" } });
    });

    it("refuses to delete a candidate owned by another employee", async () => {
      prisma.candidate.findUnique.mockResolvedValue({ id: "c1", departmentId: "dept-1", ownerId: "someone-else" });
      await expect(service.remove("c1", employee())).rejects.toThrow(ForbiddenException);
      expect(prisma.candidate.delete).not.toHaveBeenCalled();
    });
  });

  describe("cleanupOrphanedResumes", () => {
    it("deletes every file the storage layer reports as orphaned", async () => {
      prisma.candidate.findMany.mockResolvedValue([
        { resumeUrl: "/candidates/resumes/keep-me.pdf" },
      ]);
      storage.listOrphaned.mockResolvedValue(["orphan-1.pdf", "orphan-2.pdf"]);

      const result = await service.cleanupOrphanedResumes();

      expect(storage.listOrphaned).toHaveBeenCalledWith(
        new Set(["keep-me.pdf"]),
        24 * 60 * 60 * 1000,
      );
      expect(storage.delete).toHaveBeenCalledWith("orphan-1.pdf");
      expect(storage.delete).toHaveBeenCalledWith("orphan-2.pdf");
      expect(result).toEqual({ deleted: 2 });
    });

    it("only queries candidates whose resumeUrl looks like our own upload path", async () => {
      prisma.candidate.findMany.mockResolvedValue([]);
      storage.listOrphaned.mockResolvedValue([]);

      await service.cleanupOrphanedResumes();

      expect(prisma.candidate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { resumeUrl: { startsWith: "/candidates/resumes/" } } }),
      );
    });

    it("does nothing (deletes nothing) when there's nothing orphaned", async () => {
      prisma.candidate.findMany.mockResolvedValue([]);
      storage.listOrphaned.mockResolvedValue([]);

      const result = await service.cleanupOrphanedResumes();

      expect(storage.delete).not.toHaveBeenCalled();
      expect(result).toEqual({ deleted: 0 });
    });
  });
});
