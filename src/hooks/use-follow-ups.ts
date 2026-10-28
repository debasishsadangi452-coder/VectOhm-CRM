import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listFollowUps,
  generateFollowUpDraft,
  sendFollowUp,
  dismissFollowUp,
} from "@/lib/api/follow-ups";
import type { FollowUpTaskStatus } from "@/lib/api/types";

import { useAuthStore } from "@/stores/auth-store";

export function useFollowUps(status?: FollowUpTaskStatus) {
  const isAuthenticated = useAuthStore((s) => s.status === "authenticated" && !!s.accessToken);
  return useQuery({
    queryKey: ["follow-ups", status],
    queryFn: () => listFollowUps(status),
    enabled: isAuthenticated,
    // Fallback for when the WebSocket is disconnected -- same 15s cadence
    // as useEngagementEvents, faster than the notification bell's 30s since
    // this drives an actionable queue, not just a badge count.
    refetchInterval: isAuthenticated ? 15000 : false,
  });
}

export function useGenerateFollowUpDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => generateFollowUpDraft(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["follow-ups"] }),
  });
}

export function useSendFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, subject, body }: { id: string; subject: string; body: string }) =>
      sendFollowUp(id, subject, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["follow-ups"] }),
  });
}

export function useDismissFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dismissFollowUp(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["follow-ups"] }),
  });
}
