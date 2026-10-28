import { apiFetch } from "./client";

export interface AiUsageKpi {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCostUsd: number;
  todayTokens: number;
  todayCostUsd: number;
  monthTokens: number;
  monthCostUsd: number;
  totalRequests: number;
}

export interface AiUsageProviderItem {
  provider: string;
  tokens: number;
  costUsd: number;
  percentage: number;
  requestCount: number;
}

export interface AiUsageFeatureItem {
  feature: string;
  label: string;
  tokens: number;
  costUsd: number;
  percentage: number;
  requestCount: number;
}

export interface AiUsageTopUserItem {
  userId: string;
  name: string;
  email: string;
  department: string;
  tokens: number;
  costUsd: number;
  percentage: number;
}

export interface AiUsageRecentLogItem {
  id: string;
  userName: string;
  department: string;
  provider: string;
  model: string;
  feature: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  createdAt: string;
}

export interface AiUsageSummary {
  kpi: AiUsageKpi;
  byProvider: AiUsageProviderItem[];
  byFeature: AiUsageFeatureItem[];
  topUsers: AiUsageTopUserItem[];
  recentLogs: AiUsageRecentLogItem[];
}

export function getAiUsageSummary(
  range: "today" | "7d" | "30d" | "all" = "30d",
): Promise<AiUsageSummary> {
  return apiFetch<AiUsageSummary>(`/ai-usage/summary?range=${range}`);
}
