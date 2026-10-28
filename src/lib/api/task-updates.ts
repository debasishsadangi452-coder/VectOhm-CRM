import { apiFetch } from "./client";
import type { DepartmentTaskUpdate, ProjectTaskUpdate, SprintTaskUpdate, TaskUpdate } from "./types";

export interface CreateTaskUpdateInput {
  taskId: string;
  content: string;
}

export function listTaskUpdates(taskId: string) {
  return apiFetch<TaskUpdate[]>(`/task-updates?taskId=${encodeURIComponent(taskId)}`);
}

export function listSprintTaskUpdates(sprintId: string) {
  return apiFetch<SprintTaskUpdate[]>(
    `/task-updates/for-sprint?sprintId=${encodeURIComponent(sprintId)}`,
  );
}

export function listDepartmentTaskUpdates() {
  return apiFetch<DepartmentTaskUpdate[]>("/task-updates/for-department");
}

export function listProjectTaskUpdates(projectId: string) {
  return apiFetch<ProjectTaskUpdate[]>(`/task-updates/for-project?projectId=${encodeURIComponent(projectId)}`);
}

export function createTaskUpdate(input: CreateTaskUpdateInput) {
  return apiFetch<TaskUpdate>("/task-updates", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteTaskUpdate(id: string) {
  return apiFetch<TaskUpdate>(`/task-updates/${id}`, { method: "DELETE" });
}
