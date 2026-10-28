import { Injectable, Logger } from "@nestjs/common";
import type { DiscoveredJobPosting } from "./board-adapter.types";

// Ashby's public Job Postings API -- documented, unauthenticated, meant for
// third-party consumption. See
// https://developers.ashbyhq.com/docs/public-job-posting-api
// Ashby doesn't return a numeric/opaque job id in this response -- their own
// docs say to use `jobUrl` as the unique identifier, so that's what backs
// externalJobId here.
@Injectable()
export class AshbyAdapter {
  private readonly logger = new Logger(AshbyAdapter.name);

  // `jobBoardName` is the company's Ashby job board name, e.g. the
  // "snowflake" in jobs.ashbyhq.com/snowflake.
  async listOpenJobs(jobBoardName: string): Promise<DiscoveredJobPosting[]> {
    try {
      const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(jobBoardName)}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { jobs?: Array<{ title: string; jobUrl: string; isListed?: boolean }> };
      return (data.jobs ?? [])
        .filter((j) => j.isListed !== false)
        .map((j) => ({
          externalJobId: j.jobUrl,
          title: j.title,
          url: j.jobUrl,
        }));
    } catch (err) {
      this.logger.debug(`Ashby lookup failed for board "${encodeURIComponent(jobBoardName)}": ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }
}
