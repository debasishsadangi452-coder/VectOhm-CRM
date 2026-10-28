import { apiFetch } from "./client";

export type GithubAccountType = "USER" | "ORG";

export interface GithubConnectionStatus {
  connected: boolean;
  accountType: GithubAccountType | null;
  accountLogin: string | null;
  connectedByEmail: string | null;
}

export interface ConnectGithubInput {
  accountType: GithubAccountType;
  accountLogin: string;
  token: string;
}

export function getGithubConnection() {
  return apiFetch<GithubConnectionStatus>("/github/connection");
}

export function connectGithub(input: ConnectGithubInput) {
  return apiFetch<GithubConnectionStatus>("/github/connection", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function testGithubConnection() {
  return apiFetch<{ ok: true; accountLogin: string }>("/github/connection/test", { method: "POST" });
}

export function disconnectGithub() {
  return apiFetch<{ connected: false }>("/github/connection", { method: "DELETE" });
}
