import { apiFetch } from "./client";
import type { Company, Contact } from "./types";

export interface ApolloConnectionStatus {
  connected: boolean;
  connectedByName: string | null;
  connectedAt: string | null;
}

export function getApolloConnection() {
  return apiFetch<ApolloConnectionStatus>("/apollo/connection");
}

export function connectApollo(apiKey: string) {
  return apiFetch<ApolloConnectionStatus>("/apollo/connection", {
    method: "PUT",
    body: JSON.stringify({ apiKey }),
  });
}

export function disconnectApollo() {
  return apiFetch<{ connected: false }>("/apollo/connection", { method: "DELETE" });
}

export interface ApolloPeopleSearchInput {
  personTitles?: string[];
  organizationDomains?: string[];
  locations?: string[];
  keywords?: string;
  page?: number;
  perPage?: number;
}

export interface ApolloOrganizationSearchInput {
  name?: string;
  locations?: string[];
  keywords?: string;
  page?: number;
  perPage?: number;
}

export interface ApolloPersonPreview {
  apolloId: string;
  firstName: string;
  lastNamePreview: string | null;
  title: string | null;
  organizationName: string | null;
}

export interface ApolloOrganizationPreview {
  apolloId: string | null;
  name: string;
  domain: string | null;
  industry: string | null;
  employeeCount: number | null;
}

export function searchApolloPeople(input: ApolloPeopleSearchInput) {
  return apiFetch<ApolloPersonPreview[]>("/apollo/search/people", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function searchApolloOrganizations(input: ApolloOrganizationSearchInput) {
  return apiFetch<ApolloOrganizationPreview[]>("/apollo/search/organizations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function importApolloPeople(apolloIds: string[]) {
  return apiFetch<Contact[]>("/apollo/import/people", {
    method: "POST",
    body: JSON.stringify({ apolloIds }),
  });
}

export function importApolloOrganizations(domains: string[]) {
  return apiFetch<Company[]>("/apollo/import/organizations", {
    method: "POST",
    body: JSON.stringify({ domains }),
  });
}

export function enrichContactViaApollo(contactId: string) {
  return apiFetch<Contact>(`/apollo/enrich/${contactId}`, { method: "POST" });
}
