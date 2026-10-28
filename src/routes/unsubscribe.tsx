import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useUnsubscribeViaToken } from "@/hooks/use-email-suppression";
import { ApiError } from "@/lib/api/client";

export const Route = createFileRoute("/unsubscribe")({
  validateSearch: (search: Record<string, unknown>): { email: string; token: string } => ({
    email: typeof search.email === "string" ? search.email : "",
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const { email, token } = Route.useSearch();
  const unsubscribe = useUnsubscribeViaToken();
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current || !email || !token) return;
    attempted.current = true;
    unsubscribe.mutate({ email, token });
  }, [email, token, unsubscribe]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="size-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg shadow-primary/20">
            V
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Email preferences</h1>
        </div>

        <div className="bg-panel border border-border-subtle rounded-xl p-6 text-center space-y-3">
          {!email || !token ? (
            <>
              <XCircle className="size-8 text-destructive mx-auto" />
              <p className="text-sm text-destructive">This unsubscribe link is missing information.</p>
            </>
          ) : unsubscribe.isPending || unsubscribe.isIdle ? (
            <>
              <Loader2 className="size-8 text-text-dim mx-auto animate-spin" />
              <p className="text-sm text-text-dim">Processing your request…</p>
            </>
          ) : unsubscribe.isSuccess ? (
            <>
              <CheckCircle2 className="size-8 text-success mx-auto" />
              <p className="text-sm">
                <span className="font-medium">{email}</span> has been unsubscribed. You won't receive
                any more outreach emails from us.
              </p>
            </>
          ) : (
            <>
              <XCircle className="size-8 text-destructive mx-auto" />
              <p className="text-sm text-destructive">
                {unsubscribe.error instanceof ApiError
                  ? unsubscribe.error.message
                  : "This unsubscribe link is invalid or has expired."}
              </p>
            </>
          )}

          <Link to="/login" className="block text-sm text-primary hover:underline pt-1">
            Go to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
