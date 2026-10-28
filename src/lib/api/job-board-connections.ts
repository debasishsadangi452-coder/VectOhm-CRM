import { apiFetch } from "./client";
import type { JobBoard } from "./recruitment";

export interface JobBoardConnectionStatus {
  board: JobBoard;
  connected: boolean;
  connectedByName: string | null;
  connectedAt: string | null;
}

export function getJobBoardConnections() {
  return apiFetch<JobBoardConnectionStatus[]>("/job-board-connections");
}

export function connectJobBoard(board: JobBoard, apiKey: string) {
  return apiFetch<JobBoardConnectionStatus>(`/job-board-connections/${board}`, {
    method: "PUT",
    body: JSON.stringify({ apiKey }),
  });
}

export function disconnectJobBoard(board: JobBoard) {
  return apiFetch<{ connected: false }>(`/job-board-connections/${board}`, { method: "DELETE" });
}
