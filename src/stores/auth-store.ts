import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  role: {
    id: string;
    name: "ADMIN" | "MANAGER" | "EMPLOYEE";
  };
  // Drives department-scoped display (e.g. "Sales Manager", "Dev Head") and
  // the admin-only /admin/settings route guard's role check elsewhere.
  department: {
    id: string;
    name: string;
    managerTitle: string;
  } | null;
  // Admin-granted permission to sign out (ADMIN can always). Undefined = not allowed.
  canSignOut?: boolean;
  // Admin-chosen module access: when modulesCustomized is true, `modules` is the whole list they may use
  // (see src/lib/modules.ts). Otherwise the default for their role and department applies.
  modulesCustomized?: boolean;
  modules?: string[];
}

interface AuthState {
  user: CurrentUser | null;
  accessToken: string | null;
  status: "idle" | "authenticated" | "unauthenticated";
  // Patch the in-memory current user (e.g. after a self-service profile edit)
  // without re-authenticating -- keeps the sidebar name/email in sync.
  setAuth: (user: CurrentUser, accessToken: string) => void;
  patchUser: (patch: Partial<CurrentUser>) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      status: "idle",
      setAuth: (user, accessToken) => set({ user, accessToken, status: "authenticated" }),
      patchUser: (patch) => set((s) => (s.user ? { user: { ...s.user, ...patch } } : {})),
      clearAuth: () => set({ user: null, accessToken: null, status: "unauthenticated" }),
    }),
    {
      name: "venus_auth_session",
      // Whitelist explicitly: the refresh token must never end up in this
      // store. It's an httpOnly cookie so plain JS can't read it -- if a
      // future field gets added to AuthState without updating this list,
      // that's exactly the bug (a session secret readable by any script on
      // the page, including an XSS payload) this partialize exists to catch.
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken, status: state.status }),
    }
  )
);

/** Normal users can't sign out (it would stop screen recording) until an Admin allows it. */
export function userCanSignOut(user: CurrentUser | null | undefined): boolean {
  return !!user && (user.role.name === "ADMIN" || user.canSignOut === true);
}
