import type { JobBoard } from "@prisma/client";

// The subset of JobPosting fields an adapter needs to build a listing --
// structurally satisfied by the full Prisma JobPosting model, so callers can
// just pass the record straight through.
export interface JobBoardPostInput {
  id: string;
  jobCode: string | null;
  title: string;
  description: string | null;
  location: string | null;
  states?: string | null;
  employmentType: string;
  skillsRequired: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string;
  salaryPeriod?: string | null;
  client?: string | null;
  clientBillRate?: string | null;
  businessUnit?: string | null;
  minExperienceYears?: number | null;
  recruitmentManager?: string | null;
  assignedTo?: string | null;
  industry?: string | null;
}

export interface JobBoardPostResult {
  externalId?: string;
  externalUrl: string;
}

export interface JobBoardAdapter {
  readonly board: JobBoard;
  // True for adapters that don't call a real external API yet -- surfaced on
  // the JobBoardListing row so the UI can mark a post as simulated.
  readonly simulated: boolean;
  post(job: JobBoardPostInput): Promise<JobBoardPostResult>;
}
