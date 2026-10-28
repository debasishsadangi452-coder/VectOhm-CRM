import { apiFetch } from "./client";
import type { TaskStatus, TaskPriority } from "./types";

export type TaskMessageType =
  | "OVERDUE_MESSAGE"
  | "GENERAL_MESSAGE"
  | "UPDATE_REQUEST"
  | "TASK_UPDATE"
  | "REPLY";

export interface TaskMessageUser {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: {
    name: string;
  };
  department?: {
    id: string;
    name: string;
  } | null;
}

export interface TaskMessage {
  id: string;
  taskId: string;
  senderId: string | null;
  sender: TaskMessageUser | null;
  recipientId: string | null;
  recipient: TaskMessageUser | null;
  message: string;
  messageType: TaskMessageType;
  status: TaskStatus | null;
  progress: number | null;
  workCompleted: string | null;
  currentWork: string | null;
  blockers: string | null;
  expectedCompletion: string | null;
  teamChatMessageId: string | null;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskCommunicationResponse {
  task: {
    id: string;
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate: string | null;
    startDate: string | null;
    assignee: TaskMessageUser | null;
    assignees?: TaskMessageUser[];
    creator: TaskMessageUser | null;
    department: { id: string; name?: string } | null;
    overdueNotifiedAt: string | null;
    lastUpdateRequestAt: string | null;
  };
  messages: TaskMessage[];
}

export interface SendTaskMessageInput {
  message: string;
  messageType?: TaskMessageType;
  recipientId?: string;
}

export interface RequestTaskUpdateInput {
  note?: string;
}

export interface SubmitTaskUpdateInput {
  status?: TaskStatus;
  progress?: number;
  workCompleted?: string;
  currentWork?: string;
  blockers?: string;
  expectedCompletion?: string;
  additionalMessage?: string;
}

export function getTaskMessages(taskId: string): Promise<TaskCommunicationResponse> {
  return apiFetch<TaskCommunicationResponse>(`/tasks/${taskId}/messages`);
}

export function sendTaskMessage(
  taskId: string,
  input: SendTaskMessageInput,
): Promise<TaskMessage> {
  return apiFetch<TaskMessage>(`/tasks/${taskId}/messages`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function requestTaskUpdate(
  taskId: string,
  input: RequestTaskUpdateInput = {},
): Promise<TaskMessage> {
  return apiFetch<TaskMessage>(`/tasks/${taskId}/request-update`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function submitTaskUpdate(
  taskId: string,
  input: SubmitTaskUpdateInput,
): Promise<TaskMessage> {
  return apiFetch<TaskMessage>(`/tasks/${taskId}/submit-update`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
