import { apiFetch } from "./client";
import type { CampaignMetrics, EngagementEvent, EngagementMetrics } from "./types";

export interface EngagementEventFilters {
  contactId?: string;
  dealId?: string;
  campaignId?: string;
  sequenceId?: string;
  recipientId?: string;
  take?: number;
}

function buildQuery(filters: EngagementEventFilters): string {
  const params = new URLSearchParams();
  if (filters.contactId) params.set("contactId", filters.contactId);
  if (filters.dealId) params.set("dealId", filters.dealId);
  if (filters.campaignId) params.set("campaignId", filters.campaignId);
  if (filters.sequenceId) params.set("sequenceId", filters.sequenceId);
  if (filters.recipientId) params.set("recipientId", filters.recipientId);
  if (filters.take) params.set("take", String(filters.take));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function listEngagementEvents(filters: EngagementEventFilters = {}) {
  return apiFetch<EngagementEvent[]>(`/engagement/events${buildQuery(filters)}`);
}

export function getEngagementMetrics() {
  return apiFetch<EngagementMetrics>("/engagement/metrics");
}

export function getCampaignMetrics(id: string) {
  return apiFetch<CampaignMetrics>(`/engagement/campaign-metrics/${id}`);
}

export function getSequenceMetrics(id: string) {
  return apiFetch<CampaignMetrics>(`/engagement/sequence-metrics/${id}`);
}
