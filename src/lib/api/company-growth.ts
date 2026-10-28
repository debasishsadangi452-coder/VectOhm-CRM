import { apiFetch } from "./client";

export type CompanyGrowthSignalType =
  | "HIRING_VELOCITY"
  | "NEWS_EXPANSION"
  | "NEWS_FUNDING"
  | "NEWS_DEAL"
  | "APOLLO_HIRING"
  | "APOLLO_HEADCOUNT_GROWTH";
export type CompanyGrowthSignalStatus = "PENDING" | "ACCEPTED" | "DISMISSED";

export interface CompanyGrowthSignal {
  id: string;
  companyId: string;
  company: { id: string; name: string; domain: string | null };
  type: CompanyGrowthSignalType;
  status: CompanyGrowthSignalStatus;
  summary: string;
  sourceUrl: string | null;
  sequenceId: string | null;
  reviewedBy: { id: string; firstName: string; lastName: string } | null;
  reviewedAt: string | null;
  detectedAt: string;
}

export interface GrowthSignalFilters {
  status?: CompanyGrowthSignalStatus;
  companyId?: string;
}

function buildQuery(filters: GrowthSignalFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.companyId) params.set("companyId", filters.companyId);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function listGrowthSignals(filters: GrowthSignalFilters = {}) {
  return apiFetch<CompanyGrowthSignal[]>(`/company-growth-signals${buildQuery(filters)}`);
}

export function acceptGrowthSignal(id: string, sequenceId: string) {
  return apiFetch<CompanyGrowthSignal>(`/company-growth-signals/${id}/accept`, {
    method: "POST",
    body: JSON.stringify({ sequenceId }),
  });
}

export function dismissGrowthSignal(id: string) {
  return apiFetch<CompanyGrowthSignal>(`/company-growth-signals/${id}/dismiss`, { method: "POST" });
}

export interface NewsArticleLogEntry {
  id: string;
  company: { id: string; name: string };
  title: string;
  url: string;
  sourceName: string | null;
  publishedAt: string | null;
  fetchedAt: string;
  classified: boolean;
  relevant: boolean | null;
  signalType: CompanyGrowthSignalType | null;
}

export interface ScanNewsResult {
  companiesScanned: number;
  articlesFetched: number;
  signalsFound: number;
}

// Every article NewsAPI has returned, whether or not it became a signal --
// lets you confirm the news half of the pipeline is actually fetching data
// independent of whether ANTHROPIC_API_KEY is set yet.
export function listNewsLog(companyId?: string) {
  const qs = companyId ? `?companyId=${companyId}` : "";
  return apiFetch<NewsArticleLogEntry[]>(`/company-growth-signals/news-log${qs}`);
}

// Manual trigger -- doesn't wait for the 6am cron.
export function scanNewsNow() {
  return apiFetch<ScanNewsResult>("/company-growth-signals/scan-news", { method: "POST" });
}

export interface ScanApolloResult {
  automationsScanned: number;
  companiesChecked: number;
  signalsFound: number;
}

// Deterministic scan straight from Apollo's own org search data (active
// hiring, headcount growth) -- no news search, no LLM classification.
// Manual trigger, same as scanNewsNow -- doesn't wait for the 7am cron.
export function scanApolloNow() {
  return apiFetch<ScanApolloResult>("/company-growth-signals/scan-apollo", { method: "POST" });
}
