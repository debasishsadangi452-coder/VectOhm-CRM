import { apiFetch, apiFetchBlob, apiUploadForm } from "./client";
import type { PersonRef } from "./types";

export interface DealDocument {
  id: string;
  dealId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  note: string | null;
  createdAt: string;
  uploader: PersonRef;
}

export function listDealDocuments(dealId: string) {
  return apiFetch<DealDocument[]>(`/deal-documents?dealId=${encodeURIComponent(dealId)}`);
}

export function uploadDealDocument(dealId: string, file: File, note?: string) {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("dealId", dealId);
  if (note) form.append("note", note);
  return apiUploadForm<DealDocument>("/deal-documents", form);
}

export function deleteDealDocument(id: string) {
  return apiFetch<void>(`/deal-documents/${id}`, { method: "DELETE" });
}

// The endpoint is auth-protected, so the browser can't just follow a link --
// fetch the bytes with the bearer token and hand them to a temporary anchor.
export async function downloadDealDocument(id: string, filename: string) {
  const blob = await apiFetchBlob(`/deal-documents/${id}/download`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
