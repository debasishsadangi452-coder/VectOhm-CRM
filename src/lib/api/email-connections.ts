import { apiFetch } from "./client";
import type { EmailConnectionStatus, NetworkDiagnosticResult } from "./types";

export interface ConnectEmailInput {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  // Optional on update -- omitting it keeps the password already on file
  // (see EmailConnectionsService.connect on the backend).
  smtpPassword?: string;
  fromName?: string;
  fromEmail: string;
  connectionId?: string;
  label?: string;
  setAsDefault?: boolean;
}

export interface OAuthProviderAvailability {
  google: boolean;
  microsoft: boolean;
  zoho: boolean;
}

export function getEmailConnectionStatus() {
  return apiFetch<EmailConnectionStatus>("/email-connections/me");
}

// Whether GOOGLE_CLIENT_ID/SECRET etc. are actually configured server-side --
// checked so "Connect with Google/Outlook" can show as disabled with an
// explanation instead of round-tripping to a 503.
export function getOAuthProviderAvailability() {
  return apiFetch<OAuthProviderAvailability>("/email-oauth/providers");
}

// Both return the consent-screen URL to navigate the browser to (a plain
// top-level redirect, not something the frontend can complete via fetch).
export function getGoogleAuthorizeUrl() {
  return apiFetch<{ url: string }>("/email-oauth/google/authorize");
}

export function getMicrosoftAuthorizeUrl() {
  return apiFetch<{ url: string }>("/email-oauth/microsoft/authorize");
}

// Zoho sends through its web API (HTTPS), so it works on hosts that block SMTP.
export function getZohoAuthorizeUrl() {
  return apiFetch<{ url: string }>("/email-oauth/zoho/authorize");
}

export function connectEmail(input: ConnectEmailInput) {
  return apiFetch<EmailConnectionStatus>("/email-connections", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function setDefaultEmailConnection(connectionId: string) {
  return apiFetch<EmailConnectionStatus>("/email-connections/set-default", {
    method: "POST",
    body: JSON.stringify({ connectionId }),
  });
}

export function testEmailConnection(connectionId?: string) {
  return apiFetch<EmailConnectionStatus>("/email-connections/test", {
    method: "POST",
    body: connectionId ? JSON.stringify({ connectionId }) : undefined,
  });
}

export function disconnectEmail(connectionId?: string) {
  if (connectionId) {
    return apiFetch<void>(`/email-connections/${connectionId}`, { method: "DELETE" });
  }
  return apiFetch<void>("/email-connections", { method: "DELETE" });
}

// Raw TCP reachability to a fixed set of known mail providers from the
// server itself -- lets a "connection timeout" be diagnosed as a
// network-level block (this server can't reach the host at all) vs an
// account-level one (host is reachable, so it's credentials/provider-side).
export function getNetworkDiagnostic() {
  return apiFetch<NetworkDiagnosticResult[]>("/email-connections/network-diagnostic");
}
