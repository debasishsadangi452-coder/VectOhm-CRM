import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useMySignOutRequest } from "@/hooks/use-signout-requests";
import { acknowledgeSignOutRequest } from "@/lib/api/signout-requests";
import { useAuthStore } from "@/stores/auth-store";

// Mounted once in the app shell. When an admin decides the signed-in user's
// sign-out request, this acts on it: approved -> leave to the login page at
// once (the server has already ended their sessions); denied -> say so.
export function SignOutRequestWatcher() {
  const { data } = useMySignOutRequest();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!data || data.status === "PENDING" || handled.current === data.id) return;
    handled.current = data.id;
    void (async () => {
      try {
        await acknowledgeSignOutRequest(data.id);
      } catch {
        // still act on the decision
      }
      if (data.status === "APPROVED") {
        useAuthStore.getState().clearAuth();
        toast.success("An admin approved your sign out.");
        window.location.href = "/login";
      } else {
        toast.error("An admin denied your sign-out request.");
      }
    })();
  }, [data]);

  return null;
}
