import { useAuthStore } from "@/stores/auth-store";

export function getApiUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
  ) {
    return "/api";
  }
  return "http://localhost:4001";
}

const API_URL = getApiUrl();

// Endpoints that stream a file back (e.g. candidates/resumes/:filename) hand
// out a path relative to the Nest app, not the frontend origin -- resolve it
// against the same API_URL apiFetch uses so it works in dev (bare :4001) and
// behind the Caddy /api reverse proxy in production alike. Already-absolute
// URLs (blob:, data:, or a full http(s) link) pass through unchanged.
export function resolveApiAssetUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^(https?:|blob:|data:)/i.test(path)) return path;
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export function isApiError(error: unknown): error is ApiError {
  if (error instanceof ApiError) return true;
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number"
  );
}

interface RequestOptions extends RequestInit {
  // Set on requests that should never trigger a silent-refresh retry: the
  // three public auth endpoints themselves, to avoid refresh-on-login-failure
  // and infinite refresh loops.
  skipAuthRetry?: boolean;
}

async function rawFetch(path: string, options: RequestOptions = {}): Promise<Response> {
  const { skipAuthRetry: _skip, ...init } = options;
  const token = useAuthStore.getState().accessToken;

  return fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
}

// "invalid" = the server actually rejected the refresh token (401) -- the
// session is genuinely over, safe to sign out. "transient" = the request
// itself failed for some other reason (a momentary 5xx from a deploy, a
// timeout, a dropped connection) -- the token might still be perfectly
// good; treating this the same as "invalid" was exactly what forced people
// out of the app mid-session on a brief network hiccup. Only "invalid"
// should ever trigger clearAuth()/redirect-to-login.
export type RefreshOutcome = "ok" | "invalid" | "transient";

let refreshPromise: Promise<RefreshOutcome> | null = null;

import { isTokenExpired } from "../jwt";

export async function tryRefresh(): Promise<RefreshOutcome> {
  if (refreshPromise) return refreshPromise;

  // Deliberately no "no access token in memory -> signed out" shortcut: the
  // httpOnly refresh cookie is the real session, and it can be perfectly valid
  // while localStorage is empty (the desktop app hands the window only the
  // cookie; storage cleared; a fresh tab). Only the server's 401 decides.
  refreshPromise = (async (): Promise<RefreshOutcome> => {
    try {
      // The refresh token rides along as the httpOnly cookie (credentials:
      // "include" in rawFetch) -- never read or sent from JS.
      const res = await rawFetch("/auth/refresh", { method: "POST", skipAuthRetry: true });
      if (res.status === 401) {
        useAuthStore.getState().clearAuth();
        return "invalid";
      }
      if (!res.ok) {
        return "transient";
      }
      const data = await res.json();
      useAuthStore.getState().setAuth(data.user, data.accessToken);
      return "ok";
    } catch {
      return "transient";
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  // Proactively validate and refresh token before making network requests to prevent 401s
  if (!options.skipAuthRetry && !path.startsWith("/auth/")) {
    const token = useAuthStore.getState().accessToken;
    if (isTokenExpired(token, 30)) {
      const outcome = await tryRefresh();
      if (outcome === "invalid") {
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          window.location.replace("/login");
        }
        throw new ApiError(401, "Session expired");
      }
      // "transient" -- don't sign out on a momentary failure. Proceed with
      // the request below on the current (soon-expiring) token; either it
      // still works, or the 401-retry path just below gets one more real
      // chance to refresh.
    }
  }

  let res = await rawFetch(path, options);

  if (res.status === 401 && !options.skipAuthRetry) {
    const outcome = await tryRefresh();
    if (outcome === "ok") {
      res = await rawFetch(path, options);
    }
  }

  const text = await res.text();
  const body = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    throw new ApiError(res.status, body?.message ?? res.statusText);
  }

  return body as T;
}

// Multipart upload. Deliberately does NOT set Content-Type: the browser has
// to write the multipart boundary itself, which is why this can't just be
// apiFetch with a FormData body.
export async function apiUploadForm<T>(path: string, form: FormData): Promise<T> {
  const send = () => {
    const token = useAuthStore.getState().accessToken;
    return fetch(`${API_URL}${path}`, {
      method: "POST",
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
  };

  let res = await send();
  if (res.status === 401 && (await tryRefresh()) === "ok") {
    res = await send();
  }

  const text = await res.text();
  const body = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    throw new ApiError(res.status, body?.message ?? res.statusText);
  }
  return body as T;
}

// For binary responses (e.g. a screen-capture image) that can't go through
// apiFetch's JSON parsing -- same auth-header + silent-refresh-retry behavior.
export async function apiFetchBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  let res = await rawFetch(path, options);

  if (res.status === 401 && !options.skipAuthRetry) {
    const outcome = await tryRefresh();
    if (outcome === "ok") {
      res = await rawFetch(path, options);
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, res.statusText);
  }

  return res.blob();
}
