import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  decideAttendanceAdjustment,
  listAttendanceAdjustments,
  listMyAttendanceAdjustments,
  requestAttendanceAdjustment,
} from "@/lib/api/attendance-adjustments";
import { useAuthStore } from "@/stores/auth-store";

const MINE_KEY = ["attendance-adjustments", "mine"] as const;
const ALL_KEY = ["attendance-adjustments", "all"] as const;
const POLL_MS = 15_000;

export function useMyAttendanceAdjustments() {
  const enabled = useAuthStore((s) => s.status === "authenticated" && !!s.accessToken);
  return useQuery({
    queryKey: MINE_KEY,
    queryFn: listMyAttendanceAdjustments,
    enabled,
    refetchInterval: enabled ? POLL_MS : false,
  });
}

export function useRequestAttendanceAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: requestAttendanceAdjustment,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: MINE_KEY });
      toast.success("Request sent. Another admin must approve it before it is added.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not send the request"),
  });
}

// Admin: every request (newest first) -- pending ones to act on, the rest as the log.
export function useAttendanceAdjustments(enabled: boolean) {
  return useQuery({
    queryKey: ALL_KEY,
    queryFn: listAttendanceAdjustments,
    enabled,
    refetchInterval: enabled ? POLL_MS : false,
  });
}

export function useDecideAttendanceAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => decideAttendanceAdjustment(id, approve),
    onSuccess: (_row, vars) => {
      void qc.invalidateQueries({ queryKey: ALL_KEY });
      void qc.invalidateQueries({ queryKey: ["work-sessions"] });
      toast.success(vars.approve ? "Approved. The entry is added and marked as an adjustment." : "Request denied.");
    },
    onError: (err) => {
      void qc.invalidateQueries({ queryKey: ALL_KEY });
      toast.error(err instanceof Error ? err.message : "Could not update the request");
    },
  });
}
