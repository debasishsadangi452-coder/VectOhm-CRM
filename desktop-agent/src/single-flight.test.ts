import { describe, expect, it } from "vitest";
import { singleFlight } from "./single-flight";

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("singleFlight", () => {
  it("runs the function once for overlapping calls and shares the result", async () => {
    let runs = 0;
    const d = deferred<string>();
    const refresh = singleFlight(() => {
      runs++;
      return d.promise;
    });

    const a = refresh();
    const b = refresh();
    const c = refresh();
    expect(runs).toBe(1);

    d.resolve("token-2");
    expect(await Promise.all([a, b, c])).toEqual(["token-2", "token-2", "token-2"]);
  });

  it("starts a fresh run once the previous one has finished", async () => {
    let runs = 0;
    const refresh = singleFlight(async () => ++runs);
    expect(await refresh()).toBe(1);
    expect(await refresh()).toBe(2);
  });

  it("shares a failure with every waiting caller, then allows a retry", async () => {
    let runs = 0;
    const d = deferred<boolean>();
    const refresh = singleFlight(() => {
      runs++;
      return runs === 1 ? d.promise : Promise.resolve(true);
    });

    const a = refresh();
    const b = refresh();
    d.reject(new Error("network down"));
    await expect(a).rejects.toThrow("network down");
    await expect(b).rejects.toThrow("network down");

    expect(await refresh()).toBe(true); // not stuck after a failure
    expect(runs).toBe(2);
  });

  it("a timer tick, a wake-from-sleep refresh and a 401 retry together cost one refresh", async () => {
    let serverRefreshes = 0;
    const refresh = singleFlight(async () => {
      serverRefreshes++;
      await new Promise((r) => setTimeout(r, 10));
      return true;
    });
    await Promise.all([refresh(), refresh(), refresh()]);
    expect(serverRefreshes).toBe(1);
  });
});
