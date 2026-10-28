import { apiFetch } from "./client";
import type { NewsSignalCategory } from "./hiring-signals";

export type IntentAutomationSource = "HIRING" | "NEWS" | "BOTH";
export type IntentAutomationFrequency = "DAILY" | "WEEKDAYS" | "WEEKLY";
export type IntentOutreachStatus = "PENDING_APPROVAL" | "SENT" | "FAILED" | "REJECTED";

export interface IntentAutomationRun {
  id: string;
  automationId: string;
  trigger: "SCHEDULE" | "MANUAL";
  status: "RUNNING" | "COMPLETED" | "FAILED";
  startedAt: string;
  finishedAt: string | null;
  leadsFound: number;
  queued: number;
  sent: number;
  skipped: number;
  failed: number;
  error: string | null;
}

export interface IntentAutomation {
  id: string;
  name: string;
  isActive: boolean;
  source: IntentAutomationSource;
  roles: string[];
  location: string | null;
  newsKeywords: string | null;
  newsCategory: NewsSignalCategory | null;
  newsDaysBack: number;
  frequency: IntentAutomationFrequency;
  timeOfDay: string;
  weekday: number | null;
  autoSend: boolean;
  dailyCap: number;
  cooldownDays: number;
  offerDescription: string;
  tone: string;
  nextRunAt: string | null;
  lastRunAt: string | null;
  createdBy: { id: string; firstName: string; lastName: string };
  lastRun: IntentAutomationRun | null;
  pendingApproval: number;
}

export interface IntentAutomationInput {
  name: string;
  source: IntentAutomationSource;
  roles?: string[];
  location?: string;
  newsKeywords?: string;
  newsCategory?: NewsSignalCategory;
  newsDaysBack?: number;
  frequency: IntentAutomationFrequency;
  timeOfDay: string;
  weekday?: number;
  autoSend?: boolean;
  dailyCap?: number;
  cooldownDays?: number;
  offerDescription: string;
  tone?: string;
  isActive?: boolean;
}

export type IntentLeadOutcome = "QUEUED" | "SENT" | "FAILED" | "SKIPPED";

// Everything a run found, whether or not an email came of it.
export interface IntentAutomationLead {
  id: string;
  automationId: string;
  runId: string;
  companyName: string;
  companyDomain: string | null;
  companyLocation: string | null;
  signalType: "HIRING" | "NEWS";
  signalTitle: string;
  signalUrl: string | null;
  signalDetail: string | null;
  signalDate: string | null;
  contactName: string | null;
  contactTitle: string | null;
  contactEmail: string | null;
  contactLinkedin: string | null;
  outcome: IntentLeadOutcome;
  skipReason: string | null;
  createdAt: string;
}

export interface IntentOutreach {
  id: string;
  automationId: string;
  automation: { id: string; name: string; autoSend: boolean };
  companyName: string;
  contactName: string;
  contactTitle: string | null;
  contactEmail: string;
  signalType: "HIRING" | "NEWS";
  signalTitle: string;
  signalUrl: string | null;
  subject: string;
  body: string;
  status: IntentOutreachStatus;
  error: string | null;
  sentAt: string | null;
  createdAt: string;
}

const BASE = "/intent-automations";
const json = (body: unknown) => ({ method: "POST", body: JSON.stringify(body) });

export const listIntentAutomations = () => apiFetch<IntentAutomation[]>(BASE);
export const createIntentAutomation = (input: IntentAutomationInput) => apiFetch<IntentAutomation>(BASE, json(input));
export const updateIntentAutomation = (id: string, input: Partial<IntentAutomationInput>) =>
  apiFetch<IntentAutomation>(`${BASE}/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const deleteIntentAutomation = (id: string) => apiFetch<void>(`${BASE}/${id}`, { method: "DELETE" });
export const runIntentAutomation = (id: string) => apiFetch<IntentAutomationRun>(`${BASE}/${id}/run`, { method: "POST" });
export const listIntentAutomationRuns = (id: string) => apiFetch<IntentAutomationRun[]>(`${BASE}/${id}/runs`);
export const listIntentAutomationLeads = (id: string, params: { runId?: string; outcome?: IntentLeadOutcome } = {}) => {
  const q = new URLSearchParams();
  if (params.runId) q.set("runId", params.runId);
  if (params.outcome) q.set("outcome", params.outcome);
  const qs = q.toString();
  return apiFetch<IntentAutomationLead[]>(`${BASE}/${id}/leads${qs ? `?${qs}` : ""}`);
};
export const listIntentOutreach = (params: { status?: IntentOutreachStatus; automationId?: string } = {}) => {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.automationId) q.set("automationId", params.automationId);
  const qs = q.toString();
  return apiFetch<IntentOutreach[]>(`${BASE}/outreach${qs ? `?${qs}` : ""}`);
};
export const updateIntentOutreachDraft = (id: string, input: { subject?: string; body?: string }) =>
  apiFetch<IntentOutreach>(`${BASE}/outreach/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const approveIntentOutreach = (id: string) => apiFetch<IntentOutreach>(`${BASE}/outreach/${id}/approve`, { method: "POST" });
export const rejectIntentOutreach = (id: string) => apiFetch<IntentOutreach>(`${BASE}/outreach/${id}/reject`, { method: "POST" });
export const approveAllIntentOutreach = (automationId: string) =>
  apiFetch<{ sent: number; failed: number }>(`${BASE}/${automationId}/approve-all`, { method: "POST" });
