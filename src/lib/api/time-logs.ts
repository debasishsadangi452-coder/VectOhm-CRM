import { apiFetch } from "./client";
import type { TimeLog, TimeLogStatus } from "./types";

export interface TimeLogFilters {
  taskId?: string;
  userId?: string;
  projectId?: string;
  from?: string;
  to?: string;
  mine?: boolean;
  status?: TimeLogStatus;
}

export interface CreateTimeLogInput {
  taskId: string;
  date: string;
  minutes: number;
  note?: string;
}

export interface UpdateTimeLogInput {
  date?: string;
  minutes?: number;
  note?: string | null;
}

// Reviewer-only fields (see TimeLogsService.update) -- kept as a distinct
// input type from UpdateTimeLogInput so a review call can't accidentally
// also carry content edits.
export interface ReviewTimeLogInput {
  status: "APPROVED" | "REJECTED";
  reviewNote?: string;
}

export function listTimeLogs(filters: TimeLogFilters = {}) {
  const params = new URLSearchParams();
  if (filters.taskId) params.set("taskId", filters.taskId);
  if (filters.userId) params.set("userId", filters.userId);
  if (filters.projectId) params.set("projectId", filters.projectId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.mine) params.set("mine", "true");
  if (filters.status) params.set("status", filters.status);
  const qs = params.toString();
  return apiFetch<TimeLog[]>(`/time-logs${qs ? `?${qs}` : ""}`);
}

export function createTimeLog(input: CreateTimeLogInput) {
  return apiFetch<TimeLog>("/time-logs", { method: "POST", body: JSON.stringify(input) });
}

export function updateTimeLog(id: string, input: UpdateTimeLogInput) {
  return apiFetch<TimeLog>(`/time-logs/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function reviewTimeLog(id: string, input: ReviewTimeLogInput) {
  return apiFetch<TimeLog>(`/time-logs/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteTimeLog(id: string) {
  return apiFetch<void>(`/time-logs/${id}`, { method: "DELETE" });
}
