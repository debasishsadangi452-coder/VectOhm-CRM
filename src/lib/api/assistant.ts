import { apiFetch } from "./client";

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  tools: string[];
  createdAt: string;
}

export type AssistantActionStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "FAILED";

export interface AssistantAction {
  id: string;
  toolName: string;
  summary: string;
  status: AssistantActionStatus;
  error: string | null;
  createdAt: string;
}

export interface AssistantConversation {
  id: string;
  title: string;
  messages: AssistantMessage[];
  actions: AssistantAction[];
}

export interface AssistantConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface AssistantCapabilities {
  configured: boolean;
  tools: Array<{ name: string; write: boolean }>;
  suggestions: string[];
}

export const getAssistantCapabilities = () => apiFetch<AssistantCapabilities>("/assistant/capabilities");
export const listAssistantConversations = () => apiFetch<AssistantConversationSummary[]>("/assistant/conversations");
export const getAssistantConversation = (id: string) => apiFetch<AssistantConversation>(`/assistant/conversations/${id}`);
export const deleteAssistantConversation = (id: string) => apiFetch<void>(`/assistant/conversations/${id}`, { method: "DELETE" });
export const sendAssistantMessage = (input: { conversationId?: string; message: string }) =>
  apiFetch<AssistantConversation>("/assistant/chat", { method: "POST", body: JSON.stringify(input) });
export const confirmAssistantAction = (id: string) =>
  apiFetch<AssistantConversation>(`/assistant/actions/${id}/confirm`, { method: "POST" });
export const cancelAssistantAction = (id: string) =>
  apiFetch<AssistantConversation>(`/assistant/actions/${id}/cancel`, { method: "POST" });
