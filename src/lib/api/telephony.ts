import { apiFetch } from "./client";
import type {
  Call,
  CallAnalytics,
  CallCampaign,
  CallCampaignDetail,
  CallCampaignQueueLead,
  CallLookupResult,
  CallStatus,
  PhoneNumber,
  TelephonyConnectionStatus,
} from "./types";

// ─── Connection (Admin) ─────────────────────────────────────────────────────

export function getJustCallConnection() {
  return apiFetch<TelephonyConnectionStatus>("/telephony/connection");
}

export function connectJustCall(apiKey: string, apiSecret: string, webhookSecret?: string) {
  return apiFetch<TelephonyConnectionStatus>("/telephony/connection", {
    method: "PUT",
    body: JSON.stringify({ apiKey, apiSecret, webhookSecret }),
  });
}

export function disconnectJustCall() {
  return apiFetch<{ connected: false }>("/telephony/connection", { method: "DELETE" });
}

export function getCloudTalkConnection() {
  return apiFetch<TelephonyConnectionStatus>("/telephony/cloudtalk/connection");
}

export function connectCloudTalk(apiKeyId: string, apiKeySecret: string, webhookSecret?: string) {
  return apiFetch<TelephonyConnectionStatus>("/telephony/cloudtalk/connection", {
    method: "PUT",
    body: JSON.stringify({ apiKeyId, apiKeySecret, webhookSecret }),
  });
}

export function disconnectCloudTalk() {
  return apiFetch<{ connected: false }>("/telephony/cloudtalk/connection", { method: "DELETE" });
}

// ─── Phone numbers ───────────────────────────────────────────────────────────

export function listPhoneNumbers() {
  return apiFetch<PhoneNumber[]>("/telephony/numbers");
}

export interface CreatePhoneNumberInput {
  providerId: string;
  e164: string;
  country: string;
  label?: string;
  departmentId?: string;
  smsCapable?: boolean;
}

export function createPhoneNumber(input: CreatePhoneNumberInput) {
  return apiFetch<PhoneNumber>("/telephony/numbers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updatePhoneNumber(
  id: string,
  input: Partial<Pick<PhoneNumber, "label" | "departmentId" | "active">>,
) {
  return apiFetch<PhoneNumber>(`/telephony/numbers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deletePhoneNumber(id: string) {
  return apiFetch<{ removed: true }>(`/telephony/numbers/${id}`, { method: "DELETE" });
}

// ─── Calls ───────────────────────────────────────────────────────────────────

export interface ListCallsFilters {
  contactId?: string;
  dealId?: string;
  agentId?: string;
  status?: CallStatus;
  from?: string;
  to?: string;
}

export function listCalls(filters: ListCallsFilters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return apiFetch<Call[]>(`/telephony/calls${qs ? `?${qs}` : ""}`);
}

export function getCall(id: string) {
  return apiFetch<Call>(`/telephony/calls/${id}`);
}

export interface CreateCallInput {
  toNumber: string;
  fromNumber?: string;
  direction?: "OUTBOUND" | "INBOUND";
  contactId?: string;
  companyId?: string;
  dealId?: string;
  campaignId?: string;
  provider?: string;
}

export function createCall(input: CreateCallInput) {
  return apiFetch<Call>("/telephony/calls", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function linkProviderCallId(id: string, providerCallId: string) {
  return apiFetch<Call>(`/telephony/calls/${id}/link-provider-id`, {
    method: "PATCH",
    body: JSON.stringify({ providerCallId }),
  });
}

export interface UpdateCallDispositionInput {
  disposition?: string;
  notes?: string;
  nextFollowUpAt?: string;
}

export function updateCallDisposition(id: string, input: UpdateCallDispositionInput) {
  return apiFetch<Call>(`/telephony/calls/${id}/disposition`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

// Backs IncomingCallModal -- resolves an inbound caller's number to a known
// Contact (+ company + most relevant open deal), or null if unrecognized.
export function lookupCallerByPhone(number: string) {
  return apiFetch<CallLookupResult | null>(
    `/telephony/calls/lookup?number=${encodeURIComponent(number)}`,
  );
}

export function getCallAnalytics(filters: { from?: string; to?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const qs = params.toString();
  return apiFetch<CallAnalytics>(`/telephony/calls/analytics${qs ? `?${qs}` : ""}`);
}

// ─── Call campaigns (power dialer) ──────────────────────────────────────────

export function listCallCampaigns() {
  return apiFetch<CallCampaign[]>("/telephony/campaigns");
}

export function getCallCampaign(id: string) {
  return apiFetch<CallCampaignDetail>(`/telephony/campaigns/${id}`);
}

export interface CreateCallCampaignInput {
  name: string;
  contactIds: string[];
  assignToId?: string;
}

export function createCallCampaign(input: CreateCallCampaignInput) {
  return apiFetch<CallCampaign>("/telephony/campaigns", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getMyCallQueue() {
  return apiFetch<CallCampaignQueueLead[]>("/telephony/campaigns/my-queue");
}

export function claimNextCallCampaignLead(campaignId: string) {
  return apiFetch<CallCampaignQueueLead | null>(`/telephony/campaigns/${campaignId}/claim-next`, {
    method: "POST",
  });
}
