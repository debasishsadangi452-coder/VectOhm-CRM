import { apiFetch } from "./client";
import type { SalesStats } from "./types";

export function getSalesStats() {
  return apiFetch<SalesStats>("/dashboard/sales");
}
