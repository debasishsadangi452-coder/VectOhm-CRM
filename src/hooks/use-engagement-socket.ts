import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/stores/auth-store";
import { NOTIFICATIONS_KEY, UNREAD_COUNT_KEY } from "@/hooks/use-notifications";
import { navigateNotificationLink } from "@/lib/utils";

interface LiveNotification {
  id: string;
  title: string;
  message: string;
  link: string | null;
}

// Mounted once from _app.tsx (see that file's comment on GlobalCallWidget
// for the same "one global mount, not one per page" reasoning) so live
// updates land app-wide, not just while the Engagement Center happens to be
// open. Falls back to nothing special on failure -- the notification bell's
// existing 30s poll (use-notifications.ts) and the Engagement Center's own
// polling (use-engagement.ts) keep working regardless of socket state; this
// hook only ever makes things *faster* when connected, never a hard
// dependency.
import { isTokenExpired } from "@/lib/jwt";

export function useEngagementSocket() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (status !== "authenticated" || !accessToken || isTokenExpired(accessToken, 15)) {
      return;
    }
    const socket = getSocket();
    if (!socket || socket.connected) {
      return;
    }

    let isDisposed = false;

    const onNotification = (notification: LiveNotification) => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
      queryClient.invalidateQueries({ queryKey: ["chat"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["sprints"] });
      toast(notification.title, {
        description: notification.message,
        action: notification.link
          ? {
              label: "Open",
              onClick: () => navigateNotificationLink(navigate, notification.link),
            }
          : undefined,
      });
    };

    const onNotificationsRead = () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
    };

    const onEngagementEvent = () => {
      queryClient.invalidateQueries({ queryKey: ["engagement-events"] });
      queryClient.invalidateQueries({ queryKey: ["engagement-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["follow-ups"] });
    };

    const onConnectError = () => {
      // Graceful fallback -- data continues to be updated via polling.
      // Immediately disconnect to prevent unneeded retries.
      if (!isDisposed) {
        socket.disconnect();
      }
    };

    socket.on("notification", onNotification);
    socket.on("notifications_read", onNotificationsRead);
    socket.on("engagement_event", onEngagementEvent);
    socket.on("connect_error", onConnectError);

    try {
      socket.connect();
    } catch {
      socket.disconnect();
    }

    return () => {
      isDisposed = true;
      socket.off("notification", onNotification);
      socket.off("notifications_read", onNotificationsRead);
      socket.off("engagement_event", onEngagementEvent);
      socket.off("connect_error", onConnectError);
      socket.disconnect();
    };
  }, [status, accessToken, queryClient, navigate]);
}
