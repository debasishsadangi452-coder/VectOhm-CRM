import { apiFetch } from "./client";
import type { Epic } from "./types";

export interface CreateEpicInput {
  name: string;
  description?: string;
  departmentId: string;
}

export interface UpdateEpicInput {
  name?: string;
  description?: string;
  status?: "PLANNING" | "IN_PROGRESS" | "COMPLETED";
}

export function listEpics(departmentId?: string) {
  const url = departmentId ? `/epics?departmentId=${departmentId}` : "/epics";
  return apiFetch<Epic[]>(url);
}

export function createEpic(input: CreateEpicInput) {
  return apiFetch<Epic>("/epics", { method: "POST", body: JSON.stringify(input) });
}

export function updateEpic(id: string, input: UpdateEpicInput) {
  return apiFetch<Epic>(`/epics/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteEpic(id: string) {
  return apiFetch<Epic>(`/epics/${id}`, { method: "DELETE" });
}
