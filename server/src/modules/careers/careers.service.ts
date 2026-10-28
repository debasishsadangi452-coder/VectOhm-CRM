import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { JobPostingStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CandidatesService } from "../candidates/candidates.service";
import type { SubmitApplicationDto } from "./dto/submit-application.dto";

// Deliberately NOT the same projection as JobPostingsService's
// jobPostingInclude -- that one carries internal Ceipal fields (client,
// clientBillRate, owner info, boardListings) that must never reach an
// anonymous visitor. This is the public-safe subset only.
const publicJobSelect = {
  id: true,
  jobCode: true,
  title: true,
  description: true,
  location: true,
  employmentType: true,
  skillsRequired: true,
  minExperienceYears: true,
  budgetMin: true,
  budgetMax: true,
  currency: true,
  salaryPeriod: true,
  createdAt: true,
  hiringDepartment: { select: { name: true } },
} as const;

@Injectable()
export class CareersService {
  private readonly logger = new Logger(CareersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly candidatesService: CandidatesService,
  ) {}

  listOpenJobs() {
    return this.prisma.jobPosting.findMany({
      where: { status: JobPostingStatus.OPEN },
      select: publicJobSelect,
      orderBy: { createdAt: "desc" },
    });
  }

  async getOpenJob(id: string) {
    // findFirst, not findUnique -- status isn't part of a unique key, and
    // this must reject a closed/filled/on-hold posting the same way
    // listOpenJobs() already excludes it, so a stale board listing can't
    // keep showing full details (and a working-looking apply form) for a
    // posting that's no longer accepting applications.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let posting = isUuid
      ? await this.prisma.jobPosting.findFirst({
          where: { id, status: JobPostingStatus.OPEN },
          select: publicJobSelect,
        })
      : null;

    if (!posting) {
      const trimmed = id.trim();
      const hexCandidate = trimmed.toUpperCase().startsWith("JPC-") ? trimmed.slice(4).toLowerCase() : trimmed.toLowerCase();
      posting = await this.prisma.jobPosting.findFirst({
        where: {
          status: JobPostingStatus.OPEN,
          OR: [
            { jobCode: { equals: trimmed, mode: "insensitive" } },
            { id: { startsWith: hexCandidate } },
          ],
        },
        select: publicJobSelect,
      });
    }

    if (!posting) {
      throw new NotFoundException("Job posting not found or no longer accepting applications");
    }
    return posting;
  }

  async submitApplication(dto: SubmitApplicationDto) {
    // Honeypot tripped -- look like success to whatever filled it in, but
    // never touch the database. See submit-application.dto.ts. Still logged
    // (not silently a total black hole) so a real applicant who somehow
    // trips it and never hears back leaves a trace support/recruiting can
    // find, distinct from an actual bot flood.
    if (dto.honeypot) {
      this.logger.warn(`Honeypot tripped on application for job ${dto.jobPostingId} (email: ${dto.email})`);
      return { id: "ok" };
    }

    const candidate = await this.candidatesService.createPublicApplication({
      jobPostingId: dto.jobPostingId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone,
      resumeUrl: dto.resumeUrl,
      source: dto.source,
      gclid: dto.gclid,
      utmSource: dto.utmSource,
      utmCampaign: dto.utmCampaign,
    });
    return { id: candidate.id };
  }
}
