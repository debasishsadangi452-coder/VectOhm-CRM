import { apiFetch } from "./client";
import type { KBArticle } from "./types";

export interface CreateKBArticleInput {
  title: string;
  content: string;
  category: string;
  departmentId?: string | null;
}

export type UpdateKBArticleInput = Partial<CreateKBArticleInput>;

export function listKBArticles(q?: string, category?: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  const queryStr = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<KBArticle[]>(`/knowledge${queryStr}`);
}

export function getKBArticle(id: string) {
  return apiFetch<KBArticle>(`/knowledge/${id}`);
}

export function createKBArticle(input: CreateKBArticleInput) {
  return apiFetch<KBArticle>("/knowledge", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateKBArticle(id: string, input: UpdateKBArticleInput) {
  return apiFetch<KBArticle>(`/knowledge/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteKBArticle(id: string) {
  return apiFetch<void>(`/knowledge/${id}`, {
    method: "DELETE",
  });
}
