import { Injectable } from "@nestjs/common";
import { JobBoard } from "@prisma/client";
import type { JobBoardAdapter, JobBoardPostInput, JobBoardPostResult } from "../job-board.types";
import { careersApplyUrl } from "./careers-url.util";

// Google for Jobs isn't a credentialed API at all -- there's nothing to
// partner for. Google's crawler indexes `JobPosting` schema.org structured
// data (JSON-LD) that the public careers page already emits per job (see the
// frontend's careers.$jobId route), the same way it indexes any other page.
// So, like IndeedAdapter, this "post" isn't an outbound call: as soon as a
// job is OPEN, the structured data is already live at the careers URL below,
// which is what this adapter just confirms and points at -- nothing here is
// simulated.
@Injectable()
export class GoogleJobsAdapter implements JobBoardAdapter {
  readonly board = JobBoard.GOOGLE_JOBS;
  readonly simulated = false;

  async post(job: JobBoardPostInput): Promise<JobBoardPostResult> {
    return { externalUrl: careersApplyUrl(job.id, "google_jobs") };
  }
}
