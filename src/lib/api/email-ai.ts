import { apiFetch } from "./client";

export type RewriteInstruction = "SHORTER" | "LONGER" | "FRIENDLIER" | "FORMAL" | "FIX" | "TRANSLATE" | "CUSTOM";

export interface GenerateTemplateInput {
  goal: string;
  tone?: string;
  audience?: string;
  language?: string;
  length?: "short" | "medium" | "long";
}

export interface RewriteInput {
  subject?: string;
  body: string;
  instruction: RewriteInstruction;
  language?: string;
  custom?: string;
}

export interface PersonalizePreviewInput {
  subject: string;
  body: string;
  recipient: { firstName?: string; lastName?: string; title?: string; companyName?: string; email?: string };
  instructions?: string;
}

export function getEmailAiStatus() {
  return apiFetch<{ configured: boolean; provider: string }>("/email-ai/status");
}

export function generateEmailTemplate(input: GenerateTemplateInput) {
  return apiFetch<{ name: string; subject: string; body: string }>("/email-ai/template", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function rewriteEmail(input: RewriteInput) {
  return apiFetch<{ subject?: string; body: string }>("/email-ai/rewrite", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function suggestSubjects(input: { subject?: string; body: string; tone?: string; count?: number }) {
  return apiFetch<{ subjects: string[] }>("/email-ai/subjects", { method: "POST", body: JSON.stringify(input) });
}

export function previewPersonalized(input: PersonalizePreviewInput) {
  return apiFetch<{ subject: string; body: string }>("/email-ai/personalize-preview", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
