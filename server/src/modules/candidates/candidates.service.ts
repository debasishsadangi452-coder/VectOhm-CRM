import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { CandidateStage, JobPostingStatus, Prisma, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CandidateStorageService } from "./candidate-storage.service";
import { CandidateAiMatcherService } from "./candidate-ai-matcher.service";
import { CreateCandidateDto } from "./dto/create-candidate.dto";
import { UpdateCandidateDto } from "./dto/update-candidate.dto";
import { CandidateNotificationService } from "./candidate-notification.service";
import type { RequestUser } from "../../common/types/request-user.type";

// Shape CareersService passes in from SubmitApplicationDto -- kept local
// (rather than importing that DTO) so CandidatesModule doesn't depend on
// CareersModule; the dependency runs the other way (careers -> candidates).
export interface PublicApplicationInput {
  jobPostingId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  resumeUrl?: string;
  source?: string;
  gclid?: string;
  utmSource?: string;
  utmCampaign?: string;
}

const candidateInclude = {
  owner: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  jobPosting: { select: { id: true, title: true } },
} as const;

interface CandidateFilters {
  jobPostingId?: string;
  stage?: CandidateStage;
  ownerId?: string;
  departmentId?: string;
}

// Candidate.closedAt marks when a candidate's process actually ended --
// same rationale as Deal.closedAt (updatedAt changes on any edit and can't
// answer "when did this stop being an open candidacy" for hiring analytics).
const CLOSED_STAGES: CandidateStage[] = [CandidateStage.HIRED, CandidateStage.REJECTED];

// How many times to retry a position assignment that lost a serialization
// race (see createWithNextPosition below) before giving up.
const MAX_POSITION_ATTEMPTS = 3;

