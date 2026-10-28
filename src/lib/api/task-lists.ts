import { apiFetch } from "./client";
import type { TaskList } from "./types";

export function listTaskLists(projectId: string) {
  return apiFetch<TaskList[]>(`/task-lists?projectId=${encodeURIComponent(projectId)}`);
}

export function createTaskList(projectId: string, name: string) {
  return apiFetch<TaskList>("/task-lists", {
    method: "POST",
    body: JSON.stringify({ projectId, name }),
  });
}

export function updateTaskList(id: string, input: { name?: string; position?: number }) {
  return apiFetch<TaskList>(`/task-lists/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteTaskList(id: string) {
  return apiFetch<void>(`/task-lists/${id}`, { method: "DELETE" });
}
