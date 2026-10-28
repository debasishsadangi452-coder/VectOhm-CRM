import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listGrowthSignals,
  acceptGrowthSignal,
  dismissGrowthSignal,
  listNewsLog,
  scanNewsNow,
  scanApolloNow,
  type GrowthSignalFilters,
} from "@/lib/api/company-growth";

const GROWTH_SIGNALS_KEY = ["company-growth-signals"] as const;
const NEWS_LOG_KEY = ["company-growth-signals", "news-log"] as const;

export function useGrowthSignals(filters: GrowthSignalFilters = {}) {
  return useQuery({
    queryKey: [...GROWTH_SIGNALS_KEY, filters],
    queryFn: () => listGrowthSignals(filters),
  });
}

function useInvalidateGrowthSignals() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: GROWTH_SIGNALS_KEY });
}

export function useAcceptGrowthSignal() {
  const invalidate = useInvalidateGrowthSignals();
  return useMutation({
    mutationFn: ({ id, sequenceId }: { id: string; sequenceId: string }) => acceptGrowthSignal(id, sequenceId),
    onSuccess: () => invalidate(),
  });
}

export function useDismissGrowthSignal() {
  const invalidate = useInvalidateGrowthSignals();
  return useMutation({
    mutationFn: (id: string) => dismissGrowthSignal(id),
    onSuccess: () => invalidate(),
  });
}

export function useNewsLog() {
  return useQuery({ queryKey: NEWS_LOG_KEY, queryFn: () => listNewsLog() });
}

export function useScanNewsNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: scanNewsNow,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: GROWTH_SIGNALS_KEY });
      qc.invalidateQueries({ queryKey: NEWS_LOG_KEY });
    },
  });
}

export function useScanApolloNow() {
  const invalidate = useInvalidateGrowthSignals();
  return useMutation({
    mutationFn: scanApolloNow,
    onSuccess: () => invalidate(),
  });
}
