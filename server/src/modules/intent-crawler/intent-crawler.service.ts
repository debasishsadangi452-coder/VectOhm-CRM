import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";
import { IntentNewsScraperService } from "../intent-news-scraper/intent-news-scraper.service";
import type { IngestScrapedArticleDto } from "../intent-news-scraper/dto/ingest-scraped-article.dto";
import { CRAWL_SOURCES } from "./intent-crawler.sources";
import { domainOf, guessCompany, hasErpIntent } from "./intent-crawler.util";

export interface CrawlSourceResult {
  id: string;
  label: string;
  fetched: number;
  matched: number;
  ingested: number;
  error?: string;
}

// A crawl older than this is stale; one is started at boot if the newest crawled article is older.
const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

function validDate(s?: string): string | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

@Injectable()
export class IntentCrawlerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(IntentCrawlerService.name);
  private running = false;
  private lastRun: { at: string; results: CrawlSourceResult[] } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly scraper: IntentNewsScraperService,
  ) {}

  // After a restart or a long outage, catch up instead of waiting for the next 6-hour tick.
  onApplicationBootstrap() {
    setTimeout(async () => {
      try {
        const newest = await this.prisma.scrapedIntentArticle.findFirst({
          where: { origin: "CRAWLER" },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        });
        if (!newest || Date.now() - newest.createdAt.getTime() > STALE_AFTER_MS) await this.run();
      } catch (err: any) {
        this.logger.warn(`Startup crawl check failed: ${err?.message}`);
      }
    }, 30_000);
  }

  listSources() {
    return {
      sources: CRAWL_SOURCES.map((s) => ({ id: s.id, label: s.label, kind: s.kind })),
      lastRun: this.lastRun,
      running: this.running,
    };
  }

  /** Everything the crawler has saved, newest first, plus counts for the panel header. */
  async listArticles(filters: { days?: number; source?: string; status?: string; search?: string; take: number; skip: number }) {
    const where: any = { origin: "CRAWLER" };
    if (filters.days) where.publishedAt = { gte: new Date(Date.now() - filters.days * 86_400_000) };
    if (filters.source) where.domain = filters.source;
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: "insensitive" } },
        { companyName: { contains: filters.search, mode: "insensitive" } },
        { keySnippet: { contains: filters.search, mode: "insensitive" } },
      ];
    }
    const day = new Date(Date.now() - 86_400_000);
    const [total, articles, newToday, totalAll, sources] = await Promise.all([
      this.prisma.scrapedIntentArticle.count({ where }),
      this.prisma.scrapedIntentArticle.findMany({
        where,
        take: filters.take,
        skip: filters.skip,
        orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
        select: {
          id: true, title: true, url: true, domain: true, publishedAt: true, keySnippet: true, tier: true,
          isErpAiPriority: true, intentScore: true, erpVendors: true, companyName: true, status: true, createdAt: true,
        },
      }),
      this.prisma.scrapedIntentArticle.count({ where: { origin: "CRAWLER", createdAt: { gte: day } } }),
      this.prisma.scrapedIntentArticle.count({ where: { origin: "CRAWLER" } }),
      this.prisma.scrapedIntentArticle.groupBy({
        by: ["domain"],
        where: { origin: "CRAWLER" },
        _count: { _all: true },
        orderBy: { _count: { domain: "desc" } },
        take: 40,
      }),
    ]);
    return {
      total,
      articles,
      stats: { all: totalAll, newToday },
      sources: sources.map((s) => ({ domain: s.domain, count: s._count._all })),
      crawl: { lastRun: this.lastRun, running: this.running },
    };
  }

  // Every 6 hours.
  @Cron("0 0 */6 * * *")
  async scheduledRun() {
    await this.run().catch((err) => this.logger.error(`Scheduled crawl failed: ${err?.message}`));
  }

  async run(onlyIds?: string[]) {
    if (this.running) return { skipped: true as const, reason: "A crawl is already running." };
    this.running = true;
    const results: CrawlSourceResult[] = [];
    try {
      for (const source of CRAWL_SOURCES.filter((s) => !onlyIds?.length || onlyIds.includes(s.id))) {
        const r: CrawlSourceResult = { id: source.id, label: source.label, fetched: 0, matched: 0, ingested: 0 };
        try {
          const items = await source.fetch();
          r.fetched = items.length;
          const seen = new Set<string>();
          for (const item of items) {
            if (seen.has(item.url) || !hasErpIntent(item)) continue;
            seen.add(item.url);
            r.matched++;
            try {
              await this.scraper.ingestScrapedArticle(
                {
                  articleTitle: item.title.slice(0, 500),
                  articleUrl: item.url.slice(0, 2000),
                  sourceDomain: domainOf(item.url, item.publisher),
                  publishedAt: validDate(item.publishedAt),
                  rawContent: item.snippet,
                  keySnippet: item.snippet?.slice(0, 1000),
                  companyName: guessCompany(item) ?? undefined,
                  // Crawler volume is high; spend Apollo credits and AI drafts only on leads someone opens.
                  autoFindDecisionMakers: false,
                  autoDraftEmail: false,
                } as IngestScrapedArticleDto,
                undefined,
                "CRAWLER",
              );
              r.ingested++;
            } catch (err: any) {
              this.logger.warn(`Ingest failed for ${item.url}: ${err?.message}`);
            }
          }
        } catch (err: any) {
          r.error = err?.message ?? "failed";
        }
        results.push(r);
      }
      this.lastRun = { at: new Date().toISOString(), results };
      return { skipped: false as const, ...this.lastRun };
    } finally {
      this.running = false;
    }
  }
}
