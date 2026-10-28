import { apiFetch } from "./client";
import type { Task, TaskPriority, TaskStatus } from "./types";

export interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string;
  assigneeId?: string;
  mine?: boolean;
  departmentId?: string;
  taskListId?: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string | null;
  assigneeId?: string | null;
  assigneeIds?: string[];
  testerId?: string | null;
  testingNotes?: string | null;
  testingApproved?: boolean;
  dueDate?: string | null;
  departmentId?: string | null;
  storyPoints?: number | null;
  type?: string;
  sprintId?: string | null;
  parentId?: string | null;
  taskListId?: string | null;
  startDate?: string | null;
  tags?: string[];
}

export type UpdateTaskInput = Partial<CreateTaskInput> & { position?: number };

function buildQuery(filters: TaskFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.projectId) params.set("projectId", filters.projectId);
  if (filters.assigneeId) params.set("assigneeId", filters.assigneeId);
  if (filters.departmentId) params.set("departmentId", filters.departmentId);
  if (filters.taskListId) params.set("taskListId", filters.taskListId);
  if (filters.mine) params.set("mine", "true");
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function listTasks(filters: TaskFilters = {}) {
  return apiFetch<Task[]>(`/tasks${buildQuery(filters)}`);
}

export function getTask(id: string) {
  return apiFetch<Task>(`/tasks/${id}`);
}

export function createTask(input: CreateTaskInput) {
  return apiFetch<Task>("/tasks", { method: "POST", body: JSON.stringify(input) });
}

export function updateTask(id: string, input: UpdateTaskInput) {
  return apiFetch<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteTask(id: string) {
  return apiFetch<void>(`/tasks/${id}`, { method: "DELETE" });
}
