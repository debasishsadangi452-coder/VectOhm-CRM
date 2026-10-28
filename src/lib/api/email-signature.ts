import { apiFetch, apiUploadForm } from "./client";

export interface SignatureImage {
  id: string;
  originalName: string;
  sizeBytes: number;
  createdAt: string;
  // Absolute, publicly reachable URL -- this is what goes in the <img> tag,
  // because the recipient's mail client loads it with no session.
  url: string;
}

export function getSignature() {
  return apiFetch<{ html: string | null }>("/email-signature");
}

export function saveSignature(html: string | null) {
  return apiFetch<{ html: string | null }>("/email-signature", {
    method: "PUT",
    body: JSON.stringify({ html }),
  });
}

export function listSignatureImages() {
  return apiFetch<SignatureImage[]>("/email-signature/images");
}

export function uploadSignatureImage(file: File) {
  const form = new FormData();
  form.append("file", file, file.name);
  return apiUploadForm<SignatureImage>("/email-signature/images", form);
}

export function deleteSignatureImage(id: string) {
  return apiFetch<void>(`/email-signature/images/${id}`, { method: "DELETE" });
}
