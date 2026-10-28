import { apiFetch } from "./client";
import type { Activity, ActivityType } from "./types";

export interface ActivityFilters {
  dealId?: string;
}

export interface CreateActivityInput {
  dealId: string;
  type: ActivityType;
  content: string;
  contactId?: string | null;
  outcome?: string | null;
  durationMin?: number | null;
  occurredAt?: string;
}

export type UpdateActivityInput = Partial<Omit<CreateActivityInput, "dealId">>;

function buildQuery(filters: ActivityFilters): string {
  const params = new URLSearchParams();
  if (filters.dealId) params.set("dealId", filters.dealId);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function listActivities(filters: ActivityFilters = {}) {
  return apiFetch<Activity[]>(`/activities${buildQuery(filters)}`);
}

export function createActivity(input: CreateActivityInput) {
  return apiFetch<Activity>("/activities", { method: "POST", body: JSON.stringify(input) });
}

export function updateActivity(id: string, input: UpdateActivityInput) {
  return apiFetch<Activity>(`/activities/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteActivity(id: string) {
  return apiFetch<void>(`/activities/${id}`, { method: "DELETE" });
}
