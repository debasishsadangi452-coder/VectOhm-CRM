// Carries the HTTP status so callers can tell "the server said this refresh
// token is really invalid" (401 -- sign out is correct) apart from "the
// request itself failed" (5xx, rate limiting, or no response at all, e.g. right
// after waking from sleep before the network is back up -- should retry, never
// sign out). A network-level failure (fetch rejecting before any response)
// throws a plain Error/TypeError with no `.status` at all, which callers treat
// the same as any other non-401: transient, not a reason to sign out.
export class AuthApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

/** True only when the server explicitly rejected the refresh token (401). */
export function isInvalidRefreshToken(err: unknown): boolean {
  return err instanceof AuthApiError && err.status === 401;
}
