import { useQuery } from "@tanstack/react-query";
import {
  getActivitySummary,
  getActivityDaily,
  getActivityTimeline,
  type ActivitySummaryFilters,
} from "@/lib/api/activity-monitoring";

export function useActivitySummary(filters: ActivitySummaryFilters = {}) {
  return useQuery({
    queryKey: ["activity-summary", filters],
    queryFn: () => getActivitySummary(filters),
    // The page is often left open during the day; keep the numbers current.
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useActivityTimeline(
  userId: string,
  from: string,
  to: string,
  refetchInterval: number | false = false,
) {
  return useQuery({
    queryKey: ["activity-timeline", userId, from, to],
    queryFn: () => getActivityTimeline(userId, from, to),
    enabled: !!userId,
    refetchInterval,
  });
}

export function useActivityDaily(userId: string, from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: ["activity-daily", userId, from, to],
    queryFn: () => getActivityDaily(userId, from, to),
    enabled: enabled && !!userId,
  });
}
