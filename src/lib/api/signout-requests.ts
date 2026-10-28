import { apiFetch } from "./client";

export type SignOutRequestStatus = "PENDING" | "APPROVED" | "DENIED";

export interface SignOutRequest {
  id: string;
  userId: string;
  status: SignOutRequestStatus;
  reason: string | null;
  createdAt: string;
  decidedAt: string | null;
  ackedAt: string | null;
}

export interface SignOutRequestRow extends SignOutRequest {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    department: { id: string; name: string } | null;
  };
  decidedBy: { id: string; firstName: string; lastName: string } | null;
}

export function requestSignOut(reason?: string) {
  return apiFetch<SignOutRequest>("/signout-requests", {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function getMySignOutRequest() {
  return apiFetch<SignOutRequest | null>("/signout-requests/mine");
}

export function acknowledgeSignOutRequest(id: string) {
  return apiFetch<{ acknowledged: boolean }>(`/signout-requests/${id}/ack`, { method: "POST" });
}

export function listSignOutRequests() {
  return apiFetch<SignOutRequestRow[]>("/signout-requests");
}

export function decideSignOutRequest(id: string, approve: boolean) {
  return apiFetch<SignOutRequestRow>(`/signout-requests/${id}/${approve ? "approve" : "deny"}`, {
    method: "POST",
  });
}
