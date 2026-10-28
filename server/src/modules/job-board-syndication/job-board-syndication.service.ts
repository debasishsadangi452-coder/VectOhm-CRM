import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { JobBoard, JobBoardListingStatus, JobPostingStatus, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { LinkedInAdapter } from "./adapters/linkedin.adapter";
import { NaukriAdapter } from "./adapters/naukri.adapter";
import { GlassdoorAdapter } from "./adapters/glassdoor.adapter";
import { IndeedAdapter } from "./adapters/indeed.adapter";
import { ZipRecruiterAdapter } from "./adapters/zip-recruiter.adapter";
import { MonsterAdapter } from "./adapters/monster.adapter";
import { DiceAdapter } from "./adapters/dice.adapter";
import { SimplyHiredAdapter } from "./adapters/simply-hired.adapter";
import { CareerBuilderAdapter } from "./adapters/career-builder.adapter";
import { GoogleJobsAdapter } from "./adapters/google-jobs.adapter";
import type { JobBoardAdapter, JobBoardPostInput } from "./job-board.types";
import type { RequestUser } from "../../common/types/request-user.type";
import { careersApplyUrl } from "./adapters/careers-url.util";

// Which boards a new posting gets syndicated to, comma-separated so a board
// can be disabled without a code change -- same pattern as
// RECORDED_DEPARTMENTS in screen-recordings.service.ts.
const ENABLED_BOARDS = (
  process.env.JOB_BOARD_TARGETS ??
  "LINKEDIN,NAUKRI,INDEED,GLASSDOOR,ZIPRECRUITER,MONSTER,DICE,SIMPLYHIRED,CAREERBUILDER,GOOGLE_JOBS"
)
  .split(",")
  .map((b) => b.trim().toUpperCase())
  .filter((b): b is JobBoard => (Object.values(JobBoard) as string[]).includes(b));

// Same batching rationale as BulkEmailEngineService/SequenceEngineService --
// this is a safety net for anything that crashed mid-syndicate, not the
// primary path, so a modest cap per tick is plenty.
const BATCH_SIZE = 50;

@Injectable()
export class JobBoardSyndicationService {
  private readonly logger = new Logger(JobBoardSyndicationService.name);
  private readonly adapters: Map<JobBoard, JobBoardAdapter>;

  constructor(
    private readonly prisma: PrismaService,
    linkedin: LinkedInAdapter,
    naukri: NaukriAdapter,
    glassdoor: GlassdoorAdapter,
    indeed: IndeedAdapter,
    zipRecruiter: ZipRecruiterAdapter,
    monster: MonsterAdapter,
    dice: DiceAdapter,
    simplyHired: SimplyHiredAdapter,
    careerBuilder: CareerBuilderAdapter,
    googleJobs: GoogleJobsAdapter,
  ) {
    this.adapters = new Map<JobBoard, JobBoardAdapter>([
      [linkedin.board, linkedin],
      [naukri.board, naukri],
      [glassdoor.board, glassdoor],
      [indeed.board, indeed],
      [zipRecruiter.board, zipRecruiter],
      [monster.board, monster],
      [dice.board, dice],
      [simplyHired.board, simplyHired],
      [careerBuilder.board, careerBuilder],
      [googleJobs.board, googleJobs],
    ]);
  }

  // Called right after a job posting is created -- syndicates to every
  // enabled board synchronously so the recruiter sees results in the same
  // response instead of waiting on the retry cron below.
  async syndicate(job: JobBoardPostInput): Promise<void> {
    await Promise.all(
      ENABLED_BOARDS.map(async (board) => {
        const listing = await this.prisma.jobBoardListing.upsert({
          where: { jobPostingId_board: { jobPostingId: job.id, board } },
          update: { status: JobBoardListingStatus.PENDING, errorMessage: null },
          create: { jobPostingId: job.id, board, status: JobBoardListingStatus.PENDING },
        });
        await this.processListing(listing.id, job, board);
      }),
    );
  }

  // Manual (re)publish for a single board -- same permission rule as editing
  // the posting itself (JobPostingsService.assertCanMutate).
  async retry(jobPostingId: string, board: JobBoard, user: RequestUser) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobPostingId);
    let posting = isUuid
      ? await this.prisma.jobPosting.findUnique({ where: { id: jobPostingId } }).catch(() => null)
      : null;

    if (!posting) {
      const trimmed = jobPostingId.trim();
      const codeCandidate = (trimmed.split(" - ")[0] ?? trimmed).trim();
      const titleCandidate = trimmed.includes(" - ") ? trimmed.split(" - ").slice(1).join(" - ").trim() : trimmed;

      // 1. Exact jobCode match
      let matches = codeCandidate
        ? await this.prisma.jobPosting.findMany({
            where: { jobCode: { equals: codeCandidate, mode: "insensitive" as const } },
            take: 2,
          })
        : [];

      // 2. Ceipal-style code: JPC-56E183 -> id starts with 56e183
      if (matches.length === 0 && codeCandidate.toUpperCase().startsWith("JPC-")) {
        const hex = codeCandidate.slice(4).toLowerCase();
        if (hex.length >= 4) {
          matches = await this.prisma.jobPosting.findMany({
            where: { id: { startsWith: hex, mode: "insensitive" as const } },
            take: 2,
          });
        }
      }

      // 3. Hex prefix of ID
      if (matches.length === 0 && /^[0-9a-f]{4,32}$/i.test(codeCandidate)) {
        matches = await this.prisma.jobPosting.findMany({
          where: { id: { startsWith: codeCandidate.toLowerCase() } },
          take: 2,
        });
      }

      // 4. Exact title match
      if (matches.length === 0 && titleCandidate) {
        matches = await this.prisma.jobPosting.findMany({
          where: { title: { equals: titleCandidate, mode: "insensitive" as const } },
          take: 2,
        });
      }

      posting = matches.length >= 1 ? matches[0] : null;
    }

    if (!posting) {
      throw new NotFoundException("Job posting not found");
    }
    this.assertCanManage(posting, user);

    const listing = await this.prisma.jobBoardListing.upsert({
      where: { jobPostingId_board: { jobPostingId: posting.id, board } },
      update: { status: JobBoardListingStatus.PENDING, errorMessage: null },
      create: { jobPostingId: posting.id, board, status: JobBoardListingStatus.PENDING },
    });
    await this.processListing(listing.id, posting, board);
    const updated = await this.prisma.jobBoardListing.findUniqueOrThrow({ where: { id: listing.id } });
    if (updated.status === JobBoardListingStatus.FAILED) {
      throw new BadRequestException(updated.errorMessage || `Failed to publish job to ${board}`);
    }
    return updated;
  }

  // Safety net for anything left PENDING/FAILED by a crash mid-syndicate.
  @Cron(CronExpression.EVERY_5_MINUTES)
  async processPendingBatch(): Promise<{ processed: number }> {
    const pending = await this.prisma.jobBoardListing.findMany({
      where: { status: JobBoardListingStatus.PENDING },
      include: { jobPosting: true },
      orderBy: { createdAt: "asc" },
      take: BATCH_SIZE,
    });
    for (const listing of pending) {
      await this.processListing(listing.id, listing.jobPosting, listing.board);
    }
    return { processed: pending.length };
  }

  // The actual "listing" Indeed's crawler pulls -- see IndeedAdapter for why
  // there's no per-job outbound call for this board.
  async buildIndeedFeedXml(): Promise<string> {
    const openPostings = await this.prisma.jobPosting.findMany({
      where: { status: JobPostingStatus.OPEN },
      orderBy: { createdAt: "desc" },
    });
    const jobs = openPostings
      .map(
        (job) => `  <job>
    <title><![CDATA[${job.title}]]></title>
    <date><![CDATA[${job.createdAt.toUTCString()}]]></date>
    <referencenumber><![CDATA[${job.jobCode ?? job.id}]]></referencenumber>
    <url><![CDATA[${careersApplyUrl(job.id, "indeed")}]]></url>
    <company><![CDATA[Venus Global Tech]]></company>
    <city><![CDATA[${job.location ?? ""}]]></city>
    <country><![CDATA[US]]></country>
    <description><![CDATA[${job.description ?? ""}]]></description>
  </job>`,
      )
      .join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>\n<source>\n  <publisher><![CDATA[Venus Global Tech]]></publisher>\n${jobs}\n</source>\n`;
  }

  // The feed to submit to LinkedIn's "Job Wrapping" / Limited Listings
  // review (see linkedin.adapter.ts for why there's no per-job API call for
  // this board -- LinkedIn only crawls a feed like this one for a free,
  // organic listing; the real-time posting API is a separate, paid partner
  // program). Field names below follow the general job-feed XML shape
  // shared by most crawler-based boards (the same one Indeed uses) --
  // double-check them against LinkedIn's currently published feed spec
  // before actually submitting this URL for review, since board feed specs
  // do change.
  async buildLinkedInFeedXml(): Promise<string> {
    const openPostings = await this.prisma.jobPosting.findMany({
      where: { status: JobPostingStatus.OPEN },
      orderBy: { createdAt: "desc" },
    });
    const jobTypeLabel: Record<string, string> = {
      FULL_TIME: "Full-time",
      PART_TIME: "Part-time",
      CONTRACT: "Contract",
      INTERNSHIP: "Internship",
    };
    const jobs = openPostings
      .map((job) => {
        const salary =
          job.budgetMin != null && job.budgetMax != null
            ? `<salary><![CDATA[${job.budgetMin}-${job.budgetMax} ${job.currency}]]></salary>\n    `
            : "";
        return `  <job>
    <title><![CDATA[${job.title}]]></title>
    <date><![CDATA[${job.createdAt.toUTCString()}]]></date>
    <referencenumber><![CDATA[${job.jobCode ?? job.id}]]></referencenumber>
    <url><![CDATA[${careersApplyUrl(job.id, "linkedin")}]]></url>
    <company><![CDATA[Venus Global Tech]]></company>
    <city><![CDATA[${job.location ?? ""}]]></city>
    <country><![CDATA[US]]></country>
    <jobtype><![CDATA[${jobTypeLabel[job.employmentType] ?? job.employmentType}]]></jobtype>
    ${salary}<description><![CDATA[${job.description ?? ""}]]></description>
  </job>`;
      })
      .join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>\n<source>\n  <publisher><![CDATA[Venus Global Tech]]></publisher>\n${jobs}\n</source>\n`;
  }

  private async processListing(listingId: string, job: JobBoardPostInput, board: JobBoard) {
    const adapter = this.adapters.get(board);
    if (!adapter) return;
    try {
      const result = await adapter.post(job);
      await this.prisma.jobBoardListing.update({
        where: { id: listingId },
        data: {
          status: JobBoardListingStatus.POSTED,
          simulated: adapter.simulated,
          externalId: result.externalId,
          externalUrl: result.externalUrl,
          errorMessage: null,
          postedAt: new Date(),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      this.logger.error(`Failed to post job ${job.id} to ${board}: ${message}`);
      await this.prisma.jobBoardListing.update({
        where: { id: listingId },
        data: { status: JobBoardListingStatus.FAILED, errorMessage: message },
      });
    }
  }

  // Mirrors JobPostingsService.assertCanMutate -- who can (re)publish a
  // posting's board listings is the same as who can edit the posting itself.
  private assertCanManage(posting: { ownerId: string; departmentId: string | null }, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const isOwner = posting.ownerId === user.id;
    const isDeptManager =
      user.role.name === RoleName.MANAGER &&
      (posting.departmentId === null || posting.departmentId === user.department?.id);
    if (!isAdmin && !isOwner && !isDeptManager) {
      throw new ForbiddenException("You do not have permission to manage this job posting's board listings");
    }
  }
}
