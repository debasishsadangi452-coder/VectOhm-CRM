import { describe, expect, it } from "vitest";
import { AuthApiError, isInvalidRefreshToken } from "./auth-error";

describe("isInvalidRefreshToken", () => {
  it("is true only for a 401 from the server -- the one case where signing out is correct", () => {
    expect(isInvalidRefreshToken(new AuthApiError("Invalid refresh token", 401))).toBe(true);
  });

  it.each([400, 403, 404, 408, 429, 500, 502, 503, 504])(
    "is false for HTTP %d (transient or not about the token -- must never sign the user out)",
    (status) => {
      expect(isInvalidRefreshToken(new AuthApiError("nope", status))).toBe(false);
    },
  );

  it("is false for a network failure (no response at all, e.g. just woke from sleep)", () => {
    expect(isInvalidRefreshToken(new TypeError("fetch failed"))).toBe(false);
    expect(isInvalidRefreshToken(new Error("getaddrinfo ENOTFOUND"))).toBe(false);
  });

  it("is false for things that are not errors", () => {
    expect(isInvalidRefreshToken(undefined)).toBe(false);
    expect(isInvalidRefreshToken(null)).toBe(false);
    expect(isInvalidRefreshToken("401")).toBe(false);
    expect(isInvalidRefreshToken({ status: 401 })).toBe(false);
  });
});

describe("AuthApiError", () => {
  it("keeps the message, status and name, and is an Error", () => {
    const err = new AuthApiError("Expired refresh token", 401);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AuthApiError);
    expect(err.message).toBe("Expired refresh token");
    expect(err.status).toBe(401);
    expect(err.name).toBe("AuthApiError");
  });
});
