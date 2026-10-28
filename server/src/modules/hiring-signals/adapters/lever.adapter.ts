import { Injectable, Logger } from "@nestjs/common";
import type { DiscoveredJobPosting } from "./board-adapter.types";

// Lever's public Postings API -- every posting in the "published" state is
// publicly viewable by design, meant for third-party careers-page/job-board
// consumption. See https://github.com/lever/postings-api
@Injectable()
export class LeverAdapter {
  private readonly logger = new Logger(LeverAdapter.name);

  // `site` is the company's Lever site name, e.g. the "netflix" in
  // jobs.lever.co/netflix.
  async listOpenJobs(site: string): Promise<DiscoveredJobPosting[]> {
    try {
      const res = await fetch(`https://api.lever.co/v0/postings/${encodeURIComponent(site)}?mode=json`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as Array<{ id: string; text: string; hostedUrl: string }>;
      if (!Array.isArray(data)) return [];
      return data.map((p) => ({
        externalJobId: p.id,
        title: p.text,
        url: p.hostedUrl,
      }));
    } catch (err) {
      this.logger.debug(`Lever lookup failed for site "${encodeURIComponent(site)}": ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }
}
