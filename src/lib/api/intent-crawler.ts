import { apiFetch } from "./client";
import type { IntentSignalTier } from "./intent-news-scraper";

export interface CrawledArticle {
  id: string;
  title: string;
  url: string;
  domain: string;
  publishedAt: string | null;
  keySnippet: string | null;
  tier: IntentSignalTier;
  isErpAiPriority: boolean;
  intentScore: number;
  erpVendors: string[];
  companyName: string | null;
  status: "NEW" | "ENRICHED" | "CONTACTED" | "ARCHIVED";
  createdAt: string;
}

export interface CrawlSourceResult {
  id: string;
  label: string;
  fetched: number;
  matched: number;
  ingested: number;
  error?: string;
}

export interface CrawledArticlesResponse {
  total: number;
  articles: CrawledArticle[];
  stats: { all: number; newToday: number };
  sources: Array<{ domain: string; count: number }>;
  crawl: { lastRun: { at: string; results: CrawlSourceResult[] } | null; running: boolean };
}

export async function fetchCrawledArticles(params: {
  days?: number;
  source?: string;
  status?: string;
  search?: string;
  take?: number;
  skip?: number;
}): Promise<CrawledArticlesResponse> {
  const q = new URLSearchParams();
  if (params.days) q.set("days", String(params.days));
  if (params.source) q.set("source", params.source);
  if (params.status) q.set("status", params.status);
  if (params.search) q.set("search", params.search);
  if (params.take) q.set("take", String(params.take));
  if (params.skip) q.set("skip", String(params.skip));
  const qs = q.toString();
  return apiFetch<CrawledArticlesResponse>(`/intent-crawler/articles${qs ? `?${qs}` : ""}`);
}

export async function runCrawlNow(): Promise<{ skipped: boolean; reason?: string; results?: CrawlSourceResult[] }> {
  return apiFetch("/intent-crawler/run", { method: "POST", body: JSON.stringify({}) });
}
