import { describe, expect, it } from "vitest";
import { isTokenExpired } from "./jwt";

function makeToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

describe("isTokenExpired", () => {
  it("treats null/undefined as expired", () => {
    expect(isTokenExpired(null)).toBe(true);
    expect(isTokenExpired(undefined)).toBe(true);
  });

  it("treats an empty string as expired", () => {
    expect(isTokenExpired("")).toBe(true);
  });

  it("treats a malformed token (not 3 dot-separated parts) as expired", () => {
    expect(isTokenExpired("not-a-jwt")).toBe(true);
    expect(isTokenExpired("only.two")).toBe(true);
  });

  it("treats unparseable base64/JSON payload as expired, not a thrown error", () => {
    expect(isTokenExpired("header.not-valid-base64!!!.sig")).toBe(true);
  });

  it("treats a token with no exp claim as never expiring", () => {
    const token = makeToken({ sub: "user-1" });
    expect(isTokenExpired(token)).toBe(false);
  });

  it("is not expired when exp is well in the future", () => {
    const token = makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 });
    expect(isTokenExpired(token)).toBe(false);
  });

  it("is expired when exp is in the past", () => {
    const token = makeToken({ exp: Math.floor(Date.now() / 1000) - 10 });
    expect(isTokenExpired(token)).toBe(true);
  });

  it("applies the margin: treats a token expiring within the margin window as already expired", () => {
    // Expires in 30s; default margin is 60s -- so this should read as expired
    // now, giving callers time to proactively refresh before it truly lapses.
    const token = makeToken({ exp: Math.floor(Date.now() / 1000) + 30 });
    expect(isTokenExpired(token)).toBe(true);
    expect(isTokenExpired(token, 0)).toBe(false); // with no margin, still technically valid
  });

  it("respects a custom margin", () => {
    const token = makeToken({ exp: Math.floor(Date.now() / 1000) + 120 });
    expect(isTokenExpired(token, 60)).toBe(false); // 120s left, 60s margin -> fine
    expect(isTokenExpired(token, 180)).toBe(true); // 120s left, 180s margin -> already "expired"
  });
});
