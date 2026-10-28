import { apiFetch } from "./client";
import type { SyncedEmail, EmailDirection } from "./types";

export interface SyncedEmailFilters {
  contactId?: string;
  dealId?: string;
  direction?: EmailDirection;
  search?: string;
}

export interface SendDirectEmailInput {
  to: string;
  cc?: string[];
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
  contactId?: string;
  dealId?: string;
}

function buildQuery(filters: SyncedEmailFilters): string {
  const params = new URLSearchParams();
  if (filters.contactId) params.set("contactId", filters.contactId);
  if (filters.dealId) params.set("dealId", filters.dealId);
  if (filters.direction) params.set("direction", filters.direction);
  if (filters.search) params.set("search", filters.search);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function listSyncedEmails(filters: SyncedEmailFilters = {}) {
  return apiFetch<SyncedEmail[]>(`/synced-emails${buildQuery(filters)}`);
}

export function markSyncedEmailRead(id: string) {
  return apiFetch<SyncedEmail>(`/synced-emails/${id}/read`, { method: "PATCH" });
}

export function triggerSyncEmails() {
  return apiFetch<{ processed: number; syncedCount: number }>(`/synced-emails/sync`, { method: "POST" });
}

export function sendDirectEmail(input: SendDirectEmailInput) {
  return apiFetch<SyncedEmail>(`/synced-emails/send`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteSyncedEmail(id: string) {
  return apiFetch<{ success: boolean }>(`/synced-emails/${id}`, {
    method: "DELETE",
  });
}

