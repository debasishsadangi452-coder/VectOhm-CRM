import { apiFetch } from "./client";
import { UserSummary, Department } from "./types";

export interface SeoKeyword {
  id: string;
  term: string;
  searchIntent?: string | null;
  volume: number;
  difficulty: number;
  currentRank: number | null;
  targetRank: number | null;
  url: string | null;
  projectId: string | null;
  campaignId?: string | null;
  departmentId: string;
  department?: Department;
  createdAt: string;
  updatedAt: string;
}

export interface SeoCompetitor {
  id: string;
  domain: string;
  da: number;
  traffic: number;
  departmentId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SeoAudit {
  id: string;
  url: string;
  score: number;
  issues: string; // JSON string
  departmentId: string;
  department?: Department;
  runAt: string;
}

export type BacklinkVerificationStatus = "PENDING" | "VERIFIED" | "REJECTED" | "LOST";

export interface SeoBacklink {
  id: string;
  sourceUrl: string;
  targetUrl: string;
  anchorText?: string | null;
  domainAuthority: number;
  spamScore?: number;
  linkType?: string;
  status: BacklinkVerificationStatus;
  loggedById?: string | null;
  loggedBy?: UserSummary | null;
  verifiedById?: string | null;
  verifiedBy?: UserSummary | null;
  rejectionNote?: string | null;
  projectId?: string | null;
  departmentId: string;
  department?: Department;
  createdAt: string;
  updatedAt: string;
}

export type ContentBriefStatus =
  | "DRAFT"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "UNDER_REVIEW"
  | "REVISION_REQUIRED"
  | "APPROVED"
  | "PUBLISHED";

export type SlaStatus = "ON_TRACK" | "AT_RISK" | "OVERDUE";

export interface ContentBriefQaCheck {
  id: string;
  briefId: string;
  checkItem: string;
  isPassed: boolean;
  verifiedById?: string | null;
}

export interface ContentPerformanceMetric {
  id: string;
  briefId: string;
  pageViews: number;
  uniqueVisitors: number;
  ctr: number;
  rankingPosition?: number | null;
  leadsGenerated: number;
}

export interface SeoContentBrief {
  id: string;
  title: string;
  targetKeyword: string;
  secondaryKeywords?: string[];
  targetWordCount?: number;
  outlineJson?: string | null;
  status: ContentBriefStatus;
  slaStatus?: SlaStatus;
  dueDate: string | null;
  publishDate?: string | null;
  projectId?: string | null;
  campaignId?: string | null;
  assigneeId: string | null;
  assignee?: UserSummary;
  reviewerId?: string | null;
  reviewer?: UserSummary;
  content: string | null;
  rejectionReason?: string | null;
  qaChecklist?: ContentBriefQaCheck[];
  performance?: ContentPerformanceMetric | null;
  departmentId: string;
  department?: Department;
  createdAt: string;
  updatedAt: string;
}

export interface MarketingCampaign {
  id: string;
  name: string;
  description?: string | null;
  startDate: string;
  endDate?: string | null;
  budget?: number;
  spent?: number;
  targetLeads?: number;
  status: string;
  projectId?: string | null;
  departmentId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SeoKpiGoal {
  id: string;
  title: string;
  metricType: string;
  targetValue: number;
  currentValue: number;
  startDate: string;
  endDate: string;
  projectId?: string | null;
  departmentId: string;
  createdAt: string;
  updatedAt: string;
}

// Keyword endpoints
export function getKeywords(departmentId?: string): Promise<SeoKeyword[]> {
  const params = departmentId ? `?departmentId=${departmentId}` : "";
  return apiFetch<SeoKeyword[]>(`/seo-keywords${params}`);
}

export function createKeyword(keyword: Partial<SeoKeyword>): Promise<SeoKeyword> {
  return apiFetch<SeoKeyword>("/seo-keywords", {
    method: "POST",
    body: JSON.stringify(keyword),
  });
}

// Audit endpoints
export function getAudits(departmentId?: string): Promise<SeoAudit[]> {
  const params = departmentId ? `?departmentId=${departmentId}` : "";
  return apiFetch<SeoAudit[]>(`/seo-audits${params}`);
}

export function createAudit(audit: Partial<SeoAudit>): Promise<SeoAudit> {
  return apiFetch<SeoAudit>("/seo-audits", {
    method: "POST",
    body: JSON.stringify(audit),
  });
}

// Backlink endpoints
export function getBacklinks(departmentId?: string): Promise<SeoBacklink[]> {
  const params = departmentId ? `?departmentId=${departmentId}` : "";
  return apiFetch<SeoBacklink[]>(`/seo-backlinks${params}`);
}

export function createBacklink(backlink: Partial<SeoBacklink>): Promise<SeoBacklink> {
  return apiFetch<SeoBacklink>("/seo-backlinks", {
    method: "POST",
    body: JSON.stringify(backlink),
  });
}

export function updateBacklink(id: string, backlink: Partial<SeoBacklink>): Promise<SeoBacklink> {
  return apiFetch<SeoBacklink>(`/seo-backlinks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(backlink),
  });
}

// Content Brief endpoints
export function getContentBriefs(departmentId?: string): Promise<SeoContentBrief[]> {
  const params = departmentId ? `?departmentId=${departmentId}` : "";
  return apiFetch<SeoContentBrief[]>(`/seo-content-briefs${params}`);
}

export function createContentBrief(brief: Partial<SeoContentBrief>): Promise<SeoContentBrief> {
  return apiFetch<SeoContentBrief>("/seo-content-briefs", {
    method: "POST",
    body: JSON.stringify(brief),
  });
}

export function updateContentBrief(
  id: string,
  brief: Partial<SeoContentBrief>,
): Promise<SeoContentBrief> {
  return apiFetch<SeoContentBrief>(`/seo-content-briefs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(brief),
  });
}

export function generateContentBrief(id: string): Promise<SeoContentBrief> {
  return apiFetch<SeoContentBrief>(`/seo-content-briefs/${id}/generate`, {
    method: "POST",
  });
}

// Content Brief QA checklist endpoints
export function addQaCheck(briefId: string, checkItem: string): Promise<ContentBriefQaCheck> {
  return apiFetch<ContentBriefQaCheck>(`/seo-content-briefs/${briefId}/qa-checks`, {
    method: "POST",
    body: JSON.stringify({ checkItem }),
  });
}

export function toggleQaCheck(checkId: string, isPassed: boolean): Promise<ContentBriefQaCheck> {
  return apiFetch<ContentBriefQaCheck>(`/seo-content-briefs/qa-checks/${checkId}`, {
    method: "PATCH",
    body: JSON.stringify({ isPassed }),
  });
}

export function removeQaCheck(checkId: string): Promise<void> {
  return apiFetch<void>(`/seo-content-briefs/qa-checks/${checkId}`, {
    method: "DELETE",
  });
}

// Competitors endpoints
export function getCompetitors(departmentId?: string): Promise<SeoCompetitor[]> {
  const params = departmentId ? `?departmentId=${departmentId}` : "";
  return apiFetch<SeoCompetitor[]>(`/seo-competitors${params}`);
}

export function createCompetitor(competitor: Partial<SeoCompetitor>): Promise<SeoCompetitor> {
  return apiFetch<SeoCompetitor>("/seo-competitors", {
    method: "POST",
    body: JSON.stringify(competitor),
  });
}

// Marketing Campaign endpoints
export function getCampaigns(departmentId?: string): Promise<MarketingCampaign[]> {
  const params = departmentId ? `?departmentId=${departmentId}` : "";
  return apiFetch<MarketingCampaign[]>(`/seo-marketing-campaigns${params}`);
}

export function createCampaign(campaign: Partial<MarketingCampaign>): Promise<MarketingCampaign> {
  return apiFetch<MarketingCampaign>("/seo-marketing-campaigns", {
    method: "POST",
    body: JSON.stringify(campaign),
  });
}

export function updateCampaign(
  id: string,
  campaign: Partial<MarketingCampaign>,
): Promise<MarketingCampaign> {
  return apiFetch<MarketingCampaign>(`/seo-marketing-campaigns/${id}`, {
    method: "PATCH",
    body: JSON.stringify(campaign),
  });
}

export function deleteCampaign(id: string): Promise<void> {
  return apiFetch<void>(`/seo-marketing-campaigns/${id}`, { method: "DELETE" });
}

// SEO KPI Goal endpoints
export function getKpiGoals(departmentId?: string): Promise<SeoKpiGoal[]> {
  const params = departmentId ? `?departmentId=${departmentId}` : "";
  return apiFetch<SeoKpiGoal[]>(`/seo-kpi-goals${params}`);
}

export function createKpiGoal(goal: Partial<SeoKpiGoal>): Promise<SeoKpiGoal> {
  return apiFetch<SeoKpiGoal>("/seo-kpi-goals", {
    method: "POST",
    body: JSON.stringify(goal),
  });
}

export function updateKpiGoal(id: string, goal: Partial<SeoKpiGoal>): Promise<SeoKpiGoal> {
  return apiFetch<SeoKpiGoal>(`/seo-kpi-goals/${id}`, {
    method: "PATCH",
    body: JSON.stringify(goal),
  });
}

export function deleteKpiGoal(id: string): Promise<void> {
  return apiFetch<void>(`/seo-kpi-goals/${id}`, { method: "DELETE" });
}
