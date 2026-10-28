import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { JobBoard, JobPostingStatus, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateJobPostingDto } from "./dto/create-job-posting.dto";
import { UpdateJobPostingDto } from "./dto/update-job-posting.dto";
import { JobBoardSyndicationService } from "../job-board-syndication/job-board-syndication.service";
import type { RequestUser } from "../../common/types/request-user.type";

const jobPostingInclude = {
  owner: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  hiringDepartment: { select: { id: true, name: true } },
  boardListings: true,
  _count: { select: { candidates: true } },
} as const;

interface JobPostingFilters {
  status?: JobPostingStatus;
  hiringDepartmentId?: string;
  departmentId?: string;
}

@Injectable()
export class JobPostingsService {
  private readonly logger = new Logger(JobPostingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly syndication: JobBoardSyndicationService,
  ) {}

  findAll(filters: JobPostingFilters, user: RequestUser) {
    return this.prisma.jobPosting.findMany({
      where: {
        status: filters.status,
        hiringDepartmentId: filters.hiringDepartmentId,
        ...this.visibilityScope(user, filters.departmentId),
      },
      include: jobPostingInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  // Same rationale as TasksService.visibilityScope -- non-Admins only see
  // their own department's postings (plus legacy/unscoped rows), which in
  // practice means Recruitment + Admin, matching the frontend department
  // guard. A caller-supplied departmentId narrows further for Admin only.
  private visibilityScope(user: RequestUser, requestedDepartmentId?: string) {
    if (user.role.name === RoleName.ADMIN) {
      return requestedDepartmentId ? { departmentId: requestedDepartmentId } : {};
    }
    return { OR: [{ departmentId: null }, { departmentId: user.department?.id }] };
  }

  async findOne(id: string) {
    const posting = await this.prisma.jobPosting.findUnique({ where: { id }, include: jobPostingInclude });
    if (!posting) {
      throw new NotFoundException("Job posting not found");
    }
    return posting;
  }

  async create(dto: CreateJobPostingDto, creator: RequestUser) {
    const posting = await this.prisma.jobPosting.create({
      data: {
        title: dto.title,
        description: dto.description,
        location: dto.location,
        employmentType: dto.employmentType,
        status: dto.status,
        targetHeadcount: dto.targetHeadcount,
        budgetMin: dto.budgetMin,
        budgetMax: dto.budgetMax,
        currency: dto.currency ?? "USD",
        salaryPeriod: dto.salaryPeriod ?? "YEARLY",
        skillsRequired: dto.skillsRequired,
        minExperienceYears: dto.minExperienceYears,
        hiringDepartmentId: dto.hiringDepartmentId,
        ownerId: dto.ownerId ?? creator.id,
        departmentId: dto.departmentId ?? creator.department?.id,
        client: dto.client,
        clientJobId: dto.clientJobId,
        businessUnit: dto.businessUnit,
        states: dto.states,
        clientBillRate: dto.clientBillRate,
        sources: dto.sources,
        industry: dto.industry,
        clearance: dto.clearance,
        tags: dto.tags,
        boardStatus: dto.boardStatus,
        recruitmentManager: dto.recruitmentManager,
        assignedTo: dto.assignedTo,
      },
    });

    // Publish to job boards immediately -- see job-board-syndication module.
    // Only OPEN postings go out; a draft/on-hold requisition shouldn't be
    // syndicated anywhere until it's actually ready to hire against.
    if (posting.status === JobPostingStatus.OPEN) {
      await this.syndication.syndicate(posting);
    }

    return this.prisma.jobPosting.findUniqueOrThrow({ where: { id: posting.id }, include: jobPostingInclude });
  }

  async update(id: string, dto: UpdateJobPostingDto, user: RequestUser) {
    const posting = await this.getOwned(id);
    this.assertCanMutate(posting, user);

    const updated = await this.prisma.jobPosting.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        location: dto.location,
        employmentType: dto.employmentType,
        status: dto.status,
        targetHeadcount: dto.targetHeadcount,
        budgetMin: dto.budgetMin,
        budgetMax: dto.budgetMax,
        currency: dto.currency,
        salaryPeriod: dto.salaryPeriod,
        skillsRequired: dto.skillsRequired,
        minExperienceYears: dto.minExperienceYears,
        hiringDepartmentId: dto.hiringDepartmentId,
        ownerId: dto.ownerId,
        client: dto.client,
        clientJobId: dto.clientJobId,
        businessUnit: dto.businessUnit,
        states: dto.states,
        clientBillRate: dto.clientBillRate,
        sources: dto.sources,
        industry: dto.industry,
        clearance: dto.clearance,
        tags: dto.tags,
        boardStatus: dto.boardStatus,
        recruitmentManager: dto.recruitmentManager,
        assignedTo: dto.assignedTo,
      },
      include: jobPostingInclude,
    });

    // A draft/on-hold requisition just switched to OPEN -- syndicate now
    // rather than requiring a separate "publish" action.
    if (posting.status !== JobPostingStatus.OPEN && updated.status === JobPostingStatus.OPEN) {
      await this.syndication.syndicate(updated);
      return this.prisma.jobPosting.findUniqueOrThrow({ where: { id }, include: jobPostingInclude });
    }

    // If an already-OPEN posting had LinkedIn syndication toggled on, post immediately
    if (
      updated.status === JobPostingStatus.OPEN &&
      dto.boardStatus &&
      typeof dto.boardStatus === "object"
    ) {
      const prevBoard = (posting.boardStatus as Record<string, boolean> | null) || {};
      const newBoard = (dto.boardStatus as Record<string, boolean> | null) || {};
      if (newBoard.linkedin && !prevBoard.linkedin) {
        await this.syndication.retry(id, JobBoard.LINKEDIN, user).catch((err) => {
          this.logger.warn(`Syndicating to LinkedIn on board toggle failed: ${err.message}`);
        });
        return this.prisma.jobPosting.findUniqueOrThrow({ where: { id }, include: jobPostingInclude });
      }
    }

    return updated;
  }

