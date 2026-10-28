import { apiFetch } from "./client";
import type { Project, ProjectDetail, ProjectStatus } from "./types";

export interface ProjectFilters {
  status?: ProjectStatus;
  ownerId?: string;
  departmentId?: string;
}

// githubUrl is intentionally not part of the create/update input -- when
// GitHub is connected the backend creates the repo and owns this field.
export interface CreateProjectInput {
  name: string;
  description?: string | null;
  status?: ProjectStatus;
  startDate?: string | null;
  dueDate?: string | null;
  projectPassword?: string | null;
  departmentId?: string;
  ownerId?: string;
}

export type UpdateProjectInput = Partial<CreateProjectInput> & { ownerId?: string };

function buildQuery(filters: ProjectFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.ownerId) params.set("ownerId", filters.ownerId);
  if (filters.departmentId) params.set("departmentId", filters.departmentId);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function listProjects(filters: ProjectFilters = {}) {
  return apiFetch<Project[]>(`/projects${buildQuery(filters)}`);
}

export function getProject(id: string) {
  return apiFetch<ProjectDetail>(`/projects/${id}`);
}

export function createProject(input: CreateProjectInput) {
  return apiFetch<Project>("/projects", { method: "POST", body: JSON.stringify(input) });
}

export function updateProject(id: string, input: UpdateProjectInput) {
  return apiFetch<Project>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteProject(id: string, permanent = true) {
  const qs = permanent ? "" : "?archiveOnly=true";
  return apiFetch<{ success?: boolean } | Project>(`/projects/${id}${qs}`, { method: "DELETE" });
}

export function archiveProject(id: string) {
  return deleteProject(id, false);
}

export interface AddMemberResult {
  githubInvited: boolean;
  project: ProjectDetail;
}

export function addProjectMember(projectId: string, userId: string) {
  return apiFetch<AddMemberResult>(`/projects/${projectId}/members`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export function removeProjectMember(projectId: string, userId: string) {
  return apiFetch<ProjectDetail>(`/projects/${projectId}/members/${userId}`, { method: "DELETE" });
}
