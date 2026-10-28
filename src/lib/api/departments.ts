import { apiFetch } from "./client";
import type { Department, DepartmentDetail } from "./types";

export interface CreateDepartmentInput {
  name: string;
  description?: string | null;
  headId?: string | null;
  monthlyTarget?: number | null;
}

export type UpdateDepartmentInput = Partial<CreateDepartmentInput>;

export function listDepartments() {
  return apiFetch<Department[]>("/departments");
}

export function getDepartment(id: string) {
  return apiFetch<DepartmentDetail>(`/departments/${id}`);
}

export function createDepartment(input: CreateDepartmentInput) {
  return apiFetch<Department>("/departments", { method: "POST", body: JSON.stringify(input) });
}

export function updateDepartment(id: string, input: UpdateDepartmentInput) {
  return apiFetch<Department>(`/departments/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export interface UpdateDepartmentSettingsInput {
  monthlyTarget?: number | null;
  dealApprovalThreshold?: number;
}

export function updateDepartmentSettings(id: string, input: UpdateDepartmentSettingsInput) {
  return apiFetch<Department>(`/departments/${id}/settings`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteDepartment(id: string) {
  return apiFetch<void>(`/departments/${id}`, { method: "DELETE" });
}
