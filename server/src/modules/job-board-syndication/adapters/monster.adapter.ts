import { Injectable, Logger } from "@nestjs/common";
import { JobBoard } from "@prisma/client";
import type { JobBoardAdapter, JobBoardPostInput, JobBoardPostResult } from "../job-board.types";
import { simulatedPost } from "./simulated-post.util";

// Same situation as LinkedInAdapter: Monster's posting API is only available
// through its enterprise/aggregator partner program, which we don't have, so
// this simulates a successful post until one exists, pointing at our own
// careers/apply page in the meantime. See linkedin.adapter.ts /
// simulated-post.util.ts for the full rationale.
@Injectable()
export class MonsterAdapter implements JobBoardAdapter {
  readonly board = JobBoard.MONSTER;
  readonly simulated = true;
  private readonly logger = new Logger(MonsterAdapter.name);

  post(job: JobBoardPostInput): Promise<JobBoardPostResult> {
    return simulatedPost(this.logger, "Monster", "monster", job);
  }
}
