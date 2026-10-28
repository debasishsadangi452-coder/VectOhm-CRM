import { apiFetch } from "./client";

export type AttendanceAdjustmentStatus = "PENDING" | "APPROVED" | "DENIED";

export interface AttendanceAdjustment {
  id: string;
  userId: string;
  forDate: string;
  reason: string;
  status: AttendanceAdjustmentStatus;
  createdAt: string;
  decidedAt: string | null;
}

export interface AttendanceAdjustmentRow extends AttendanceAdjustment {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    department: { id: string; name: string } | null;
  };
  decidedBy: { id: string; firstName: string; lastName: string } | null;
}

export function requestAttendanceAdjustment(input: { forDate: string; reason: string }) {
  return apiFetch<AttendanceAdjustment>("/attendance-adjustments", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listMyAttendanceAdjustments() {
  return apiFetch<AttendanceAdjustment[]>("/attendance-adjustments/mine");
}

export function listAttendanceAdjustments() {
  return apiFetch<AttendanceAdjustmentRow[]>("/attendance-adjustments");
}

export function decideAttendanceAdjustment(id: string, approve: boolean) {
  return apiFetch<AttendanceAdjustmentRow>(`/attendance-adjustments/${id}/${approve ? "approve" : "deny"}`, {
    method: "POST",
  });
}
