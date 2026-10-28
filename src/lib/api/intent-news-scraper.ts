import { apiFetch } from "./client";

export type IntentSignalTier = "ERP_AI_VIP" | "ENTERPRISE_HIGH" | "STANDARD_GROWTH";

export interface DecisionMakerInfo {
  name: string;
  title: string;
  email: string | null;
  linkedinUrl: string | null;
  apolloId: string | null;
  corporatePhone: string | null;
}

export interface ScrapedIntentArticle {
  id: string;
  title: string;
  url: string;
  domain: string;
  publishedAt: string;
  rawContent: string | null;
  keySnippet: string | null;
  signalType: "ERP_AI" | "FUNDING" | "EXPANSION" | "HIRING" | "OTHER" | null;
  tier: IntentSignalTier;
  isErpAiPriority: boolean;
  intentScore: number;
  erpVendors: string[];
  aiKeywords: string[];
  targetedRoles: string[];
  companyName: string | null;
  companyDomain: string | null;
  companyId: string | null;
  company?: { id: string; name: string; domain: string | null } | null;
  discoveredById: string | null;
  decisionMaker: DecisionMakerInfo | null;
  aiDraftedEmail: string | null;
  status: "NEW" | "ENRICHED" | "CONTACTED" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
}

export interface ScrapedArticlesResponse {
  total: number;
  articles: ScrapedIntentArticle[];
}

export interface ScrapedSummaryStats {
  total: number;
  erpAiCount: number;
  enrichedCount: number;
  standardCount: number;
}

export async function fetchScrapedArticles(params?: {
  isErpAiPriority?: boolean;
  tier?: string;
  status?: string;
  search?: string;
  take?: number;
  skip?: number;
}): Promise<ScrapedArticlesResponse> {
  const q = new URLSearchParams();
  if (params?.isErpAiPriority !== undefined) q.set("isErpAiPriority", String(params.isErpAiPriority));
  if (params?.tier) q.set("tier", params.tier);
  if (params?.status) q.set("status", params.status);
  if (params?.search) q.set("search", params.search);
  if (params?.take) q.set("take", String(params.take));
  if (params?.skip) q.set("skip", String(params.skip));

  const qs = q.toString() ? `?${q.toString()}` : "";
  return apiFetch<ScrapedArticlesResponse>(`/intent-news/scraped${qs}`);
}

// Admin/manager: run the server's automatic news crawl now (it also runs every 3 hours).
export async function startIntentCrawl(): Promise<{ started: boolean }> {
  return apiFetch<{ started: boolean }>("/intent-news/scraped/crawl-now", { method: "POST" });
}

export async function fetchScrapedSummaryStats(): Promise<ScrapedSummaryStats> {
  return apiFetch<ScrapedSummaryStats>("/intent-news/scraped/stats");
}

export async function updateScrapedArticleStatus(id: string, status: string): Promise<ScrapedIntentArticle> {
  return apiFetch<ScrapedIntentArticle>(`/intent-news/scraped/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function deleteScrapedArticle(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/intent-news/scraped/${id}`, {
    method: "DELETE",
  });
}

export async function ingestScrapedArticle(dto: {
  articleTitle: string;
  articleUrl: string;
  sourceDomain: string;
  companyName?: string;
  companyDomain?: string;
  rawContent?: string;
  keySnippet?: string;
  isErpAiPriority?: boolean;
  tier?: IntentSignalTier;
  intentScore?: number;
  erpVendors?: string[];
  aiKeywords?: string[];
  targetedRoles?: string[];
}): Promise<ScrapedIntentArticle> {
  return apiFetch<ScrapedIntentArticle>("/intent-news/ingest-scraped", {
    method: "POST",
    body: JSON.stringify(dto),
  });
}
