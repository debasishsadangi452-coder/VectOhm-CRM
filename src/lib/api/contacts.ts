import { apiFetch } from "./client";
import type { Contact, ContactImportBatch } from "./types";

export interface ContactFilters {
  companyId?: string;
}

export interface CreateContactInput {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  companyId?: string | null;
  location?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
  category?: string | null;
  priority?: string | null;
  notes?: string | null;
}

export type UpdateContactInput = Partial<CreateContactInput>;

function buildQuery(filters: ContactFilters): string {
  const params = new URLSearchParams();
  if (filters.companyId) params.set("companyId", filters.companyId);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function listContacts(filters: ContactFilters = {}) {
  return apiFetch<Contact[]>(`/contacts${buildQuery(filters)}`);
}

export function getContact(id: string) {
  return apiFetch<Contact>(`/contacts/${id}`);
}

export function createContact(input: CreateContactInput) {
  return apiFetch<Contact>("/contacts", { method: "POST", body: JSON.stringify(input) });
}

export function updateContact(id: string, input: UpdateContactInput) {
  return apiFetch<Contact>(`/contacts/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteContact(id: string) {
  return apiFetch<void>(`/contacts/${id}`, { method: "DELETE" });
}

export interface ImportContactRow {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  title?: string;
  companyName?: string;
  linkedinUrl?: string;
  notes?: string;
  location?: string;
  website?: string;
  category?: string;
  priority?: string;
}

export function importContacts(fileName: string, rows: ImportContactRow[]) {
  return apiFetch<ContactImportBatch>("/contacts/import", {
    method: "POST",
    body: JSON.stringify({ fileName, rows }),
  });
}

export function listContactImportBatches() {
  return apiFetch<ContactImportBatch[]>("/contacts/import/batches");
}
