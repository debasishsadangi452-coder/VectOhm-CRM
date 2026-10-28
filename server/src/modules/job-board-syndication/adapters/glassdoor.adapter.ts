import { Injectable, Logger } from "@nestjs/common";
import { JobBoard } from "@prisma/client";
import type { JobBoardAdapter, JobBoardPostInput, JobBoardPostResult } from "../job-board.types";
import { simulatedPost } from "./simulated-post.util";

// Same situation as LinkedInAdapter: Glassdoor has no open self-serve job
// posting API (its old employer API was discontinued), so this simulates a
// successful post until a real partner integration exists, pointing at our
// own careers/apply page in the meantime. See linkedin.adapter.ts /
// simulated-post.util.ts for the full rationale.
@Injectable()
export class GlassdoorAdapter implements JobBoardAdapter {
  readonly board = JobBoard.GLASSDOOR;
  readonly simulated = true;
  private readonly logger = new Logger(GlassdoorAdapter.name);

  post(job: JobBoardPostInput): Promise<JobBoardPostResult> {
    return simulatedPost(this.logger, "Glassdoor", "glassdoor", job);
  }
}
