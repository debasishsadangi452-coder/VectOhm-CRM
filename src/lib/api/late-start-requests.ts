import { apiFetch } from "./client";

export type LateStartStatus = "PENDING" | "APPROVED" | "DENIED";

export interface LateStartRequest {
  id: string;
  userId: string;
  forDay: string;
  expectedLateMin: number;
  status: LateStartStatus;
  createdAt: string;
  decidedAt: string | null;
}

export interface LateStartRequestRow extends LateStartRequest {
  user: { id: string; firstName: string; lastName: string; email: string; department: { id: string; name: string } | null };
  decidedBy: { id: string; firstName: string; lastName: string } | null;
}

export function requestLateStart(expectedLateMin: number) {
  return apiFetch<LateStartRequest>("/late-start-requests", {
    method: "POST",
    body: JSON.stringify({ expectedLateMin }),
  });
}

export async function getTodayLateStart() {
  return (await apiFetch<LateStartRequest | null>("/late-start-requests/today")) ?? null;
}

export function listLateStartRequests() {
  return apiFetch<LateStartRequestRow[]>("/late-start-requests");
}

export function decideLateStart(id: string, approve: boolean) {
  return apiFetch<LateStartRequestRow>(`/late-start-requests/${id}/${approve ? "approve" : "deny"}`, { method: "POST" });
}
