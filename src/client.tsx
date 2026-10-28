import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";

if (typeof window !== "undefined") {
  const isStartTimeError = (msg?: unknown, err?: unknown): boolean => {
    const errorObj = err as Error | undefined;
    const str = `${String(msg || "")} ${errorObj?.message || ""} ${errorObj?.stack || ""}`;
    return str.includes("startTime") || str.includes("reportAllChanges");
  };

  window.addEventListener(
    "error",
    (e) => {
      if (isStartTimeError(e.message, e.error)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return true;
      }
    },
    true,
  );

  const prevOnError = window.onerror;
  window.onerror = function (msg, url, line, col, err) {
    if (isStartTimeError(msg, err)) {
      return true;
    }
    if (typeof prevOnError === "function") {
      return prevOnError.apply(this, [msg, url, line, col, err]);
    }
  };

  window.addEventListener(
    "unhandledrejection",
    (e) => {
      const r = e.reason as Error | string | undefined;
      if (r && isStartTimeError(typeof r === "string" ? r : r?.message, r)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );

  const origConsoleError = console.error;
  console.error = function (...args: unknown[]) {
    const str = args
      .map((a) => (a instanceof Error ? `${a.message} ${a.stack}` : String(a)))
      .join(" ");
    if (isStartTimeError(str)) return;
    return origConsoleError.apply(console, args);
  };

  // Cast through `(...a: any[]) => any` when calling the originals: with
  // @types/node's global augmentation in scope, TS resolves window.setTimeout
  // against Node's `Timeout`-returning overload here instead of the DOM one,
  // which rejects both the plain `...args` spread and the wrapped function's
  // inferred return type. The patched functions are then cast back to
  // `typeof window.setTimeout`/`typeof window.setInterval` at assignment so
  // callers outside this file still see the real, correctly-typed browser API.
  const origSetTimeout = window.setTimeout as (...a: any[]) => any;
  window.setTimeout = ((fn: TimerHandler, delay?: number, ...args: unknown[]) => {
    if (typeof fn === "function") {
      const wrapped = function (this: unknown, ...innerArgs: unknown[]) {
        try {
          return fn.apply(this, innerArgs);
        } catch (err) {
          if (isStartTimeError((err as Error)?.message, err)) return;
          throw err;
        }
      };
      return origSetTimeout(wrapped, delay, ...args);
    }
    return origSetTimeout(fn, delay, ...args);
  }) as typeof window.setTimeout;

  const origSetInterval = window.setInterval as (...a: any[]) => any;
  window.setInterval = ((fn: TimerHandler, delay?: number, ...args: unknown[]) => {
    if (typeof fn === "function") {
      const wrapped = function (this: unknown, ...innerArgs: unknown[]) {
        try {
          return fn.apply(this, innerArgs);
        } catch (err) {
          if (isStartTimeError((err as Error)?.message, err)) return;
          throw err;
        }
      };
      return origSetInterval(wrapped, delay, ...args);
    }
    return origSetInterval(fn, delay, ...args);
  }) as typeof window.setInterval;

  if (window.PerformanceObserver) {
    try {
      const OrigObserver = window.PerformanceObserver;
      const PatchedObserver = function (
        callback: PerformanceObserverCallback,
      ): PerformanceObserver {
        return new OrigObserver((list, obs) => {
          try {
            return callback(list, obs);
          } catch (err: unknown) {
            const e = err as Error;
            if (isStartTimeError(e?.message, e)) return;
            throw err;
          }
        });
      } as unknown as typeof PerformanceObserver;
      PatchedObserver.prototype = OrigObserver.prototype;
      // supportedEntryTypes is declared read-only on the type, but it's a
      // plain static data property at runtime -- fine to copy over.
      (PatchedObserver as { supportedEntryTypes?: readonly string[] }).supportedEntryTypes =
        OrigObserver.supportedEntryTypes;
      window.PerformanceObserver = PatchedObserver;
    } catch {
      // ignore
    }
  }
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  );
  (window as any).__HYDRATED__ = true;
});

