import { safeStorage } from "electron";
import * as fs from "fs";
import * as path from "path";
import { AuthApiError } from "./auth-error";

// The real production API, reached through the same /api prefix Caddy
// strips for the browser (see Caddyfile) -- this is a raw fetch from the
// Electron main process, not a same-origin browser request, so it needs
// the full absolute URL rather than the website's relative "/api".
// Overridable for local dev, e.g. OMNIOS_API_URL=http://localhost:4001.
export const API_URL = process.env.OMNIOS_API_URL ?? "https://crm.venusglobaltech.com/api";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface AuthResult {
  accessToken: string;
  // The raw refresh-token cookie value -- the web app never sees this (it's
  // httpOnly), but a non-browser agent has to carry it explicitly between
  // requests since there's no browser cookie jar here.
  refreshCookie: string;
  user: AuthUser;
  // Whether this user has accepted the CURRENT monitoring notice (see
  // server/src/modules/auth/terms.ts) -- main.ts gates the screen-recording
  // and activity loops on this, on both the fresh-login and the silent
  // refresh path (a version bump re-gates an already-signed-in employee on
  // their next refresh too).
  termsAccepted: boolean;
  termsVersion: string;
  termsText: string;
}

// Persists only the refresh token, OS-keychain-encrypted via Electron's
// safeStorage (DPAPI on Windows, Keychain on macOS) -- never plaintext on
// disk. If encryption isn't available on this OS/build, we deliberately
// don't persist at all and require a fresh login, rather than ever writing
// the token in the clear.
export class TokenStore {
  private readonly filePath: string;

  constructor(userDataDir: string) {
    this.filePath = path.join(userDataDir, "refresh.token");
  }

  save(rawRefreshToken: string): void {
    if (!safeStorage.isEncryptionAvailable()) return;
    const encrypted = safeStorage.encryptString(rawRefreshToken);
    fs.writeFileSync(this.filePath, encrypted);
  }

  load(): string | null {
    if (!safeStorage.isEncryptionAvailable() || !fs.existsSync(this.filePath)) return null;
    try {
      return safeStorage.decryptString(fs.readFileSync(this.filePath));
    } catch {
      return null;
    }
  }

  clear(): void {
    if (fs.existsSync(this.filePath)) fs.unlinkSync(this.filePath);
  }
}

// The backend sets the refresh token as an httpOnly Set-Cookie header (see
// auth.controller.ts) rather than returning it in the JSON body -- there's
// no browser cookie jar here to hold onto it automatically, so we parse it
// out ourselves and carry it explicitly on every /auth/refresh call.
function extractRefreshCookie(res: Response): string {
  const setCookieHeaders =
    typeof (res.headers as { getSetCookie?: () => string[] }).getSetCookie === "function"
      ? (res.headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
      : [res.headers.get("set-cookie") ?? ""];

  for (const header of setCookieHeaders) {
    const match = header.match(/refreshToken=([^;]+)/);
    if (match) return match[1];
  }
  throw new Error("Login succeeded but no refresh token was returned");
}

// AuthApiError / isInvalidRefreshToken live in ./auth-error (pure, so they are unit-testable).
export { AuthApiError, isInvalidRefreshToken } from "./auth-error";

async function parseAuthResponse(res: Response): Promise<AuthResult> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { message?: string });
    throw new AuthApiError(body.message ?? `Request failed (${res.status})`, res.status);
  }
  const refreshCookie = extractRefreshCookie(res);
  const data = (await res.json()) as {
    accessToken: string;
    user: AuthUser;
    termsAccepted: boolean;
    termsVersion: string;
    termsText: string;
  };
  return {
    accessToken: data.accessToken,
    refreshCookie,
    user: data.user,
    termsAccepted: data.termsAccepted,
    termsVersion: data.termsVersion,
    termsText: data.termsText,
  };
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-timezone-offset": String(new Date().getTimezoneOffset()),
    },
    body: JSON.stringify({
      email,
      password,
      timezoneOffset: new Date().getTimezoneOffset(),
    }),
  });
  return parseAuthResponse(res);
}

export async function logoutApi(refreshCookie: string): Promise<void> {
  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: {
        Cookie: `refreshToken=${refreshCookie}`,
      },
    });
  } catch (err) {
    console.warn("Failed to notify server of logout:", err);
  }
}

export async function refreshAccessToken(refreshCookie: string): Promise<AuthResult> {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { Cookie: `refreshToken=${refreshCookie}` },
  });
  return parseAuthResponse(res);
}

export async function acceptTerms(accessToken: string, version: string): Promise<void> {
  const res = await fetch(`${API_URL}/auth/accept-terms`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ version }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { message?: string });
    throw new AuthApiError(body.message ?? `Request failed (${res.status})`, res.status);
  }
}
