import { apiFetch } from "./client";
import type { GitCommit, TaskStatus } from "./types";

export interface CreateCommitInput {
  message: string;
  branch?: string;
  authorId: string;
  taskId?: string;
  moveTaskTo?: TaskStatus;
  isPR?: boolean;
}

export function listCommits() {
  return apiFetch<GitCommit[]>("/commits");
}

export function createCommit(input: CreateCommitInput) {
  return apiFetch<GitCommit>("/commits", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function mergePR(id: string) {
  return apiFetch<GitCommit>(`/commits/${id}/merge`, {
    method: "PATCH",
  });
}

export function declinePR(id: string) {
  return apiFetch<GitCommit>(`/commits/${id}/decline`, {
    method: "PATCH",
  });
}
