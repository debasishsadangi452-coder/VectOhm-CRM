import { apiFetch } from "./client";
import type { BulkEmailCampaign, BulkEmailCampaignDetail, BulkEmailRecipient, FollowUpMode } from "./types";

// The email comes from either a saved template (templateId) or a one-off
// written on the Bulk Email page itself (subject + bodyHtml) -- never both.
// The backend rejects the ambiguous combinations, see
// BulkEmailService.resolveContent.
export interface CreateBulkEmailInput {
  name: string;
  templateId?: string;
  subject?: string;
  bodyHtml?: string;
  appendSignature?: boolean;
  contactIds?: string[];
  rawEmails?: string[];
  followUpMode?: FollowUpMode;
  emailConnectionId?: string;
  // Rewrite each recipient's email with AI, using the email above as the base.
  aiPersonalize?: boolean;
  aiInstructions?: string;
}

export function listBulkEmailCampaigns() {
  return apiFetch<BulkEmailCampaign[]>("/bulk-email");
}

export function listFollowUps() {
  return apiFetch<BulkEmailRecipient[]>("/bulk-email/follow-ups");
}

export function getBulkEmailCampaign(id: string) {
  return apiFetch<BulkEmailCampaignDetail>(`/bulk-email/${id}`);
}

export function createBulkEmailCampaign(input: CreateBulkEmailInput) {
  return apiFetch<BulkEmailCampaign>("/bulk-email", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function runBulkEmailEngine() {
  return apiFetch<{ processed: number }>("/bulk-email/engine/run", { method: "POST" });
}

export function dismissBulkEmailFollowUp(recipientId: string) {
  return apiFetch<void>(`/bulk-email/follow-ups/${recipientId}/dismiss`, { method: "PATCH" });
}

export function deleteBulkEmailCampaign(id: string) {
  return apiFetch<{ id: string }>(`/bulk-email/${id}`, { method: "DELETE" });
}

export function retryFailedBulkEmailSends(id: string) {
  return apiFetch<{ count: number }>(`/bulk-email/${id}/retry-failed`, { method: "POST" });
}

export function cancelPendingBulkEmailSends(id: string) {
  return apiFetch<{ count: number }>(`/bulk-email/${id}/cancel-pending`, { method: "POST" });
}

