import { apiFetch } from "./client";
import type { FollowUpTask, FollowUpTaskStatus } from "./types";

export function listFollowUps(status?: FollowUpTaskStatus) {
  const qs = status ? `?status=${status}` : "";
  return apiFetch<FollowUpTask[]>(`/follow-ups${qs}`);
}

export function generateFollowUpDraft(id: string) {
  return apiFetch<{ subject: string; body: string }>(`/follow-ups/${id}/generate-draft`, {
    method: "POST",
  });
}

export function sendFollowUp(id: string, subject: string, body: string) {
  return apiFetch<FollowUpTask>(`/follow-ups/${id}/send`, {
    method: "POST",
    body: JSON.stringify({ subject, body }),
  });
}

export function dismissFollowUp(id: string) {
  return apiFetch<FollowUpTask>(`/follow-ups/${id}/dismiss`, { method: "PATCH" });
}
