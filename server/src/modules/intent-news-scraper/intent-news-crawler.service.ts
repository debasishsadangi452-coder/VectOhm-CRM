import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";
import { analyzeIntentItems, isIntentAiConfigured } from "./intent-news-ai";
import { INTENT_SEARCH_QUERIES, googleNewsRssUrl, parseRssItems, type RssItem } from "./intent-news-sources";
import { IntentNewsScraperService } from "./intent-news-scraper.service";

const ITEMS_PER_FEED = 15;
const MAX_ANALYSED_PER_RUN = 200;
const AI_BATCH = 25;
const MIN_SCORE_TO_SAVE = 60;
const MIN_SCORE_FOR_APOLLO = 85;
const APOLLO_DAILY_CAP = 20;
const COMPANIES_PER_RUN = 10;

// Finds intent news on its own: Google News searches (keywords, press wires,
// trade sites, and the CRM's own target companies), Gemini picks out the real
// buying signals, and each one goes through the normal ingest pipeline.
@Injectable()
export class IntentNewsCrawlerService {
  private readonly logger = new Logger(IntentNewsCrawlerService.name);
  private running = false;
  // shortcut: in-memory, so a restart re-analyses up to 2 days of headlines and resets the Apollo cap; persist if restarts get frequent.
  private readonly seen = new Set<string>();
  private apolloDay = "";
  private apolloUsed = 0;
  private companyOffset = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly scraper: IntentNewsScraperService,
  ) {}

  @Cron("0 */3 * * *")
  async scheduled() {
    if (process.env.DISABLE_INTENT_CRAWLER === "true") return;
    await this.run().catch((err) => this.logger.error(`Intent crawl failed: ${err?.message}`));
  }

  async run(): Promise<{ started: boolean; fetched?: number; analysed?: number; saved?: number; reason?: string }> {
    if (!isIntentAiConfigured()) return { started: false, reason: "GEMINI_API_KEY is not set" };
    if (this.running) return { started: false, reason: "A crawl is already running" };
    this.running = true;
    try {
      const items = await this.collect();
      const known = new Set(
        (await this.prisma.scrapedIntentArticle.findMany({ where: { url: { in: items.map((i) => i.link) } }, select: { url: true } })).map((a) => a.url),
      );
      const fresh = items.filter((i) => !known.has(i.link) && !this.seen.has(i.link)).slice(0, MAX_ANALYSED_PER_RUN);

      let saved = 0;
      for (let b = 0; b < fresh.length; b += AI_BATCH) {
        const batch = fresh.slice(b, b + AI_BATCH);
        let results;
        try {
          results = await analyzeIntentItems(batch.map((i) => ({ title: i.title, source: i.sourceName ?? i.sourceDomain ?? undefined })));
        } catch (err: any) {
          this.logger.warn(`Gemini batch failed: ${err?.message}`);
          continue;
        }
        for (let k = 0; k < batch.length; k++) {
          const item = batch[k];
          const ai = results[k];
          if (!ai) continue; // not marked seen, so it is retried next run
          this.seen.add(item.link);
          if (!ai.relevant || ai.intentScore < MIN_SCORE_TO_SAVE || !ai.companyName) continue;
          try {
            await this.scraper.ingestScrapedArticle(
              {
                articleTitle: item.title.slice(0, 500),
                articleUrl: item.link,
                sourceDomain: item.sourceDomain || "news.google.com",
                publishedAt: item.publishedAt ?? undefined,
                autoFindDecisionMakers: ai.intentScore >= MIN_SCORE_FOR_APOLLO && this.takeApolloCredit(),
              },
              undefined,
              "CRAWLER",
              ai,
            );
            saved++;
          } catch (err: any) {
            this.logger.warn(`Could not save "${item.title}": ${err?.message}`);
          }
        }
      }
      if (this.seen.size > 20000) this.seen.clear();
      this.logger.log(`Intent crawl: ${items.length} headlines, ${fresh.length} analysed, ${saved} saved`);
      return { started: true, fetched: items.length, analysed: fresh.length, saved };
    } finally {
      this.running = false;
    }
  }

  private takeApolloCredit(): boolean {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.apolloDay) {
      this.apolloDay = today;
      this.apolloUsed = 0;
    }
    if (this.apolloUsed >= APOLLO_DAILY_CAP) return false;
    this.apolloUsed++;
    return true;
  }

  private async collect(): Promise<RssItem[]> {
    const urls = INTENT_SEARCH_QUERIES.map((q) => googleNewsRssUrl(q));

    // Target companies = companies with deals, rotated so each run covers the next slice.
    const total = await this.prisma.company.count({ where: { deals: { some: {} } } });
    if (total > 0) {
      if (this.companyOffset >= total) this.companyOffset = 0;
      const companies = await this.prisma.company.findMany({
        where: { deals: { some: {} } },
        orderBy: { name: "asc" },
        skip: this.companyOffset,
        take: COMPANIES_PER_RUN,
        select: { name: true },
      });
      this.companyOffset += COMPANIES_PER_RUN;
      for (const c of companies) urls.push(googleNewsRssUrl(`"${c.name}"`, "7d"));
    }

    const byLink = new Map<string, RssItem>();
    const byTitle = new Set<string>();
    for (const url of urls) {
      try {
        const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; VenusCRM-IntentCrawler/1.0)" }, signal: AbortSignal.timeout(15000) });
        if (!res.ok) {
          this.logger.warn(`News feed returned ${res.status}: ${url}`);
          continue;
        }
        for (const item of parseRssItems(await res.text()).slice(0, ITEMS_PER_FEED)) {
          const key = item.title.toLowerCase();
          if (byLink.has(item.link) || byTitle.has(key)) continue; // same story from several searches
          byLink.set(item.link, item);
          byTitle.add(key);
        }
      } catch (err: any) {
        this.logger.warn(`News feed failed (${url}): ${err?.message}`);
      }
      await new Promise((r) => setTimeout(r, 500)); // stay polite to Google News
    }
    return [...byLink.values()];
  }
}
