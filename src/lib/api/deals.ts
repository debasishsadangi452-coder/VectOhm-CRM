import { apiFetch } from "./client";
import type { Deal, DealStage } from "./types";

export interface DealFilters {
  stage?: DealStage;
  ownerId?: string;
  companyId?: string;
  mine?: boolean;
}

export interface CreateDealInput {
  title: string;
  value?: number;
  stage?: DealStage;
  companyId?: string | null;
  contactId?: string | null;
  ownerId?: string;
  notes?: string | null;
  expectedCloseDate?: string | null;
}

export type UpdateDealInput = Partial<CreateDealInput> & {
  position?: number;
  followUpAt?: string | null;
};

function buildQuery(filters: DealFilters): string {
  const params = new URLSearchParams();
  if (filters.stage) params.set("stage", filters.stage);
  if (filters.ownerId) params.set("ownerId", filters.ownerId);
  if (filters.companyId) params.set("companyId", filters.companyId);
  if (filters.mine) params.set("mine", "true");
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function listDeals(filters: DealFilters = {}) {
  return apiFetch<Deal[]>(`/deals${buildQuery(filters)}`);
}

export function getDeal(id: string) {
  return apiFetch<Deal>(`/deals/${id}`);
}

export function listDealFollowUps() {
  return apiFetch<Deal[]>("/deals/follow-ups");
}

export function createDeal(input: CreateDealInput) {
  return apiFetch<Deal>("/deals", { method: "POST", body: JSON.stringify(input) });
}

export function updateDeal(id: string, input: UpdateDealInput) {
  return apiFetch<Deal>(`/deals/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function archiveDeal(id: string) {
  return apiFetch<Deal>(`/deals/${id}`, { method: "DELETE" });
}

export function approveDeal(id: string) {
  return apiFetch<Deal>(`/deals/${id}/approve`, { method: "POST" });
}

export function rejectDeal(id: string) {
  return apiFetch<Deal>(`/deals/${id}/reject`, { method: "POST" });
}
