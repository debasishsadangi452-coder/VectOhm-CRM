import { apiFetch } from "./client";
import type { PersonRef } from "./types";

export interface ActivitySummaryRow {
  user: PersonRef & { department: { id: string; name: string } | null };
  totalPings: number;
  activePings: number;
  activePercent: number;
  // Pings arrive about once a minute, so these approximate minutes.
  activeMinutes: number;
  idleMinutes: number;
  // Plain counts -- never what was typed or where a click landed.
  keystrokeCount: number;
  clickCount: number;
  recordingCount: number;
  recordedSeconds: number;
}

export interface ActivitySummaryFilters {
  userId?: string;
  from?: string;
  to?: string;
}

function buildQuery(filters: ActivitySummaryFilters): string {
  const params = new URLSearchParams();
  if (filters.userId) params.set("userId", filters.userId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function getActivitySummary(filters: ActivitySummaryFilters = {}) {
  return apiFetch<ActivitySummaryRow[]>(`/activity-monitoring/summary${buildQuery(filters)}`);
}

export interface ActivityDailyRow {
  date: string;
  clockedInMinutes: number;
  activeMinutes: number;
  idleMinutes: number;
  activePercent: number;
  // Plain counts for the day -- never what was typed/clicked, just how many
  // keydown/mousedown events the desktop agent's input-count listeners saw.
  keystrokeCount: number;
  clickCount: number;
}

export interface ActivityTimelinePing {
  capturedAt: string;
  active: boolean;
  // Counts since the previous ping (~1 minute).
  keystrokeCount: number;
  clickCount: number;
}

export function getActivityTimeline(userId: string, from: string, to: string) {
  const params = new URLSearchParams({ userId, from, to });
  return apiFetch<ActivityTimelinePing[]>(`/activity-monitoring/timeline?${params.toString()}`);
}

export function getActivityDaily(userId: string, from: string, to: string) {
  const params = new URLSearchParams({ userId, from, to });
  return apiFetch<ActivityDailyRow[]>(`/activity-monitoring/daily?${params.toString()}`);
}
