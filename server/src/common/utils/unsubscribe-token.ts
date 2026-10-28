import { createHmac, timingSafeEqual } from "node:crypto";

// Stateless unsubscribe links: the token is an HMAC of the recipient's email,
// keyed by APP_ENCRYPTION_KEY (the same secret already used for the GitHub/
// Apollo token encryption -- reused here rather than adding a new env var).
// No token-storage table needed since the token is always re-derivable from
// the email it's for, and verification is just recomputing and comparing.

function getSecret(): string {
  const key = process.env.APP_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("APP_ENCRYPTION_KEY is not set -- required for unsubscribe links.");
  }
  return key;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateUnsubscribeToken(email: string): string {
  return createHmac("sha256", getSecret()).update(normalizeEmail(email)).digest("hex");
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = Buffer.from(generateUnsubscribeToken(email), "hex");
  let provided: Buffer;
  try {
    provided = Buffer.from(token, "hex");
  } catch {
    return false;
  }
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

// Frontend page, not a backend route -- mirrors how AuthService builds the
// password-reset link, so both public email-triggered links share the same
// APP_URL/CORS_ORIGIN fallback chain.
export function buildUnsubscribeUrl(email: string, appUrl: string): string {
  const token = generateUnsubscribeToken(email);
  const base = appUrl.replace(/\/$/, "");
  return `${base}/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}
