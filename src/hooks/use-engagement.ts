import { useQuery } from "@tanstack/react-query";
import {
  listEngagementEvents,
  getEngagementMetrics,
  getCampaignMetrics,
  getSequenceMetrics,
  type EngagementEventFilters,
} from "@/lib/api/engagement";
import { useAuthStore } from "@/stores/auth-store";

export function useEngagementEvents(filters: EngagementEventFilters = {}, enabled = true) {
  const isAuthenticated = useAuthStore((s) => s.status === "authenticated" && !!s.accessToken);
  const isQueryEnabled = Boolean(enabled && isAuthenticated);
  return useQuery({
    queryKey: ["engagement-events", filters],
    queryFn: () => listEngagementEvents(filters),
    enabled: isQueryEnabled,
    // Fallback when the WebSocket (use-engagement-socket.ts) is disconnected
    // -- the socket's invalidateQueries calls make this feel instant when
    // connected, this keeps it merely-fresh when not.
    refetchInterval: isQueryEnabled ? 15000 : false,
  });
}

export function useEngagementMetrics(enabled = true) {
  const isAuthenticated = useAuthStore((s) => s.status === "authenticated" && !!s.accessToken);
  const isQueryEnabled = Boolean(enabled && isAuthenticated);
  return useQuery({
    queryKey: ["engagement-metrics"],
    queryFn: getEngagementMetrics,
    enabled: isQueryEnabled,
    refetchInterval: isQueryEnabled ? 15000 : false,
  });
}

export function useCampaignMetrics(campaignId: string | null | undefined, enabled = true) {
  const isAuthenticated = useAuthStore((s) => s.status === "authenticated" && !!s.accessToken);
  const isQueryEnabled = Boolean(enabled && campaignId && isAuthenticated);
  return useQuery({
    queryKey: ["campaign-metrics", campaignId],
    queryFn: () => getCampaignMetrics(campaignId!),
    enabled: isQueryEnabled,
    refetchInterval: isQueryEnabled ? 15000 : false,
  });
}

export function useSequenceMetrics(sequenceId: string | null | undefined, enabled = true) {
  const isAuthenticated = useAuthStore((s) => s.status === "authenticated" && !!s.accessToken);
  const isQueryEnabled = Boolean(enabled && sequenceId && isAuthenticated);
  return useQuery({
    queryKey: ["sequence-metrics", sequenceId],
    queryFn: () => getSequenceMetrics(sequenceId!),
    enabled: isQueryEnabled,
    refetchInterval: isQueryEnabled ? 15000 : false,
  });
}

