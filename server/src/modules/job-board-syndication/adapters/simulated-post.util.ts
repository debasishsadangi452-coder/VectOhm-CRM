import { Logger } from "@nestjs/common";
import type { JobBoardPostInput, JobBoardPostResult } from "../job-board.types";
import { careersApplyUrl } from "./careers-url.util";

// Every board without a self-serve posting API (LinkedIn, Naukri, Glassdoor,
// ZipRecruiter, Monster, Dice, SimplyHired, CareerBuilder) follows the exact
// same shape: log a warning, return our own careers page tagged with this
// board's source. Centralized here so a shared behavior change (message
// format, URL building) only needs to happen once instead of being
// hand-replicated across 8 near-identical adapter files. Each board still
// gets its own thin @Injectable() class (see linkedin.adapter.ts etc.) so
// the syndication module/service can keep injecting them by distinct type,
// same as every other adapter in this directory.
export async function simulatedPost(
  logger: Logger,
  displayName: string,
  source: string,
  job: JobBoardPostInput,
): Promise<JobBoardPostResult> {
  logger.warn(`Simulated ${displayName} post for "${job.title}" (${job.id}) -- no partner API configured`);
  return {
    externalId: `stub-${job.id}`,
    externalUrl: careersApplyUrl(job.id, source),
  };
}
