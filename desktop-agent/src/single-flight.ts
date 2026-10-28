/**
 * Wraps an async function so that overlapping calls share one in-flight run
 * instead of each starting their own.
 *
 * Used for refreshing the session: the 10-minute timer, a wake-from-sleep
 * handler and a 401-triggered retry can all fire close together. Without this,
 * each would present the same refresh token to the server at once, and each
 * successful call rotates it -- the loser of the race ends up holding a token
 * the server has already replaced.
 */
export function singleFlight<T>(fn: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null;
  return () => {
    if (inFlight) return inFlight;
    const run = fn().finally(() => {
      if (inFlight === run) inFlight = null;
    });
    inFlight = run;
    return run;
  };
}
