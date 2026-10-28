import { apiFetch } from "./client";
import type { ChatChannel, ChatMessage } from "./types";

export interface CreateChannelInput {
  name: string;
  description?: string;
  departmentId?: string;
}

export function listChannels() {
  return apiFetch<ChatChannel[]>("/chat/channels");
}

export function createChannel(input: CreateChannelInput) {
  return apiFetch<ChatChannel>("/chat/channels", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface CreateGroupInput {
  name: string;
  description?: string;
  memberIds: string[];
}

export function createGroup(input: CreateGroupInput) {
  return apiFetch<ChatChannel>("/chat/groups", { method: "POST", body: JSON.stringify(input) });
}

export function updateGroup(groupId: string, input: { name?: string; description?: string }) {
  return apiFetch<ChatChannel>(`/chat/groups/${groupId}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function addGroupMembers(groupId: string, userIds: string[]) {
  return apiFetch<ChatChannel>(`/chat/groups/${groupId}/members`, {
    method: "POST",
    body: JSON.stringify({ userIds }),
  });
}

// Removing yourself is "leave group"; removing someone else needs a group admin.
export function removeGroupMember(groupId: string, userId: string) {
  return apiFetch<{ deleted: boolean }>(`/chat/groups/${groupId}/members/${userId}`, { method: "DELETE" });
}

export function openDM(recipientId: string) {
  return apiFetch<ChatChannel>("/chat/dms", {
    method: "POST",
    body: JSON.stringify({ recipientId }),
  });
}

export function listMessages(channelId: string, q?: string) {
  const query = q ? `?q=${encodeURIComponent(q)}` : "";
  return apiFetch<ChatMessage[]>(`/chat/channels/${channelId}/messages${query}`);
}

export function sendMessage(channelId: string, content: string, mentionIds: string[] = []) {
  return apiFetch<ChatMessage>(`/chat/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content, mentionIds }),
  });
}

export function togglePinMessage(messageId: string) {
  return apiFetch<ChatMessage>(`/chat/messages/${messageId}/pin`, {
    method: "PATCH",
  });
}

export function getUnreadCount() {
  return apiFetch<{ count: number }>("/chat/unread-count");
}

export function markChannelRead(channelId: string) {
  return apiFetch<void>(`/chat/channels/${channelId}/read`, { method: "POST" });
}
