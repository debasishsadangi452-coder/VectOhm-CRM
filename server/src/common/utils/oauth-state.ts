import { createHmac, timingSafeEqual } from "node:crypto";

// Signed, stateless CSRF token for the OAuth authorize/callback round-trip
// (see modules/email-oauth). The browser leaves this app entirely to reach
// Google/Microsoft's consent screen and comes back on a plain top-level
// redirect -- no Authorization header, so the callback can't rely on
// @CurrentUser(). The signed state carries which user + provider started the
// flow and a short expiry, verified on callback the same way
// unsubscribe-token.ts verifies its HMAC (same APP_ENCRYPTION_KEY secret,
// no extra env var, no token-storage table needed).

const MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes -- generous for a consent screen, short enough to limit replay

interface OAuthStatePayload {
  userId: string;
  provider: "GOOGLE" | "MICROSOFT" | "ZOHO";
  ts: number;
}

function getSecret(): string {
  const key = process.env.APP_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("APP_ENCRYPTION_KEY is not set -- required for OAuth state signing.");
  }
  return key;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function generateOAuthState(userId: string, provider: OAuthStatePayload["provider"]): string {
  const payload: OAuthStatePayload = { userId, provider, ts: Date.now() };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

// Returns the payload if the state is authentic and not expired, null
// otherwise -- callers treat any null as "reject the callback".
export function verifyOAuthState(state: string): OAuthStatePayload | null {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) return null;

  const expected = Buffer.from(sign(encoded), "hex");
  let provided: Buffer;
  try {
    provided = Buffer.from(signature, "hex");
  } catch {
    return null;
  }
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as OAuthStatePayload;
    if (Date.now() - payload.ts > MAX_AGE_MS) return null;
    return payload;
  } catch {
    return null;
  }
}
