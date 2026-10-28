import { Injectable, Logger } from "@nestjs/common";
import { JobBoard } from "@prisma/client";
import { AggregatorConnectionService } from "../aggregator-connection.service";
import type { JobBoardPostInput, JobBoardPostResult } from "../job-board.types";

// Not wired into any adapter yet -- intentionally. AggregatorConnectionService
// already lets an Admin/Recruitment manager securely store a real vendor's
// baseUrl + API key (Settings screen), but the actual request/response shape
// below is a guess, not a verified contract with any real aggregator
// (Broadbean, Appcast, JobTarget, etc.). Every vendor has its own endpoint
// path, auth header, payload field names, and per-board identifiers, so
// faking a specific one here would just be code that looks like it works but
// silently posts malformed requests to a real vendor once someone connects
// one.
//
// Once a vendor is actually chosen, wiring this in is a 3-step, contained
// change -- nothing else in the syndication pipeline (JobBoardSyndicationService,
// the retry cron, JobBoardListing status tracking, the UI) has to change,
// same principle as every per-board adapter in this directory:
//   1. Replace the request body / headers / endpoint path below with that
//      vendor's real documented shape.
//   2. Fill in BOARD_CODES with that vendor's actual per-board identifiers
//      (aggregators use their own board codes, not our JobBoard enum values).
//   3. In each of the 8 simulated adapters (linkedin.adapter.ts,
//      naukri.adapter.ts, ...), swap the `simulatedPost(...)` call for
//      `aggregatorClient.postJob(this.board, job)` (inject AggregatorClient
//      the same way every adapter already injects its Logger), and set
//      `readonly simulated = false`.
//
// Boards without a self-serve API today (see simulated-post.util.ts) --
// aggregators typically cover the same set, so this maps 1:1.
const BOARD_CODES: Partial<Record<JobBoard, string>> = {
  // TODO: replace with the connected vendor's real per-board codes from
  // their API docs, e.g. LINKEDIN: "li", NAUKRI: "nk", ...
};

@Injectable()
export class AggregatorClient {
  private readonly logger = new Logger(AggregatorClient.name);

  constructor(private readonly connection: AggregatorConnectionService) {}

  async isConfigured(): Promise<boolean> {
    try {
      await this.connection.requireConnection();
      return true;
    } catch {
      return false;
    }
  }

  async postJob(board: JobBoard, job: JobBoardPostInput): Promise<JobBoardPostResult> {
    const { provider, baseUrl, apiKey } = await this.connection.requireConnection();
    const boardCode = BOARD_CODES[board];
    if (!boardCode) {
      throw new Error(
        `No board code configured for ${board} against aggregator "${provider}". ` +
          "Fill in BOARD_CODES in aggregator-client.service.ts with that vendor's real per-board identifiers.",
      );
    }

    // TODO: this endpoint path, auth scheme, and payload shape are all
    // placeholders -- replace with "${provider}"'s actual documented API
    // once chosen. Left deliberately unimplemented rather than guessed.
    throw new Error(
      `Job distribution aggregator "${provider}" is connected, but its posting API hasn't been implemented yet ` +
        `(see aggregator-client.service.ts). Cannot post "${job.title}" to ${board} (${boardCode}) via ${baseUrl}.`,
    );
  }
}
