import { apiFetch } from "./client";
import type { AnalyticsSummary } from "./types";

export function getAnalyticsSummary() {
  return apiFetch<AnalyticsSummary>("/analytics/summary");
}
