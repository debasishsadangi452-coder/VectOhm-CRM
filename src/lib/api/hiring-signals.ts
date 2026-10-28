import { apiFetch } from "./client";

export type HiringSignalSource = "GREENHOUSE" | "ASHBY" | "LEVER" | "ADZUNA";

export interface HiringSignalAutomation {
  id: string;
  name: string;
  isActive: boolean;
  industries: string[];
  locations: string[];
  keywords: string | null;
  adzunaEnabled: boolean;
  adzunaRoleKeywords: string[];
  targetTitles: string[];
  sequenceId: string;
  sequence: { id: string; name: string };
  createdById: string;
  createdBy: { id: string; firstName: string; lastName: string };
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { signals: number };
}

export interface HiringSignal {
  id: string;
  companyId: string;
  company: { id: string; name: string; domain: string | null };
  source: HiringSignalSource;
  externalJobId: string;
  jobTitle: string;
  jobUrl: string;
  detectedAt: string;
}

export interface CreateHiringSignalAutomationInput {
  name: string;
  industries?: string[];
  locations?: string[];
  keywords?: string;
  adzunaEnabled?: boolean;
  adzunaRoleKeywords?: string[];
  targetTitles?: string[];
  sequenceId: string;
}

export type UpdateHiringSignalAutomationInput = Partial<CreateHiringSignalAutomationInput> & {
  isActive?: boolean;
};

export function listHiringSignalAutomations() {
  return apiFetch<HiringSignalAutomation[]>("/hiring-signal-automations");
}

