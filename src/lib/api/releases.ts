import { apiFetch } from "./client";
import type { Release } from "./types";

export interface CreateReleaseInput {
  versionName: string;
  releaseDate?: string;
  departmentId: string;
}

export interface UpdateReleaseInput {
  versionName?: string;
  releaseDate?: string | null;
  status?: "PLANNED" | "RELEASED" | "FAILED";
}

export function listReleases(departmentId?: string) {
  const url = departmentId ? `/releases?departmentId=${departmentId}` : "/releases";
  return apiFetch<Release[]>(url);
}

export function createRelease(input: CreateReleaseInput) {
  return apiFetch<Release>("/releases", { method: "POST", body: JSON.stringify(input) });
}

export function updateRelease(id: string, input: UpdateReleaseInput) {
  return apiFetch<Release>(`/releases/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteRelease(id: string) {
  return apiFetch<Release>(`/releases/${id}`, { method: "DELETE" });
}
