import { apiFetch } from "./client";
import type { LeaveRequest, LeaveStatus, LeaveStats, LeaveType } from "./types";

export interface CreateLeaveRequestInput {
  type: LeaveType;
  startDate: string; // ISO 8601 date string
  endDate: string;   // ISO 8601 date string
  reason?: string;
}

export interface UpdateLeaveRequestInput {
  status?: LeaveStatus;
  reviewNote?: string;
}

export function listLeaveRequests(filters?: { userId?: string; status?: LeaveStatus }) {
  const params = new URLSearchParams();
  if (filters?.userId) params.set("userId", filters.userId);
  if (filters?.status) params.set("status", filters.status);
  const qs = params.toString();
  return apiFetch<LeaveRequest[]>(`/leave-requests${qs ? `?${qs}` : ""}`);
}

export function getLeaveRequest(id: string) {
  return apiFetch<LeaveRequest>(`/leave-requests/${id}`);
}

export function createLeaveRequest(input: CreateLeaveRequestInput) {
  return apiFetch<LeaveRequest>("/leave-requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateLeaveRequest(id: string, input: UpdateLeaveRequestInput) {
  return apiFetch<LeaveRequest>(`/leave-requests/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteLeaveRequest(id: string) {
  return apiFetch<LeaveRequest>(`/leave-requests/${id}`, { method: "DELETE" });
}

export function getLeaveStats() {
  return apiFetch<LeaveStats>("/leave-requests/stats");
}
