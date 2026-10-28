import { apiFetch } from "./client";

export type LinkedInConnectionStatus =
  | "CONNECTED"
  | "DISCONNECTED"
  | "CHECKPOINT_REQUIRED"
  | "RATE_LIMITED"
  | "EXPIRED";

export interface LinkedInConnectionDetails {
  id: string;
  accountEmail: string;
  accountName: string | null;
  profileUrl: string | null;
  profilePicUrl: string | null;
  profileUrn: string | null;
  dailyInviteLimit: number;
  dailyMessageLimit: number;
  invitesSentToday: number;
  messagesSentToday: number;
  remainingInvitesToday: number;
  remainingMessagesToday: number;
  lastSyncAt: string | null;
  createdAt: string;
}

export interface LinkedInStatusResponse {
  connected: boolean;
  status: LinkedInConnectionStatus;
  connection: LinkedInConnectionDetails | null;
}

export interface ConnectLinkedInInput {
  accountEmail: string;
  accountName?: string;
  profileUrl?: string;
  profilePicUrl?: string;
  profileUrn?: string;
  accessToken?: string;
  dailyInviteLimit?: number;
  dailyMessageLimit?: number;
}

export interface UpdateLinkedInLimitsInput {
  dailyInviteLimit?: number;
  dailyMessageLimit?: number;
}

export interface SendLinkedInInviteInput {
  targetUrl: string;
  message?: string;
  leadId?: string;
  candidateId?: string;
  contactId?: string;
}

export interface SendLinkedInInviteResponse {
  success: boolean;
  message: string;
  actionId?: string;
  invitesSentToday?: number;
  remainingInvites?: number;
}

export interface SendLinkedInMessageInput {
  targetUrl: string;
  message: string;
  leadId?: string;
  candidateId?: string;
  contactId?: string;
}

export interface SendLinkedInMessageResponse {
  success: boolean;
  message: string;
  chatId?: string;
  actionId?: string;
  messagesSentToday?: number;
  remainingMessages?: number;
}

export interface LinkedInActionItem {
  id: string;
  connectionId: string;
  actionType: "CONNECTION_REQUEST" | "DIRECT_MESSAGE" | "PROFILE_VIEW" | "INMAIL";
  status: "PENDING" | "QUEUED" | "SENT" | "FAILED" | "ACCEPTED" | "REPLIED";
  targetUrl: string;
  messageBody?: string | null;
  errorMessage?: string | null;
  executedAt?: string | null;
  createdAt: string;
}

export function getLinkedInConnectionStatus() {
  return apiFetch<LinkedInStatusResponse>("/linkedin-connection/me");
}

export function connectLinkedIn(input: ConnectLinkedInInput) {
  return apiFetch<LinkedInStatusResponse>("/linkedin-connection/connect", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function testLinkedInConnection() {
  return apiFetch<{ success: boolean; message: string; connected: boolean; status: LinkedInConnectionStatus }>(
    "/linkedin-connection/test",
    { method: "POST" },
  );
}

export function disconnectLinkedIn() {
  return apiFetch<{ success: boolean; message: string }>("/linkedin-connection/disconnect", {
    method: "DELETE",
  });
}

export function updateLinkedInLimits(input: UpdateLinkedInLimitsInput) {
  return apiFetch<LinkedInStatusResponse>("/linkedin-connection/limits", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function sendLinkedInInvite(input: SendLinkedInInviteInput) {
  return apiFetch<SendLinkedInInviteResponse>("/linkedin-connection/invite", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function sendLinkedInMessage(input: SendLinkedInMessageInput) {
  return apiFetch<SendLinkedInMessageResponse>("/linkedin-connection/message", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getLinkedInRecentActions(limit = 20) {
  return apiFetch<LinkedInActionItem[]>(`/linkedin-connection/actions?limit=${limit}`);
}

export function getLinkedInChats(limit = 20) {
  return apiFetch<any[]>(`/linkedin-connection/chats?limit=${limit}`);
}
