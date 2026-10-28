import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/auth-store";

// Deliberately a component-level effect, not a route `beforeLoad` guard --
// beforeLoad isn't guaranteed to re-run client-side for the route already
// active during initial hydration (see _app.tsx's auth guard and
// use-department-guard.ts for the same lesson learned the hard way).
// Unlike the department guard, this IS the actual security boundary for
// admin-only pages that have no backend data-fetching of their own yet
// (e.g. the /admin/settings scaffold) -- there's no department-scoped read
// underneath to fall back on, so this must actually redirect, not just tidy
// up the UX.
export function useAdminGuard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) return;
    if (user.role.name !== "ADMIN") {
      navigate({ to: "/" });
    }
  }, [user, navigate]);
}
