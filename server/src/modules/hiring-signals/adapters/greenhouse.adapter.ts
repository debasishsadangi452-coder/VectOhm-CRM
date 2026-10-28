import { Injectable, Logger } from "@nestjs/common";
import type { DiscoveredJobPosting } from "./board-adapter.types";

// Greenhouse's public, unauthenticated Job Board API -- intentionally
// exposed by Greenhouse for exactly this kind of consumption (companies use
// it to power their own careers page widgets). Not scraping: this is a
// documented, sanctioned endpoint. See
// https://developers.greenhouse.io/job-board.html
@Injectable()
export class GreenhouseAdapter {
  private readonly logger = new Logger(GreenhouseAdapter.name);

  // `slug` is the company's Greenhouse board name, e.g. the "stripe" in
  // boards.greenhouse.io/stripe -- see slug-guesser.util.ts for how a slug
  // gets derived from a company name/domain when it isn't already known.
  async listOpenJobs(slug: string): Promise<DiscoveredJobPosting[]> {
    try {
      const res = await fetch(`https://boards.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { jobs?: Array<{ id: number; title: string; absolute_url: string }> };
      return (data.jobs ?? []).map((j) => ({
        externalJobId: String(j.id),
        title: j.title,
        url: j.absolute_url,
      }));
    } catch (err) {
      this.logger.debug(`Greenhouse lookup failed for slug "${encodeURIComponent(slug)}": ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }
}
