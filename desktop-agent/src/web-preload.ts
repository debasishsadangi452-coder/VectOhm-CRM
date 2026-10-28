// Preload for the main CRM window. Runs before the website's own scripts on
// every page load, and hands the website the sign-in the employee already
// did in the agent's login window -- otherwise the site opens with empty
// storage and shows its own sign-in page, asking for the password a second
// time. Sandboxed preload: only "electron" may be imported here, no local modules.
import { ipcRenderer } from "electron";

// Must match the website's persisted auth store (src/stores/auth-store.ts:
// zustand `persist` with name "venus_auth_session", default version 0).
const AUTH_STORAGE_KEY = "venus_auth_session";

interface WebAuthSeed {
  origin: string;
  user: { id: string };
  accessToken: string;
}

try {
  const seed = ipcRenderer.sendSync("web-auth:seed") as WebAuthSeed | null;
  // Only ever on the CRM's own origin -- never hand the token to another site
  // the window may have navigated to.
  if (seed && window.location.origin === seed.origin) {
    const current = JSON.parse(window.localStorage.getItem(AUTH_STORAGE_KEY) ?? "null") as {
      state?: { status?: string; accessToken?: string | null; user?: { id?: string } | null };
    } | null;
    const alreadySignedIn =
      current?.state?.status === "authenticated" &&
      !!current.state.accessToken &&
      current.state.user?.id === seed.user.id;
    if (!alreadySignedIn) {
      window.localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({
          state: { user: seed.user, accessToken: seed.accessToken, status: "authenticated" },
          version: 0,
        }),
      );
    }
  }
} catch (err) {
  // Worst case the website falls back to its own sign-in / cookie refresh.
  console.error("Could not hand the sign-in to the CRM window", err);
}
