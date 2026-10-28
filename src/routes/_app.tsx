import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { TopBar } from "@/components/topbar";
import { CommandPalette } from "@/components/command-palette";
import { GlobalDialogs } from "@/components/global-dialogs";
import { WorkAccountabilityPrompts } from "@/components/work-accountability-prompts";
import { GlobalCallWidget } from "@/components/telephony/global-call-widget";
import { SignOutRequestWatcher } from "@/components/sign-out-request-watcher";
import { useEngagementSocket } from "@/hooks/use-engagement-socket";
import { useNotificationSound } from "@/hooks/use-notification-sound";
import { useAuthStore } from "@/stores/auth-store";
import { me, refresh as refreshAuth } from "@/lib/api/auth";
import { canAccessModule, moduleForPath } from "@/lib/modules";
import { toast } from "sonner";
import { ApiError, isApiError } from "@/lib/api/client";

import { isTokenExpired } from "@/lib/jwt";
import { tryRefresh } from "@/lib/api/client";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

// A momentary refresh failure (a deploy blip, a dropped connection) gets one
// retry before giving up -- see the comment on the "transient" branch below
// for why giving up still means rendering the app, not signing out.
const TRANSIENT_RETRY_DELAY_MS = 2_000;

function AppLayout() {
  const navigate = useNavigate();
  const [isMounted, setIsMounted] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Set once a refresh attempt gives up after only transient failures (never
  // a real 401) -- lets the render gate below stop waiting on a token that
  // may just be stale-but-still-valid, instead of spinning forever. Any
  // subsequent real API call still gets its own proactive-refresh attempt
  // via apiFetch, so this isn't a dead end -- just not blocking on it here.
  const [gaveUpTransiently, setGaveUpTransiently] = useState(false);
  const status = useAuthStore((s) => s.status);
  const accessToken = useAuthStore((s) => s.accessToken);
  useEngagementSocket();
  useNotificationSound();

  // Pick up changes an Admin makes to this person's modules (or role/department) without a re-login.
  useEffect(() => {
    if (status !== "authenticated") return;
    let stopped = false;
    const sync = () =>
      me()
        .then((u) => {
          if (stopped) return;
          useAuthStore.getState().patchUser({
            role: u.role,
            department: u.department,
            canSignOut: u.canSignOut,
            modulesCustomized: u.modulesCustomized,
            modules: u.modules,
          });
        })
        .catch(() => undefined); // a failed check just keeps what we have
    const id = window.setInterval(sync, 120_000);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [status]);

  // Pages outside someone's hand-picked modules are closed to them, not just hidden from the sidebar.
  // (Only for people an Admin customized; everyone else keeps the existing per-page checks.)
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const guardedUser = useAuthStore((s) => s.user);
  useEffect(() => {
    if (!guardedUser?.modulesCustomized) return;
    const key = moduleForPath(pathname);
    if (key && !canAccessModule(guardedUser, key)) {
      toast.error("You don't have access to that module.");
      navigate({ to: "/" });
    }
  }, [pathname, guardedUser, navigate]);

  useEffect(() => {
    setIsMounted(true);
    const store = useAuthStore.getState();
    // With no usable token in storage, still try the refresh cookie before
    // sending anyone to /login -- the session may well be alive (see tryRefresh).
    const hasStoredSession = !!store.accessToken && store.status !== "unauthenticated";
    if (hasStoredSession && !isTokenExpired(store.accessToken, 30)) return;

    let cancelled = false;
    setIsRefreshing(true);

    const attempt = (retriesLeft: number) => {
      tryRefresh().then((outcome) => {
        if (cancelled) return;
        if (outcome === "ok") {
          setIsRefreshing(false);
          return;
        }
        if (outcome === "invalid") {
          store.clearAuth();
          window.location.replace("/login");
          return;
        }
        // "transient" -- the token might still be fine; this was a network/
        // server hiccup, not the server rejecting it. Retry once more before
        // giving up, since forcing a sign-out here was the actual bug.
        if (retriesLeft > 0) {
          setTimeout(() => attempt(retriesLeft - 1), TRANSIENT_RETRY_DELAY_MS);
        } else {
          setIsRefreshing(false);
          setGaveUpTransiently(true);
        }
      });
    };
    attempt(1);

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (
    !isMounted ||
    status !== "authenticated" ||
    isRefreshing ||
    (isTokenExpired(accessToken, 10) && !gaveUpTransiently)
  ) {
    return (
      <div className="min-h-screen grid place-items-center bg-canvas">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm px-4">
          <Loader2 className="size-10 animate-spin text-primary" strokeWidth={2} />
          <div>
            <h2 className="text-lg font-semibold text-foreground">Opening Venus CRM...</h2>
            <p className="text-sm text-slate-500 mt-1">Validating session security...</p>
          </div>
          <a
            href="/login"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
          >
            Go to Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-canvas text-foreground">
      <AppSidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </main>
      <CommandPalette />
      <GlobalDialogs />
      <WorkAccountabilityPrompts />
      <GlobalCallWidget />
      <SignOutRequestWatcher />
    </div>
  );
}