export function createHiringSignalAutomation(input: CreateHiringSignalAutomationInput) {
  return apiFetch<HiringSignalAutomation>("/hiring-signal-automations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateHiringSignalAutomation(id: string, input: UpdateHiringSignalAutomationInput) {
  return apiFetch<HiringSignalAutomation>(`/hiring-signal-automations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteHiringSignalAutomation(id: string) {
  return apiFetch<void>(`/hiring-signal-automations/${id}`, { method: "DELETE" });
}

export function runHiringSignalAutomation(id: string) {
  return apiFetch<{ candidatesChecked: number; signalsFound: number }>(
    `/hiring-signal-automations/${id}/run`,
    { method: "POST" },
  );
}

export function listHiringSignalsForAutomation(id: string) {
  return apiFetch<HiringSignal[]>(`/hiring-signal-automations/${id}/signals`);
}

export interface IntentHiringLead {
  id: string;
  jobTitle: string;
  jobUrl: string;
  companyName: string;
  companyLocation?: string;
  companyDomain?: string;
  salary?: string;
  jobDescription?: string;
  discoveredAt: string;
  source: "ADZUNA" | "GREENHOUSE" | "ASHBY" | "LEVER" | "APOLLO_NEWS";
  // Intent News leads only: jobTitle holds the headline, jobUrl the article.
  newsCategory?: NewsLeadCategory;
  newsCategoryLabel?: string;
  // Other recent articles about the same company (Intent News only).
  newsArticles?: NewsArticleSummary[];
  decisionMaker: {
    apolloId?: string;
    name: string;
    firstName?: string;
    lastName?: string;
    title: string;
    email: string | null;
    phone?: string | null;
    phoneType?: "mobile" | "direct" | "office" | null;
    corporatePhone?: string | null;
    linkedinUrl: string | null;
    photoUrl?: string | null;
  } | null;
}

export type NewsSignalCategory = "FUNDING" | "EXPANSION" | "LEADERSHIP" | "PRODUCT" | "PARTNERSHIP";
export type NewsLeadCategory = NewsSignalCategory | "OTHER";

export interface NewsArticleSummary {
  title: string;
  url: string | null;
  publishedAt: string | null;
  category: NewsLeadCategory;
  categoryLabel: string;
}

export interface IntentNewsSearchInput {
  keywords: string;
  location?: string;
  category?: NewsSignalCategory;
  daysBack?: number;
  maxResults?: number;
}

export interface IntentNewsSearchResult {
  keywords: string;
  location: string;
  category: NewsSignalCategory | null;
  daysBack: number;
  totalFound: number;
  // Diagnostics for an empty result: how much Apollo data was actually checked.
  candidatesChecked: number;
  articlesFound: number;
  leads: IntentHiringLead[];
}

// Companies with fresh Apollo news (funding, expansion, leadership change...)
// plus their decision maker -- feeds the same enrich / outreach flow as Intent Hiring.
export function searchIntentNews(input: IntentNewsSearchInput) {
  return apiFetch<IntentNewsSearchResult>("/hiring-signal-automations/intent-news", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// Placeholder rows the server adds when no live openings are found -- never real postings.
export function isSampleLead(lead: Pick<IntentHiringLead, "id">): boolean {
  return lead.id.startsWith("lead-sample-");
}

export interface IntentHiringSearchResult {
  id?: string;
  role: string;
  location: string;
  totalFound: number;
  searchedAt?: string;
  leads: IntentHiringLead[];
}

export interface IntentHiringSearchInput {
  role: string;
  location?: string;
  maxResults?: number;
}

export function searchIntentHiring(input: IntentHiringSearchInput) {
  return apiFetch<IntentHiringSearchResult>("/hiring-signal-automations/intent-search", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getLatestIntentSearch() {
  return apiFetch<IntentHiringSearchResult | null>("/hiring-signal-automations/intent-search/latest");
}

export interface IntentEnrichedContact {
  id: string;
  companyName: string;
  companyDomain: string | null;
  personName: string;
  firstName: string | null;
  lastName: string | null;
  title: string;
  departmentCategory: "FOUNDER_EXEC" | "HR_TALENT" | "OTHER" | string;
  email: string | null;
  phone?: string | null;
  phoneType?: "mobile" | "direct" | "office" | null;
  linkedinUrl: string | null;
  apolloId: string | null;
  sourceJobTitle: string | null;
  sourceJobUrl: string | null;
  discoveredJobId: string | null;
  contactId: string | null;
  sequenceEnrolled: boolean;
  autoEnrolledSequenceId: string | null;
  sequenceName: string | null;
  enrolledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EnrichIntentCompaniesInput {
  companyNames?: string[];
  autoEnrollSequenceId?: string;
  searchRecordId?: string;
}

export interface EnrichIntentCompaniesResult {
  enrichedCount: number;
  autoEnrolledCount: number;
  leads: IntentEnrichedContact[];
}

export function enrichIntentCompanies(input: EnrichIntentCompaniesInput) {
  return apiFetch<EnrichIntentCompaniesResult>("/hiring-signal-automations/intent-enrich", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface ResolveAndSendLeadInput {
  companyName: string;
  companyDomain?: string;
  sequenceId: string;
}

export interface ResolveAndSendLeadResult {
  decisionMaker: NonNullable<IntentHiringLead["decisionMaker"]>;
}

// For a lead the live search didn't already resolve a decision-maker for --
// runs a fresh Apollo lookup for that one company and, if found, enrolls
// them in the chosen sequence. The only thing in Intent Hiring that ever
// actually sends an email; everything else is just search results.
export function resolveAndSendIntentLead(input: ResolveAndSendLeadInput) {
  return apiFetch<ResolveAndSendLeadResult>("/hiring-signal-automations/resolve-and-send", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getEnrichedContacts() {
  return apiFetch<IntentEnrichedContact[]>("/hiring-signal-automations/enriched-contacts");
}

export interface EnrollIntentContactsInput {
  leadIds: string[];
  sequenceId: string;
}

export function enrollIntentContacts(input: EnrollIntentContactsInput) {
  return apiFetch<{ successCount: number; results: Array<{ contactId: string; enrolled: boolean; reason?: string }> }>(
    "/hiring-signal-automations/enriched-contacts/enroll",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function deleteEnrichedContact(id: string) {
  return apiFetch<{ deleted: boolean }>(`/hiring-signal-automations/enriched-contacts/${id}`, {
    method: "DELETE",
  });
}

export interface AutomateIntentEmailInput {
  templateId?: string;
  campaignName?: string;
  customSubject?: string;
  customBodyHtml?: string;
  appendSignature?: boolean;
  leads: Array<{
    companyName: string;
    companyDomain?: string;
    companyLocation?: string;
    jobTitle: string;
    jobUrl?: string;
    salary?: string;
    decisionMaker?: {
      name?: string;
      firstName?: string;
      lastName?: string;
      title?: string;
      email?: string | null;
      phone?: string | null;
      phoneType?: string | null;
      linkedinUrl?: string | null;
    } | null;
  }>;
}

export interface AutomateIntentEmailResult {
  campaignId: string;
  campaignName: string;
  totalRecipients: number;
  processedImmediately: number;
  recipients: Array<{ companyName: string; email: string; personName: string; status: string }>;
}

export function automateIntentEmail(input: AutomateIntentEmailInput) {
  return apiFetch<AutomateIntentEmailResult>("/hiring-signal-automations/automate-email", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
