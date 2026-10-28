import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { decideLateStart, getTodayLateStart, listLateStartRequests, requestLateStart } from "@/lib/api/late-start-requests";
import { useAuthStore } from "@/stores/auth-store";

const TODAY_KEY = ["late-start", "today"] as const;
const ALL_KEY = ["late-start", "all"] as const;
const POLL_MS = 15_000;

export function useTodayLateStart(enabled: boolean) {
  const authed = useAuthStore((s) => s.status === "authenticated" && !!s.accessToken);
  return useQuery({
    queryKey: TODAY_KEY,
    queryFn: getTodayLateStart,
    enabled: enabled && authed,
    refetchInterval: enabled && authed ? POLL_MS : false,
  });
}

export function useRequestLateStart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: requestLateStart,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: TODAY_KEY });
      toast.success("Sent to the owner for approval.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not send the request"),
  });
}

export function useLateStartRequests(enabled: boolean) {
  return useQuery({
    queryKey: ALL_KEY,
    queryFn: listLateStartRequests,
    enabled,
    refetchInterval: enabled ? POLL_MS : false,
  });
}

export function useDecideLateStart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => decideLateStart(id, approve),
    onSuccess: (_row, vars) => {
      void qc.invalidateQueries({ queryKey: ALL_KEY });
      toast.success(vars.approve ? "Approved. A late clock-in within that time is excused." : "Request denied.");
    },
    onError: (err) => {
      void qc.invalidateQueries({ queryKey: ALL_KEY });
      toast.error(err instanceof Error ? err.message : "Could not update the request");
    },
  });
}
