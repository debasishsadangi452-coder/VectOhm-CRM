import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  markReadByLink,
} from "@/lib/api/notifications";

import { useAuthStore } from "@/stores/auth-store";

export const NOTIFICATIONS_KEY = ["notifications"] as const;
export const UNREAD_COUNT_KEY = ["notifications", "unread-count"] as const;

export function useNotifications() {
  const isAuthenticated = useAuthStore((s) => s.status === "authenticated" && !!s.accessToken);
  return useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: listNotifications,
    enabled: isAuthenticated,
    refetchInterval: isAuthenticated ? 10000 : false, // Poll every 10 seconds
  });
}

export function useUnreadNotificationsCount() {
  const isAuthenticated = useAuthStore((s) => s.status === "authenticated" && !!s.accessToken);
  return useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: getUnreadCount,
    enabled: isAuthenticated,
    refetchInterval: isAuthenticated ? 10000 : false,
  });
}

import type { Notification } from "@/lib/api/types";

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markRead,
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
      await qc.cancelQueries({ queryKey: UNREAD_COUNT_KEY });
      qc.setQueryData<Notification[]>(NOTIFICATIONS_KEY, (old) =>
        old ? old.map((n) => (n.id === id ? { ...n, isRead: true } : n)) : [],
      );
      qc.setQueryData<{ count: number }>(UNREAD_COUNT_KEY, (old) => ({
        count: Math.max(0, (old?.count ?? 1) - 1),
      }));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      qc.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markAllRead,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
      await qc.cancelQueries({ queryKey: UNREAD_COUNT_KEY });
      qc.setQueryData<{ count: number }>(UNREAD_COUNT_KEY, { count: 0 });
      qc.setQueryData<Notification[]>(NOTIFICATIONS_KEY, (old) =>
        old ? old.map((n) => ({ ...n, isRead: true })) : [],
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      qc.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
    },
  });
}

export function useMarkNotificationsByLinkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markReadByLink,
    onMutate: async (linkPrefix: string) => {
      await qc.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
      await qc.cancelQueries({ queryKey: UNREAD_COUNT_KEY });

      let clearedCount = 0;
      qc.setQueryData<Notification[]>(NOTIFICATIONS_KEY, (old) => {
        if (!old) return [];
        return old.map((n) => {
          if (!n.isRead && n.link && (n.link === linkPrefix || n.link.startsWith(linkPrefix) || linkPrefix.startsWith(n.link))) {
            clearedCount++;
            return { ...n, isRead: true };
          }
          return n;
        });
      });

      if (clearedCount > 0) {
        qc.setQueryData<{ count: number }>(UNREAD_COUNT_KEY, (old) => ({
          count: Math.max(0, (old?.count ?? clearedCount) - clearedCount),
        }));
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      qc.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
    },
  });
}
