import { apiFetch, apiFetchBlob } from "./client";
import type { PersonRef } from "./types";

export interface ScreenCapture {
  id: string;
  capturedAt: string;
  user: PersonRef & { department: { id: string; name: string } | null };
}

export interface ScreenCaptureFilters {
  userId?: string;
  from?: string;
  to?: string;
}

function buildQuery(filters: ScreenCaptureFilters): string {
  const params = new URLSearchParams();
  if (filters.userId) params.set("userId", filters.userId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function listScreenCaptures(filters: ScreenCaptureFilters = {}) {
  return apiFetch<ScreenCapture[]>(`/screen-monitoring/captures${buildQuery(filters)}`);
}

// Returns an object URL the caller must revoke (URL.revokeObjectURL) once
// done with it -- see use-screen-monitoring.ts's useScreenCaptureImage.
export async function fetchScreenCaptureImageUrl(id: string): Promise<string> {
  const blob = await apiFetchBlob(`/screen-monitoring/captures/${id}/image`);
  return URL.createObjectURL(blob);
}
