import { apiFetch } from "./client";
import type { Bug, BugStatus, BugSeverity, BugPriority } from "./types";

export interface CreateBugInput {
  title: string;
  description?: string;
  taskId: string;
  subtaskId?: string;
  assigneeId?: string;
  severity?: BugSeverity;
  priority?: BugPriority;
  status?: BugStatus;
  attachments?: string[];
}

export interface UpdateBugInput {
  title?: string;
  description?: string | null;
  assigneeId?: string | null;
  severity?: BugSeverity;
  priority?: BugPriority;
  status?: BugStatus;
  attachments?: string[];
}

export interface SubmitBugFixInput {
  fixSummary: string;
  rootCause?: string;
  testingNotes?: string;
  prLink?: string;
  fixAttachmentUrl?: string;
}

export type BugReviewDecision = "APPROVE" | "REJECT" | "REQUEST_CHANGES";

export interface ReviewBugFixInput {
  decision: BugReviewDecision;
  managerComments?: string;
}

export interface BugFilters {
  taskId?: string;
  projectId?: string;
  assigneeId?: string;
  status?: BugStatus;
}

export async function listBugs(filters: BugFilters = {}): Promise<Bug[]> {
  const params = new URLSearchParams();
  if (filters.taskId) params.set("taskId", filters.taskId);
  if (filters.projectId) params.set("projectId", filters.projectId);
  if (filters.assigneeId) params.set("assigneeId", filters.assigneeId);
  if (filters.status) params.set("status", filters.status);
  const query = params.toString();
  return apiFetch<Bug[]>(`/bugs${query ? `?${query}` : ""}`);
}

export async function getBug(id: string): Promise<Bug> {
  return apiFetch<Bug>(`/bugs/${id}`);
}

export async function createBug(input: CreateBugInput): Promise<Bug> {
  return apiFetch<Bug>("/bugs", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateBug(id: string, input: UpdateBugInput): Promise<Bug> {
  return apiFetch<Bug>(`/bugs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function submitBugFix(id: string, input: SubmitBugFixInput): Promise<Bug> {
  return apiFetch<Bug>(`/bugs/${id}/submit-fix`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function reviewBugFix(id: string, input: ReviewBugFixInput): Promise<Bug> {
  return apiFetch<Bug>(`/bugs/${id}/review-fix`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function addBugComment(id: string, content: string) {
  return apiFetch<{
    id: string;
    bugId: string;
    userId: string;
    content: string;
    createdAt: string;
  }>(`/bugs/${id}/comments`, { method: "POST", body: JSON.stringify({ content }) });
}

export async function deleteBug(id: string): Promise<void> {
  return apiFetch<void>(`/bugs/${id}`, { method: "DELETE" });
}
