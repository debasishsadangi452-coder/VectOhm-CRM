import { apiFetch } from "./client";
import type { Company, CompanyDetail } from "./types";

export interface CreateCompanyInput {
  name: string;
  domain?: string | null;
  industry?: string | null;
  notes?: string | null;
}

export type UpdateCompanyInput = Partial<CreateCompanyInput>;

export function listCompanies() {
  return apiFetch<Company[]>("/companies");
}

export function getCompany(id: string) {
  return apiFetch<CompanyDetail>(`/companies/${id}`);
}

export function createCompany(input: CreateCompanyInput) {
  return apiFetch<Company>("/companies", { method: "POST", body: JSON.stringify(input) });
}

export function updateCompany(id: string, input: UpdateCompanyInput) {
  return apiFetch<Company>(`/companies/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteCompany(id: string) {
  return apiFetch<void>(`/companies/${id}`, { method: "DELETE" });
}
