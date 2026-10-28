import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { classifyBuyerSignal, isIntermediary } from "./erp-buyer-signal.util";

// Exact-phrase searches that describe a company choosing, replacing,
// outgrowing or implementing an ERP.
const SEARCH_PHRASES = [
  "ERP selection",
  "ERP evaluation",
  "new ERP",
  "ERP replacement",
  "ERP implementation",
  "ERP migration",
  "outgrown QuickBooks",
  "NetSuite implementation",
  "Dynamics 365 implementation",
];
const MARKETS: Array<{ adzuna: string; country: "US" | "CA" }> = [
  { adzuna: "us", country: "US" },
  { adzuna: "ca", country: "CA" },
];
const MAX_DAYS_OLD = 45;
const PAGES = 2;

export interface BuyerSignalRefreshResult {
  searched: number;
  postings: number;
  skippedIntermediaries: number;
  noSignal: number;
  created: number;
  updated: number;
  error?: string;
}

interface AdzunaJob {
  id: string | number;
  title?: string;
  redirect_url?: string;
  created?: string;
  description?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
}

@Injectable()
export class ErpBuyerSignalsService {
  private readonly logger = new Logger(ErpBuyerSignalsService.name);
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  isConfigured(): boolean {
    return Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);
  }

  // Daily at 08:00 UTC (13:30 IST). Adzuna's free tier is rate limited, so a
  // run is ~36 sequential calls with a pause between them.
  @Cron("0 0 8 * * *")
  async scheduledRefresh() {
    await this.refresh().catch((err) => this.logger.error(`Buyer-signal refresh failed: ${err?.message}`));
  }

  async refresh(): Promise<BuyerSignalRefreshResult> {
    const result: BuyerSignalRefreshResult = {
      searched: 0,
      postings: 0,
      skippedIntermediaries: 0,
      noSignal: 0,
      created: 0,
      updated: 0,
    };
    if (this.running) return { ...result, error: "A refresh is already running" };
    if (!this.isConfigured()) return { ...result, error: "ADZUNA_APP_ID / ADZUNA_APP_KEY are not set" };
    this.running = true;
    try {
      const seen = new Set<string>();
      for (const market of MARKETS) {
        for (const phrase of SEARCH_PHRASES) {
          for (let page = 1; page <= PAGES; page++) {
            const jobs = await this.search(market.adzuna, phrase, page);
            result.searched++;
            if (jobs === null) break; // HTTP error: skip to the next phrase
            for (const job of jobs) {
              const externalId = String(job.id);
              const key = `${market.country}:${externalId}`;
              if (seen.has(key)) continue;
              seen.add(key);
              result.postings++;
              await this.ingest(job, market.country, result);
            }
            if (jobs.length < 50) break; // no further pages
            await new Promise((r) => setTimeout(r, 400));
          }
          await new Promise((r) => setTimeout(r, 400));
        }
      }
      this.logger.log(
        `Buyer signals: ${result.postings} postings, ${result.skippedIntermediaries} agency/vendor skipped, ` +
          `${result.noSignal} no signal, +${result.created} new, ${result.updated} updated`,
      );
      return result;
    } catch (err: any) {
      result.error = err?.message ?? String(err);
      return result;
    } finally {
      this.running = false;
    }
  }

  private async search(market: string, phrase: string, page: number): Promise<AdzunaJob[] | null> {
    const params = new URLSearchParams({
      app_id: process.env.ADZUNA_APP_ID!,
      app_key: process.env.ADZUNA_APP_KEY!,
      what_phrase: phrase,
      results_per_page: "50",
      max_days_old: String(MAX_DAYS_OLD),
      "content-type": "application/json",
    });
    try {
      const res = await fetch(`https://api.adzuna.com/v1/api/jobs/${market}/search/${page}?${params}`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        // Never log the URL: it carries the API key.
        this.logger.warn(`Adzuna ${market} "${phrase}" p${page} returned HTTP ${res.status}`);
        return null;
      }
      const data = (await res.json()) as { results?: AdzunaJob[] };
      return data.results ?? [];
    } catch (err: any) {
      this.logger.warn(`Adzuna ${market} "${phrase}" p${page} failed: ${err?.message}`);
      return null;
    }
  }

  private async ingest(job: AdzunaJob, country: "US" | "CA", result: BuyerSignalRefreshResult) {
    const companyName = (job.company?.display_name ?? "").trim();
    const title = (job.title ?? "").trim();
    if (!companyName || !title) return;
    const description = (job.description ?? "").trim() || null;

    if (isIntermediary(companyName, description)) {
      result.skippedIntermediaries++;
      return;
    }
    const signal = classifyBuyerSignal(title, description);
    if (!signal) {
      result.noSignal++;
      return;
    }

    const data = {
      country,
      companyName: companyName.slice(0, 300),
      jobTitle: title.slice(0, 500),
      location: job.location?.display_name?.slice(0, 200) ?? null,
      description: description?.slice(0, 5000) ?? null,
      postedAt: job.created ? new Date(job.created) : null,
      url: job.redirect_url?.slice(0, 1500) ?? null,
      stage: signal.stage,
      matchedTerms: signal.matchedTerms,
    };
    const externalId = String(job.id);
    const existing = await this.prisma.erpBuyerSignal.findUnique({
      where: { source_externalId: { source: "ADZUNA_JOBS", externalId } },
      select: { id: true },
    });
    if (existing) {
      // status is the sales team's own triage; never overwrite it.
      await this.prisma.erpBuyerSignal.update({ where: { id: existing.id }, data });
      result.updated++;
    } else {
      await this.prisma.erpBuyerSignal.create({ data: { source: "ADZUNA_JOBS", externalId, ...data } });
      result.created++;
    }
  }

  async list(filters: {
    stage?: string;
    status?: string;
    country?: string;
    search?: string;
    take?: number;
    skip?: number;
  }) {
    const where: Prisma.ErpBuyerSignalWhereInput = {};
    if (filters.stage) where.stage = filters.stage;
    if (filters.status) where.status = filters.status;
    if (filters.country) where.country = filters.country;
    if (filters.search) {
      where.OR = [
        { companyName: { contains: filters.search, mode: "insensitive" } },
        { jobTitle: { contains: filters.search, mode: "insensitive" } },
      ];
    }
    const [total, signals] = await Promise.all([
      this.prisma.erpBuyerSignal.count({ where }),
      this.prisma.erpBuyerSignal.findMany({
        where,
        // Shopping now (SELECTING) first, then most recent.
        orderBy: [{ stage: "desc" }, { postedAt: { sort: "desc", nulls: "last" } }],
        take: filters.take ?? 50,
        skip: filters.skip ?? 0,
        omit: { description: true },
      }),
    ]);
    return { total, signals };
  }

  async get(id: string) {
    const signal = await this.prisma.erpBuyerSignal.findUnique({ where: { id } });
    if (!signal) throw new NotFoundException("Signal not found");
    return signal;
  }

  async updateStatus(id: string, status: string) {
    await this.get(id);
    return this.prisma.erpBuyerSignal.update({ where: { id }, data: { status } });
  }

  // One row per company, so a company with several postings counts once.
  async companies(take = 100) {
    const rows = await this.prisma.erpBuyerSignal.groupBy({
      by: ["companyName", "country"],
      _count: { _all: true },
      _max: { postedAt: true },
    });
    const selecting = await this.prisma.erpBuyerSignal.findMany({
      where: { stage: "SELECTING" },
      select: { companyName: true, country: true },
      distinct: ["companyName", "country"],
    });
    const selectingKeys = new Set(selecting.map((s) => `${s.companyName}|${s.country}`));
    return rows
      .map((r) => ({
        companyName: r.companyName,
        country: r.country,
        postings: r._count._all,
        latestPostedAt: r._max.postedAt,
        stage: selectingKeys.has(`${r.companyName}|${r.country}`) ? "SELECTING" : "IMPLEMENTING",
      }))
      .sort(
        (a, b) =>
          (a.stage === b.stage ? 0 : a.stage === "SELECTING" ? -1 : 1) ||
          (b.latestPostedAt?.getTime() ?? 0) - (a.latestPostedAt?.getTime() ?? 0),
      )
      .slice(0, take);
  }

  async stats() {
    const [total, selecting, implementing, newSelecting] = await Promise.all([
      this.prisma.erpBuyerSignal.count(),
      this.prisma.erpBuyerSignal.count({ where: { stage: "SELECTING" } }),
      this.prisma.erpBuyerSignal.count({ where: { stage: "IMPLEMENTING" } }),
      this.prisma.erpBuyerSignal.count({ where: { stage: "SELECTING", status: "NEW" } }),
    ]);
    return { total, selecting, implementing, newSelecting, configured: this.isConfigured() };
  }
}
