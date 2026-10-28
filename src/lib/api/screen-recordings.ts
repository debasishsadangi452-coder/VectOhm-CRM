import { apiFetch, apiFetchBlob } from "./client";
import type { PersonRef } from "./types";

export interface ScreenRecording {
  id: string;
  startedAt: string;
  durationSec: number;
  sizeBytes: number;
  // Set when the agent (0.7.5+) sent a snapshot with the clip.
  thumbnailPath?: string | null;
  storageProvider?: string;
  bunnyPath?: string | null;
  user: PersonRef & { department: { id: string; name: string } | null };
}

export interface ScreenRecordingFilters {
  userId?: string;
  from?: string;
  to?: string;
}

function buildQuery(filters: ScreenRecordingFilters): string {
  const params = new URLSearchParams();
  if (filters.userId) params.set("userId", filters.userId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function listScreenRecordings(filters: ScreenRecordingFilters = {}) {
  return apiFetch<ScreenRecording[]>(`/screen-recordings${buildQuery(filters)}`);
}

export function deleteScreenRecording(id: string) {
  return apiFetch<void>(`/screen-recordings/${id}`, { method: "DELETE" });
}

// Returns an object URL the caller must revoke once done with it.
export async function fetchScreenRecordingThumbnailUrl(id: string): Promise<string> {
  return URL.createObjectURL(await apiFetchBlob(`/screen-recordings/${id}/thumbnail`));
}

// e.g. jane_doe_2026-10-21_11-57-00.webm
export function recordingFilename(recording: ScreenRecording): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const d = new Date(recording.startedAt);
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  return `${recording.user.firstName}_${recording.user.lastName}_${dateStr}.webm`
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_");
}

// The endpoint is auth-protected, so the browser fetches the bytes with the
// bearer token and hands them to a temporary download anchor.
export async function downloadScreenRecording(id: string, filename: string) {
  const blob = await apiFetchBlob(`/screen-recordings/${id}/download`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".webm") ? filename : `${filename}.webm`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
