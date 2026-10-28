import { apiFetch } from "./client";
import type { EmailSuppression } from "./types";

export function listEmailSuppressions() {
  return apiFetch<EmailSuppression[]>("/email-suppressions");
}

export function addEmailSuppression(email: string) {
  return apiFetch<EmailSuppression>("/email-suppressions", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function removeEmailSuppression(id: string) {
  return apiFetch<{ removed: true }>(`/email-suppressions/${id}`, { method: "DELETE" });
}

// Public -- no auth required, called from the /unsubscribe page a recipient
// lands on after clicking the link in an outreach email.
export function unsubscribeViaToken(email: string, token: string) {
  return apiFetch<{ unsubscribed: true }>(
    `/email-suppressions/unsubscribe?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`,
  );
}