  async close(id: string, user: RequestUser) {
    const posting = await this.getOwned(id);
    this.assertCanMutate(posting, user);

    return this.prisma.jobPosting.update({
      where: { id: posting.id },
      data: { status: JobPostingStatus.CLOSED },
      include: jobPostingInclude,
    });
  }

  async delete(id: string, user: RequestUser) {
    if (user.role.name !== RoleName.ADMIN) {
      throw new ForbiddenException("Only administrators can permanently delete job postings");
    }

    let posting = await this.prisma.jobPosting.findUnique({ where: { id } });
    if (!posting) {
      const trimmed = id.trim();
      const hexCandidate = trimmed.toUpperCase().startsWith("JPC-")
        ? trimmed.slice(4).toLowerCase()
        : trimmed.toLowerCase();
      posting = await this.prisma.jobPosting.findFirst({
        where: {
          OR: [
            { jobCode: { equals: trimmed, mode: "insensitive" } },
            { id: { startsWith: hexCandidate } },
          ],
        },
      });
    }

    if (!posting) {
      throw new NotFoundException("Job posting not found");
    }

    // Permanent delete -- cascades to all tasks, activities, email merges, submissions, notes, documents, board listings, candidates
    await this.prisma.jobPosting.delete({
      where: { id: posting.id },
    });

    this.logger.log(
      `Job Posting "${posting.title}" (${posting.id}) was permanently deleted by Admin ${user.email}`,
    );

    return { success: true, deletedId: posting.id };
  }

  private async getOwned(id: string) {
    const posting = await this.prisma.jobPosting.findUnique({ where: { id } });
    if (!posting) {
      throw new NotFoundException("Job posting not found");
    }
    return posting;
  }

  // Same pattern as DealsService/ProjectsService.assertCanMutate: ADMIN
  // unconditional, owner always, same-department MANAGER, null departmentId
  // treated as unscoped/manageable by any Manager.
  private assertCanMutate(posting: { ownerId: string; departmentId: string | null }, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const isOwner = posting.ownerId === user.id;
    const isDeptManager =
      user.role.name === RoleName.MANAGER &&
      (posting.departmentId === null || posting.departmentId === user.department?.id);
    if (!isAdmin && !isOwner && !isDeptManager) {
      throw new ForbiddenException("You do not have permission to modify this job posting");
    }
  }
}
