import { Injectable } from "@nestjs/common";
import { JobBoard } from "@prisma/client";
import type { JobBoardAdapter, JobBoardPostInput, JobBoardPostResult } from "../job-board.types";

// Same APP_URL/CORS_ORIGIN fallback chain used elsewhere to build a link back
// into this app (see email-oauth.controller.ts, unsubscribe-token.ts).
const DEFAULT_APP_URL = "http://localhost:8080";

function feedUrl(): string {
  const appUrl = (process.env.APP_URL || process.env.CORS_ORIGIN || DEFAULT_APP_URL).replace(/\/$/, "");
  return `${appUrl}/api/job-board-feeds/indeed.xml`;
}

// Indeed has no self-serve "create a job" API to call per posting -- its free
// path is a recruiter registering ONE XML feed URL in their employer account,
// which Indeed's crawler re-pulls on its own schedule. So this "post" isn't
// an outbound call at all: as soon as a job is OPEN it's already in the feed
// (see JobBoardSyndicationService.buildIndeedFeedXml), so this adapter just
// confirms that and points at the feed as the verifiable, real artifact --
// unlike the other three adapters in this directory, nothing here is
// simulated.
@Injectable()
export class IndeedAdapter implements JobBoardAdapter {
  readonly board = JobBoard.INDEED;
  readonly simulated = false;

  async post(_job: JobBoardPostInput): Promise<JobBoardPostResult> {
    return { externalUrl: feedUrl() };
  }
}
