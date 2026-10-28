import { apiFetch } from "./client";
import type { LastLogin, LoginEvent } from "./types";

export function listLoginEvents(params: { userId?: string; limit?: number } = {}) {
  const search = new URLSearchParams();
  if (params.userId) search.set("userId", params.userId);
  if (params.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  return apiFetch<LoginEvent[]>(`/login-events${qs ? `?${qs}` : ""}`);
}

export function listLastLogins() {
  return apiFetch<LastLogin[]>("/login-events/last-logins");
}
