import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  decideSignOutRequest,
  getMySignOutRequest,
  listSignOutRequests,
  requestSignOut,
} from "@/lib/api/signout-requests";
import { useAuthStore } from "@/stores/auth-store";

const MINE_KEY = ["signout-requests", "mine"] as const;
const ALL_KEY = ["signout-requests", "all"] as const;
const POLL_MS = 8_000;

// The signed-in user's open (or just-decided) request. Only people who can't
// sign out on their own ever have one, but asking is harmless for anyone else.
export function useMySignOutRequest() {
  const enabled = useAuthStore((s) => s.status === "authenticated" && !!s.accessToken);
  return useQuery({
    queryKey: MINE_KEY,
    queryFn: async () => {
      const res = await getMySignOutRequest();
      return res ?? null;
    },
    enabled,
    refetchInterval: enabled ? POLL_MS : false,
  });
}

export function useRequestSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) => requestSignOut(reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: MINE_KEY });
      toast.success("Sign-out request sent to an admin. You stay signed in until it is approved.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not send the request"),
  });
}

// Admin: every request (newest first) -- pending ones to act on, the rest as the log.
export function useSignOutRequests(enabled: boolean) {
  return useQuery({
    queryKey: ALL_KEY,
    queryFn: listSignOutRequests,
    enabled,
    refetchInterval: enabled ? POLL_MS : false,
  });
}

export function useDecideSignOutRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => decideSignOutRequest(id, approve),
    onSuccess: (_row, vars) => {
      void qc.invalidateQueries({ queryKey: ALL_KEY });
      toast.success(vars.approve ? "Approved. They are being signed out." : "Request denied.");
    },
    onError: (err) => {
      void qc.invalidateQueries({ queryKey: ALL_KEY });
      toast.error(err instanceof Error ? err.message : "Could not update the request");
    },
  });
}