// Matches the shape both CandidatesController.uploadResume and
// CareersController.uploadResume hand back (see candidate-storage.service.ts).
const RESUME_URL_PREFIX = "/candidates/resumes/";
// Grace period before an unreferenced upload is considered orphaned --
// generous enough that someone mid-way through filling out the careers/apply
// form (uploaded a resume, hasn't hit submit yet) is never at risk of losing
// it out from under them.
const ORPHAN_RESUME_MAX_AGE_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class CandidatesService {
  private readonly logger = new Logger(CandidatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: CandidateStorageService,
    private readonly aiMatcher: CandidateAiMatcherService = new CandidateAiMatcherService(),
    @Optional() private readonly notificationService?: CandidateNotificationService,
  ) {}

  findAll(filters: CandidateFilters, user: RequestUser) {
    return this.prisma.candidate.findMany({
      where: {
        jobPostingId: filters.jobPostingId,
        stage: filters.stage,
        ownerId: filters.ownerId,
        ...this.visibilityScope(user, filters.departmentId),
      },
      include: candidateInclude,
      orderBy: [{ stage: "asc" }, { position: "asc" }],
    });
  }

  private visibilityScope(user: RequestUser, requestedDepartmentId?: string) {
    if (user.role.name === RoleName.ADMIN) {
      return requestedDepartmentId ? { departmentId: requestedDepartmentId } : {};
    }
    const isRecruitment = (user.department?.name || "").toLowerCase().includes("recruit");
    if (!isRecruitment) {
      throw new ForbiddenException("Access denied: You do not have access to Recruitment candidates");
    }
    if (user.role.name === RoleName.MANAGER) {
      return { departmentId: user.department?.id };
    }
    // Recruitment Employee: assigned candidates
    return {
      departmentId: user.department?.id,
      ownerId: user.id,
    };
  }

  async findOne(id: string, user: RequestUser) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id },
      include: {
        ...candidateInclude,
        interviews: {
          include: {
            interviewer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
            createdBy: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { scheduledAt: "asc" },
        },
        offers: {
          include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!candidate) {
      throw new NotFoundException("Candidate not found");
    }
    this.assertCanAccess(candidate, user);
    return candidate;
  }

  async create(dto: CreateCandidateDto, creator: RequestUser) {
    const posting = await this.assertJobPostingExists(dto.jobPostingId);
    let stage = dto.stage ?? CandidateStage.APPLIED;

    const match = this.aiMatcher.computeMatch(
      {
        skills: dto.skills,
        currentTitle: dto.currentTitle,
        totalExperienceYears: dto.totalExperienceYears,
        currentSalary: dto.currentSalary,
        expectedSalary: dto.expectedSalary,
        noticePeriodDays: dto.noticePeriodDays,
        city: dto.city,
        state: dto.state,
        summary: dto.summary,
      },
      posting,
    );

    // Auto-advance high-fit candidates from APPLIED to SCREENING if no explicit stage was passed
    if (!dto.stage && match.recommendation === "FAST_TRACK_SCREENING") {
      stage = CandidateStage.SCREENING;
    }

    const buildData = (position: number) => ({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone,
      city: dto.city,
      state: dto.state,
      isStarred: dto.isStarred,
      resumeUrl: dto.resumeUrl,
      source: dto.source,
      currentTitle: dto.currentTitle,
      totalExperienceYears: dto.totalExperienceYears,
      currentSalary: dto.currentSalary,
      expectedSalary: dto.expectedSalary,
      noticePeriodDays: dto.noticePeriodDays,
      skills: dto.skills,
      summary: dto.summary,
      educationDegree: dto.educationDegree,
      educationInstitution: dto.educationInstitution,
      educationYear: dto.educationYear,
      certifications: dto.certifications,
      workAuthorization: dto.workAuthorization,
      willingToRelocate: dto.willingToRelocate,
      stage,
      position,
      rejectionReason: dto.rejectionReason,
      // AI Matching & Screening fields
      aiMatchScore: match.aiMatchScore,
      skillMatchScore: match.skillMatchScore,
      expMatchScore: match.expMatchScore,
      locMatchScore: match.locMatchScore,
      salaryMatchScore: match.salaryMatchScore,
      noticeMatchScore: match.noticeMatchScore,
      cultureMatchScore: match.cultureMatchScore,
      fitBadge: match.fitBadge,
      aiSummary: match.aiSummary,
      jobPostingId: dto.jobPostingId,
      ownerId: dto.ownerId ?? creator.id,
      departmentId: dto.departmentId ?? creator.department?.id,
      closedAt: CLOSED_STAGES.includes(stage) ? new Date() : undefined,
    });

    // An explicit position (e.g. a drag-and-drop reorder passing its target
    // index) skips the auto-assignment race entirely -- there's nothing to
    // compute or serialize against.
    let createdCandidate: any;
    if (dto.position !== undefined) {
      createdCandidate = await this.prisma.candidate.create({ data: buildData(dto.position), include: candidateInclude });
    } else {
      createdCandidate = await this.createWithNextPosition(dto.jobPostingId, stage, (tx, position) =>
        tx.candidate.create({ data: buildData(position), include: candidateInclude }),
      );
    }

    if (this.notificationService && createdCandidate?.id) {
      this.notificationService
        .notifyTeamOnApplication({ candidateId: createdCandidate.id, jobPostingId: dto.jobPostingId })
        .catch((err) => this.logger.error(`Failed to dispatch application notification: ${err}`));
    }

    return createdCandidate;
  }

  // Backs the public careers/apply endpoint (CareersService) -- unlike
  // create(), there's no authenticated RequestUser to default ownerId/
  // departmentId from, so both are taken from the job posting itself
  // (Candidate.ownerId is required/non-null, so the requisition owner is the
  // most sensible default assignee for an inbound application). Only OPEN
  // postings can receive applications.
  async createPublicApplication(input: PublicApplicationInput) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.jobPostingId);
    let posting = isUuid
      ? await this.prisma.jobPosting.findUnique({ where: { id: input.jobPostingId } })
      : null;

    if (!posting) {
      const trimmed = input.jobPostingId.trim();
      const hexCandidate = trimmed.toUpperCase().startsWith("JPC-") ? trimmed.slice(4).toLowerCase() : trimmed.toLowerCase();
      posting = await this.prisma.jobPosting.findFirst({
        where: {
          status: JobPostingStatus.OPEN,
          OR: [
            { jobCode: { equals: trimmed, mode: "insensitive" } },
            { id: { startsWith: hexCandidate } },
          ],
        },
      });
    }

    if (!posting || posting.status !== JobPostingStatus.OPEN) {
      throw new NotFoundException("Job posting not found or no longer accepting applications");
    }

    const match = this.aiMatcher.computeMatch(
      {
        skills: [],
      },
      posting,
    );

    const stage = match.recommendation === "FAST_TRACK_SCREENING" ? CandidateStage.SCREENING : CandidateStage.APPLIED;

    const created = await this.createWithNextPosition(posting.id, stage, (tx, position) =>
      tx.candidate.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone,
          resumeUrl: input.resumeUrl,
          source: (input.source ?? "careers_site").toUpperCase(),
          gclid: input.gclid ?? null,
          utmSource: input.utmSource ?? null,
          utmCampaign: input.utmCampaign ?? null,
          stage,
          position,
          aiMatchScore: match.aiMatchScore,
          skillMatchScore: match.skillMatchScore,
          expMatchScore: match.expMatchScore,
          locMatchScore: match.locMatchScore,
          fitBadge: match.fitBadge,
          aiSummary: match.aiSummary,
          jobPostingId: posting.id,
          ownerId: posting.ownerId,
          departmentId: posting.departmentId,
        },
        include: candidateInclude,
      }),
    );

    // Auto-create Ceipal JobSubmission & Activity record so the applicant immediately
    // appears in the CRM Job's "Submissions" pipeline tab and "Applicants" panel for this job
    try {
      const sourceLabel = (input.source ?? "careers").toUpperCase() === "LINKEDIN" ? "LinkedIn Direct Applicant" : "Careers Site Applicant";
      await this.prisma.jobSubmission.create({
        data: {
          jobPostingId: posting.id,
          candidateId: created.id,
          name: `${input.firstName} ${input.lastName}`.trim(),
          submittedBy: sourceLabel,
          contact: input.email || input.phone || "N/A",
          location: posting.location || "Remote",
          status: "client_submissions",
          statusLabel: "New Applicant (Applied)",
          payRate: posting.budgetMin ? `$${posting.budgetMin}/hr` : "N/A",
          billRate: posting.clientBillRate || "N/A",
          createdById: posting.ownerId,
        },
      });

      await this.prisma.jobActivity.create({
        data: {
          jobPostingId: posting.id,
          user: "System",
          description: `Applicant ${input.firstName} ${input.lastName} applied for role via ${sourceLabel}`,
          type: "SUBMISSION",
          createdById: posting.ownerId,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to create Ceipal JobSubmission for public applicant: ${err}`);
    }

    if (this.notificationService && created?.id) {
      this.notificationService
        .notifyTeamOnApplication({ candidateId: created.id, jobPostingId: posting.id })
        .catch((err) => this.logger.error(`Failed to dispatch public application notification: ${err}`));
    }

    return created;
  }

  async update(id: string, dto: UpdateCandidateDto, user: RequestUser) {
    const candidate = await this.getOwned(id);
    this.assertCanMutate(candidate, user);

    // Re-parenting to a different job posting -- e.g. "submit this sourced
    // candidate to requisition X" -- so validate the target exists, same as
    // create().
    if (dto.jobPostingId) {
      await this.assertJobPostingExists(dto.jobPostingId);
    }

    return this.prisma.candidate.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        city: dto.city,
        state: dto.state,
        isStarred: dto.isStarred,
        resumeUrl: dto.resumeUrl,
        source: dto.source,
        currentTitle: dto.currentTitle,
        totalExperienceYears: dto.totalExperienceYears,
        currentSalary: dto.currentSalary,
        expectedSalary: dto.expectedSalary,
        noticePeriodDays: dto.noticePeriodDays,
        skills: dto.skills,
        summary: dto.summary,
        educationDegree: dto.educationDegree,
        educationInstitution: dto.educationInstitution,
        educationYear: dto.educationYear,
        certifications: dto.certifications,
        workAuthorization: dto.workAuthorization,
        willingToRelocate: dto.willingToRelocate,
        stage: dto.stage,
        position: dto.position,
        rejectionReason: dto.rejectionReason,
        ownerId: dto.ownerId,
        jobPostingId: dto.jobPostingId,
        closedAt: this.resolveClosedAt(dto.stage),
      },
      include: candidateInclude,
    });
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const candidate = await this.getOwned(id);
    this.assertCanMutate(candidate, user);
    await this.prisma.candidate.delete({ where: { id } });
  }

  // Safety net for the two-step upload-then-submit flow (both the internal
  // CandidatesController.uploadResume and the public CareersController one):
  // an abandoned form, or a bot/script hammering the upload endpoint without
  // ever following up, would otherwise leave storage/resumes/ growing
  // unbounded forever with files nothing ever references.
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOrphanedResumes(): Promise<{ deleted: number }> {
    const referenced = await this.prisma.candidate.findMany({
      where: { resumeUrl: { startsWith: RESUME_URL_PREFIX } },
      select: { resumeUrl: true },
    });
    const referencedFilenames = new Set(referenced.map((c) => c.resumeUrl!.slice(RESUME_URL_PREFIX.length)));

    const orphaned = await this.storage.listOrphaned(referencedFilenames, ORPHAN_RESUME_MAX_AGE_MS);
    for (const filename of orphaned) {
      await this.storage.delete(filename);
    }
    if (orphaned.length > 0) {
      this.logger.log(`Cleaned up ${orphaned.length} orphaned resume upload(s)`);
    }
    return { deleted: orphaned.length };
  }

  // undefined = stage not changing, don't touch closedAt. HIRED/REJECTED =
  // just closed, stamp now. Anything else = moved back to an open stage,
  // clear it (e.g. reopened from Rejected).
  private resolveClosedAt(newStage: CandidateStage | undefined): Date | null | undefined {
    if (newStage === undefined) {
      return undefined;
    }
    return CLOSED_STAGES.includes(newStage) ? new Date() : null;
  }

  // Two concurrent creates for the same jobPostingId+stage can otherwise both
  // read the same "last position" before either writes, landing on a
  // duplicate value (harmless to data integrity -- position has no unique
  // constraint -- but it corrupts the pipeline's displayed ordering). Wrapping
  // the read+create in a Serializable transaction makes Postgres detect that
  // read-write conflict itself and abort the loser with a retryable error
  // (Prisma surfaces it as P2034) instead of silently allowing the duplicate.
  private async createWithNextPosition<T>(
    jobPostingId: string,
    stage: CandidateStage,
    build: (tx: Prisma.TransactionClient, position: number) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= MAX_POSITION_ATTEMPTS; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx: Prisma.TransactionClient) => {
            const last = await tx.candidate.findFirst({
              where: { jobPostingId, stage },
              orderBy: { position: "desc" },
              select: { position: true },
            });
            return build(tx, (last?.position ?? -1) + 1);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (err) {
        const isConflict = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
        if (!isConflict) throw err;
        if (attempt === MAX_POSITION_ATTEMPTS) {
          // Only reachable under genuinely heavy simultaneous submission to
          // the same job posting -- a 409 (not a raw 500) so a caller (the
          // careers/apply form, an internal create) knows this is safe and
          // expected to retry, not a real server fault.
          throw new ConflictException("Too many simultaneous applications for this job -- please try again");
        }
      }
    }
    // Unreachable: the loop above always either returns or throws.
    throw new ConflictException("Too many simultaneous applications for this job -- please try again");
  }

  private async getOwned(id: string) {
    const candidate = await this.prisma.candidate.findUnique({ where: { id } });
    if (!candidate) {
      throw new NotFoundException("Candidate not found");
    }
    return candidate;
  }

  private async assertJobPostingExists(jobPostingId: string) {
    const posting = await this.prisma.jobPosting.findUnique({ where: { id: jobPostingId } });
    if (!posting) {
      throw new NotFoundException("Job posting not found");
    }
    return posting;
  }

  async autoScreenCandidate(id: string, user: RequestUser) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id },
      include: {
        jobPosting: true,
      },
    });
    if (!candidate) {
      throw new NotFoundException("Candidate not found");
    }
    this.assertCanMutate(candidate, user);

    const match = this.aiMatcher.computeMatch(
      {
        skills: candidate.skills,
        currentTitle: candidate.currentTitle,
        totalExperienceYears: candidate.totalExperienceYears,
        currentSalary: candidate.currentSalary,
        expectedSalary: candidate.expectedSalary,
        noticePeriodDays: candidate.noticePeriodDays,
        city: candidate.city,
        state: candidate.state,
        summary: candidate.summary,
      },
      candidate.jobPosting,
    );

    let nextStage = candidate.stage;
    let autoAdvanced = false;
    if (
      (candidate.stage === CandidateStage.APPLIED || candidate.stage === CandidateStage.SOURCED) &&
      match.recommendation === "FAST_TRACK_SCREENING"
    ) {
      nextStage = CandidateStage.SCREENING;
      autoAdvanced = true;
    }

    const updated = await this.prisma.candidate.update({
      where: { id },
      data: {
        aiMatchScore: match.aiMatchScore,
        skillMatchScore: match.skillMatchScore,
        expMatchScore: match.expMatchScore,
        locMatchScore: match.locMatchScore,
        salaryMatchScore: match.salaryMatchScore,
        noticeMatchScore: match.noticeMatchScore,
        cultureMatchScore: match.cultureMatchScore,
        fitBadge: match.fitBadge,
        aiSummary: match.aiSummary,
        stage: nextStage,
        stageEnteredAt: autoAdvanced ? new Date() : undefined,
      },
      include: candidateInclude,
    });

    return {
      candidate: updated,
      matchResult: match,
      autoAdvanced,
      message: autoAdvanced
        ? `Candidate scored ${match.aiMatchScore}% (${match.fitBadge}) and was automatically advanced to SCREENING.`
        : `Candidate scored ${match.aiMatchScore}% (${match.fitBadge}).`,
    };
  }

  private assertCanAccess(
    candidate: { departmentId: string | null; ownerId?: string | null },
    user: RequestUser,
  ) {
    if (user.role.name === RoleName.ADMIN) return;
    const isRecruitment = (user.department?.name || "").toLowerCase().includes("recruit");
    if (!isRecruitment) {
      throw new ForbiddenException("Access denied: You do not have access to Recruitment candidates");
    }
    if (user.role.name === RoleName.EMPLOYEE && candidate.ownerId && candidate.ownerId !== user.id) {
      throw new ForbiddenException("Access denied: You can only view candidates assigned to you");
    }
    if (user.role.name === RoleName.MANAGER && candidate.departmentId && candidate.departmentId !== user.department?.id) {
      throw new ForbiddenException("Access denied: This candidate belongs to another department");
    }
  }

  private assertCanMutate(
    candidate: { departmentId: string | null; ownerId?: string | null },
    user: RequestUser,
  ) {
    if (user.role.name === RoleName.ADMIN) return;
    const isRecruitment = (user.department?.name || "").toLowerCase().includes("recruit");
    if (!isRecruitment) {
      throw new ForbiddenException("Access denied: You do not belong to the Recruitment department");
    }
    if (user.role.name === RoleName.EMPLOYEE && candidate.ownerId && candidate.ownerId !== user.id) {
      throw new ForbiddenException("Access denied: You can only modify candidates assigned to you");
    }
    if (user.role.name === RoleName.MANAGER && candidate.departmentId && candidate.departmentId !== user.department?.id) {
      throw new ForbiddenException("Access denied: This candidate belongs to another department");
    }
  }
}
