import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InterviewStatus, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateInterviewDto } from "./dto/create-interview.dto";
import { UpdateInterviewDto } from "./dto/update-interview.dto";
import type { RequestUser } from "../../common/types/request-user.type";

const interviewInclude = {
  interviewer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  candidate: { select: { id: true, firstName: true, lastName: true, jobPostingId: true } },
} as const;

interface InterviewFilters {
  candidateId?: string;
  interviewerId?: string;
  status?: InterviewStatus;
  upcoming?: boolean;
}

@Injectable()
export class InterviewsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(filters: InterviewFilters, user: RequestUser) {
    return this.prisma.interview.findMany({
      where: {
        candidateId: filters.candidateId,
        interviewerId: filters.interviewerId,
        status: filters.status,
        scheduledAt: filters.upcoming ? { gte: new Date() } : undefined,
        ...this.visibilityScope(user),
      },
      include: interviewInclude,
      orderBy: { scheduledAt: "asc" },
    });
  }

  private visibilityScope(user: RequestUser) {
    if (user.role.name === RoleName.ADMIN) {
      return {};
    }
    const isRecruitment = (user.department?.name || "").toLowerCase().includes("recruit");
    if (isRecruitment && user.role.name === RoleName.MANAGER) {
      return { departmentId: user.department?.id };
    }
    if (isRecruitment) {
      return {
        departmentId: user.department?.id,
        OR: [
          { interviewerId: user.id },
          { createdById: user.id },
          { candidate: { ownerId: user.id } },
        ],
      };
    }
    // Non-recruitment users can only ever see interviews they are personally conducting
    return { interviewerId: user.id };
  }

  async findOne(id: string, user: RequestUser) {
    const interview = await this.prisma.interview.findUnique({ where: { id }, include: interviewInclude });
    if (!interview) {
      throw new NotFoundException("Interview not found");
    }
    this.assertCanAccess(interview, user);
    return interview;
  }

  async create(dto: CreateInterviewDto, creator: RequestUser) {
    const candidate = await this.prisma.candidate.findUnique({ where: { id: dto.candidateId } });
    if (!candidate) {
      throw new NotFoundException("Candidate not found");
    }

    return this.prisma.interview.create({
      data: {
        candidateId: dto.candidateId,
        interviewerId: dto.interviewerId,
        createdById: creator.id,
        type: dto.type,
        scheduledAt: new Date(dto.scheduledAt),
        durationMinutes: dto.durationMinutes,
        location: dto.location,
        departmentId: candidate.departmentId,
      },
      include: interviewInclude,
    });
  }

  async update(id: string, dto: UpdateInterviewDto, user: RequestUser) {
    const interview = await this.getOwned(id);
    this.assertCanMutate(interview, user);

    return this.prisma.interview.update({
      where: { id },
      data: {
        interviewerId: dto.interviewerId,
        type: dto.type,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        durationMinutes: dto.durationMinutes,
        location: dto.location,
        status: dto.status,
        feedback: dto.feedback,
        rating: dto.rating,
      },
      include: interviewInclude,
    });
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const interview = await this.getOwned(id);
    this.assertCanMutate(interview, user);
    await this.prisma.interview.delete({ where: { id } });
  }

  private async getOwned(id: string) {
    const interview = await this.prisma.interview.findUnique({ where: { id } });
    if (!interview) {
      throw new NotFoundException("Interview not found");
    }
    return interview;
  }

  private assertCanAccess(
    interview: { departmentId: string | null; interviewerId: string | null },
    user: RequestUser,
  ) {
    if (user.role.name === RoleName.ADMIN) return;
    const isInterviewer = interview.interviewerId === user.id;
    const isRecruitment = (user.department?.name || "").toLowerCase().includes("recruit");
    const isSameDepartment = isRecruitment && interview.departmentId === user.department?.id;
    if (!isInterviewer && !isSameDepartment) {
      throw new ForbiddenException("You do not have access to this interview");
    }
  }

  private assertCanMutate(
    interview: { departmentId: string | null; interviewerId: string | null; createdById: string },
    user: RequestUser,
  ) {
    if (user.role.name === RoleName.ADMIN) return;
    const isInterviewer = interview.interviewerId === user.id;
    const isCreator = interview.createdById === user.id;
    const isRecruitment = (user.department?.name || "").toLowerCase().includes("recruit");
    const isDeptManager =
      user.role.name === RoleName.MANAGER &&
      isRecruitment &&
      interview.departmentId === user.department?.id;
    if (!isInterviewer && !isCreator && !isDeptManager) {
      throw new ForbiddenException("You do not have permission to modify this interview");
    }
  }
}
