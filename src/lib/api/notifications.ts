import { apiFetch } from "./client";
import type { Notification } from "./types";

export function listNotifications() {
  return apiFetch<Notification[]>("/notifications");
}

export function getUnreadCount() {
  return apiFetch<{ count: number }>("/notifications/unread-count");
}

export function markRead(id: string) {
  return apiFetch<void>(`/notifications/${id}/read`, { method: "PATCH" });
}

export function markAllRead() {
  return apiFetch<void>("/notifications/read-all", { method: "PATCH" });
}

export function markReadByLink(linkPrefix: string) {
  return apiFetch<{ count: number }>("/notifications/read-by-link", {
    method: "PATCH",
    body: JSON.stringify({ linkPrefix }),
  });
}
