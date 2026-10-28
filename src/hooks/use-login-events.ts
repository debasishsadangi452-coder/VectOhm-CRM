import { useQuery } from "@tanstack/react-query";
import { listLastLogins, listLoginEvents } from "@/lib/api/login-events";

// Gated server-side to Admin + HR. `enabled` lets callers avoid firing the
// request for users who can't see the log.
export function useLoginEvents(
  params: { userId?: string; limit?: number } = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ["login-events", params.userId ?? null, params.limit ?? null],
    queryFn: () => listLoginEvents(params),
    enabled: options.enabled ?? true,
  });
}

export function useLastLogins(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["login-events", "last-logins"],
    queryFn: listLastLogins,
    enabled: options.enabled ?? true,
  });
}
