import { apiFetch, apiFetchBlob } from "./client";
import type { PersonRef } from "./types";

export interface LoginPhoto {
  id: string;
  type?: "CLOCK_IN" | "CLOCK_OUT" | "LOGIN" | "LOGOUT" | string;
  capturedAt: string;
  user: PersonRef & { department: { id: string; name: string } | null };
}

export interface LoginPhotoFilters {
  userId?: string;
  type?: string;
  from?: string;
  to?: string;
}

function buildQuery(filters: LoginPhotoFilters): string {
  const params = new URLSearchParams();
  if (filters.userId) params.set("userId", filters.userId);
  if (filters.type) params.set("type", filters.type);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function listLoginPhotos(filters: LoginPhotoFilters = {}) {
  return apiFetch<LoginPhoto[]>(`/login-photos${buildQuery(filters)}`);
}

export function deleteLoginPhoto(id: string) {
  return apiFetch<void>(`/login-photos/${id}`, { method: "DELETE" });
}

// Returns an object URL the caller must revoke (URL.revokeObjectURL) once
// done with it -- see use-login-photos.ts's useLoginPhotoImage.
export async function fetchLoginPhotoImageUrl(id: string): Promise<string> {
  const blob = await apiFetchBlob(`/login-photos/${id}/image`);
  return URL.createObjectURL(blob);
}
