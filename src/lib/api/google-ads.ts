import { apiFetch } from "./client";

export interface GoogleAdsStatus {
  connected: boolean;
  customerAccountId: string | null;
  managerAccountId: string | null;
  developerTokenConfigured: boolean;
  autoSyncEnabled: boolean;
  isSimulated: boolean;
  lastSyncedAt: string | null;
  connectedByName: string | null;
}

export interface Ga4Status {
  connected: boolean;
  propertyId: string | null;
  serviceAccountConfigured: boolean;
  autoSyncEnabled: boolean;
  isSimulated: boolean;
  lastSyncedAt: string | null;
  connectedByName: string | null;
}

export interface GoogleAdsKpi {
  totalSpend: number;
  attributedRevenue: number;
  roas: number;
  totalClicks: number;
  totalImpressions: number;
  totalConversions: number;
  avgCpc: number;
  ctr: number;
  costPerLead: number;
}

export interface GoogleAdsCampaignItem {
  googleCampaignId: string;
  name: string;
  status: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  cpc: number;
  ctr: number;
  roas: number;
}

export interface GoogleAdsDashboardSummary {
  kpi: GoogleAdsKpi;
  campaigns: GoogleAdsCampaignItem[];
}

export interface Ga4TrafficSummary {
  kpi: {
    totalSessions: number;
    totalUsers: number;
    totalPageviews: number;
    avgBounceRate: number;
  };
  channels: Array<{
    channel: string;
    sessions: number;
    users: number;
    percentage: number;
  }>;
}

export interface OfflineConversionItem {
  id: string;
  gclid: string;
  conversionName: string;
  conversionTime: string;
  conversionValue: number;
  currencyCode: string;
  status: string;
  errorMessage: string | null;
  uploadedAt: string;
  deal?: { id: string; title: string; value: number } | null;
  candidate?: { id: string; firstName: string; lastName: string } | null;
}

// Google Ads endpoints
export function getGoogleAdsStatus(): Promise<GoogleAdsStatus> {
  return apiFetch<GoogleAdsStatus>("/google-ads/status");
}

export function connectGoogleAds(payload: {
  customerAccountId: string;
  managerAccountId?: string;
  developerToken?: string;
  refreshToken?: string;
  conversionActionId?: string;
  isSimulated?: boolean;
}): Promise<GoogleAdsStatus> {
  return apiFetch<GoogleAdsStatus>("/google-ads/connect", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function disconnectGoogleAds(): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>("/google-ads/disconnect", {
    method: "POST",
  });
}

export function syncGoogleAds(): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>("/google-ads/sync", {
    method: "POST",
  });
}

export function getGoogleAdsSummary(): Promise<GoogleAdsDashboardSummary> {
  return apiFetch<GoogleAdsDashboardSummary>("/google-ads/summary");
}

export function getOfflineConversions(): Promise<OfflineConversionItem[]> {
  return apiFetch<OfflineConversionItem[]>("/google-ads/offline-conversions");
}

// GA4 endpoints
export function getGa4Status(): Promise<Ga4Status> {
  return apiFetch<Ga4Status>("/ga4/status");
}

export function connectGa4(payload: {
  propertyId: string;
  serviceAccountKeyJson?: string;
  isSimulated?: boolean;
}): Promise<Ga4Status> {
  return apiFetch<Ga4Status>("/ga4/connect", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function disconnectGa4(): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>("/ga4/disconnect", {
    method: "POST",
  });
}

export function syncGa4(): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>("/ga4/sync", {
    method: "POST",
  });
}

export function getGa4Traffic(): Promise<Ga4TrafficSummary> {
  return apiFetch<Ga4TrafficSummary>("/ga4/traffic");
}
