// @vitest-environment node
//
// Loads the REAL main.ts against a fake Electron (windows, tray, IPC, power
// events) and fake auth/API modules, then drives it like a user would: sign in,
// clock in, close the CRM window, reopen it, sleep and wake, get a 401, and so
// on. Time is faked, so a whole shift runs in milliseconds.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (...args: any[]) => any;

const h = vi.hoisted(() => {
  const state = {
    lock: true,
    windows: [] as any[],
    trayHandlers: {} as Record<string, Handler>,
    lastMenu: [] as Array<{ label?: string; click?: Handler; enabled?: boolean }>,
    ipc: new Map<string, Handler[]>(),
    ipcHandle: {} as Record<string, Handler>,
    power: {} as Record<string, Handler>,
    appHandlers: {} as Record<string, Handler>,
    appQuit: undefined as any,
    stored: null as string | null,
    uiohook: { start: undefined as any, stop: undefined as any },
    auth: {
      refreshAccessToken: undefined as any,
      logoutApi: undefined as any,
      login: undefined as any,
    },
    api: {
      getActiveWorkSession: undefined as any,
      uploadRecording: undefined as any,
      uploadActivityPing: undefined as any,
      reportAgentQuit: undefined as any,
      reportAgentSignOut: undefined as any,
      submitIdleReason: undefined as any,
    },
    capturer: { getSources: undefined as any },
    dialog: { showMessageBox: undefined as any },
    cookieListener: undefined as Handler | undefined,
    idleSeconds: 0,
    clearedStorages: [] as string[][],
  };
  return state;
});

vi.mock("electron", () => {
  class FakeWindow {
    handlers = new Map<string, Array<{ cb: Handler; once: boolean }>>();
    visible = false;
    destroyed = false;
    url = "";
    file = "";
    sent: any[][] = [];
    wcHandlers = new Map<string, Handler[]>();
    loads: string[] = [];
    webContents = {
      send: (...a: any[]) => this.sent.push(a),
      on: (e: string, cb: Handler) => this.wcHandlers.set(e, [...(this.wcHandlers.get(e) ?? []), cb]),
      emit: (e: string, ...a: any[]) => (this.wcHandlers.get(e) ?? []).forEach((cb) => cb({}, ...a)),
      isDestroyed: () => this.destroyed,
      getURL: () => this.loads[this.loads.length - 1] ?? "",
    };
    constructor(public opts: any) {
      h.windows.push(this);
    }
    loadURL(u: string) {
      this.url = u;
      this.loads.push(u);
      return Promise.resolve();
    }
    loadFile(f: string) {
      this.file = f;
      this.loads.push(`file:///${f}`);
      return Promise.resolve();
    }
    isVisible() {
      return this.visible;
    }
    isDestroyed() {
      return this.destroyed;
    }
    setMenuBarVisibility() {}
    flashFrame() {}
    on(e: string, cb: Handler) {
      this.handlers.set(e, [...(this.handlers.get(e) ?? []), { cb, once: false }]);
    }
    once(e: string, cb: Handler) {
      this.handlers.set(e, [...(this.handlers.get(e) ?? []), { cb, once: true }]);
    }
    emit(e: string, ...a: any[]) {
      const list = this.handlers.get(e) ?? [];
      this.handlers.set(e, list.filter((x) => !x.once));
      list.forEach((x) => x.cb(...a));
    }
    show() {
      this.visible = true;
      this.emit("show");
    }
    hide() {
      this.visible = false;
      this.emit("hide");
    }
    focus() {}
    close() {
      const ev = { prevented: false, preventDefault() { this.prevented = true; } };
      this.emit("close", ev);
      if (!ev.prevented) this.destroy();
    }
    destroy() {
      this.destroyed = true;
      this.emit("closed");
    }
  }

  class FakeTray {
    constructor() {}
    on(e: string, cb: Handler) {
      h.trayHandlers[e] = cb;
    }
    setToolTip() {}
    popUpContextMenu(menu: any) {
      h.lastMenu = menu;
    }
  }

  return {
    app: {
      requestSingleInstanceLock: () => h.lock,
      quit: (...a: any[]) => h.appQuit(...a),
      on: (e: string, cb: Handler) => {
        h.appHandlers[e] = cb;
      },
      whenReady: () => Promise.resolve(),
      setAppUserModelId() {},
      getPath: () => "C:/tmp/agent",
      setLoginItemSettings() {},
      dock: undefined,
    },
    Tray: FakeTray,
    Menu: { buildFromTemplate: (t: any) => t },
    BrowserWindow: FakeWindow,
    ipcMain: {
      handle: (ch: string, fn: Handler) => {
        h.ipcHandle[ch] = fn;
      },
      on: (ch: string, fn: Handler) => h.ipc.set(ch, [...(h.ipc.get(ch) ?? []), fn]),
      removeListener: (ch: string, fn: Handler) => h.ipc.set(ch, (h.ipc.get(ch) ?? []).filter((f) => f !== fn)),
    },
    desktopCapturer: { getSources: (...a: any[]) => h.capturer.getSources(...a) },
    dialog: { showMessageBox: (...a: any[]) => h.dialog.showMessageBox(...a) },
    nativeImage: { createFromDataURL: () => ({ resize: () => ({}) }) },
    powerMonitor: {
      on: (e: string, cb: Handler) => {
        h.power[e] = cb;
      },
      getSystemIdleTime: () => h.idleSeconds,
    },
    session: {
      defaultSession: {
        cookies: {
          on: (_e: string, cb: Handler) => {
            h.cookieListener = cb;
          },
          get: async () => [],
          set: async () => undefined,
        },
        clearStorageData: async (opts: { storages: string[] }) => {
          h.clearedStorages.push(opts.storages);
        },
      },
    },
  };
});

vi.mock("uiohook-napi", () => ({
  uIOhook: {
    on: () => undefined,
    start: (...a: any[]) => h.uiohook.start(...a),
    stop: (...a: any[]) => h.uiohook.stop(...a),
  },
}));

vi.mock("./auth", () => ({
  API_URL: "http://api.test",
  login: (...a: any[]) => h.auth.login(...a),
  logoutApi: (...a: any[]) => h.auth.logoutApi(...a),
  refreshAccessToken: (...a: any[]) => h.auth.refreshAccessToken(...a),
  acceptTerms: async () => undefined,
  TokenStore: class {
    save(v: string) {
      h.stored = v;
    }
    load() {
      return h.stored;
    }
    clear() {
      h.stored = null;
    }
  },
}));

vi.mock("./api", () => ({
  getActiveWorkSession: (...a: any[]) => h.api.getActiveWorkSession(...a),
  uploadRecording: (...a: any[]) => h.api.uploadRecording(...a),
  uploadActivityPing: (...a: any[]) => h.api.uploadActivityPing(...a),
  reportAgentQuit: (...a: any[]) => h.api.reportAgentQuit(...a),
  reportAgentSignOut: (...a: any[]) => h.api.reportAgentSignOut(...a),
  submitIdleReason: (...a: any[]) => h.api.submitIdleReason(...a),
}));

// vi.resetModules() gives main.ts its own fresh copy of ./auth-error, so an error
// built from a statically imported class would fail main's `instanceof` check.
// Build errors from the same registry main.ts uses.
async function authError(message: string, status: number) {
  const { AuthApiError } = await import("./auth-error");
  return new AuthApiError(message, status);
}

// ───────────────────────── helpers ─────────────────────────

const user = { id: "u1", email: "emp@x.com", firstName: "E", lastName: "M" };
let tokenCounter = 0;
const authOk = () => ({
  accessToken: `access-${++tokenCounter}`,
  refreshCookie: `refresh-${tokenCounter}`,
  user,
  termsAccepted: true,
  termsVersion: "v1",
  termsText: "",
});
const activeSession = { id: "s1", isOnBreak: false, breakRemainingSeconds: 0, cooldownRemainingSeconds: 0, idlePromptMinutes: 5 };

const winBy = (pred: (w: any) => boolean) => h.windows.find(pred);
const recorder = () => winBy((w) => w.file.includes("recorder.html"));
const mainWin = () => winBy((w) => w.url.startsWith("https://crm.venusglobaltech.com") && !w.destroyed);
const loginWin = () => winBy((w) => w.file.includes("login.html") && !w.destroyed);
const recorderStarts = () => recorder().sent.filter(([c]: any[]) => c === "recorder:start").length;
const recorderStops = () => recorder().sent.filter(([c]: any[]) => c === "recorder:stop").length;
const ipcEmit = (ch: string, ...args: any[]) => (h.ipc.get(ch) ?? []).slice().forEach((fn) => fn({}, ...args));
const trayLabels = () => {
  h.trayHandlers["right-click"]();
  return h.lastMenu.map((m) => m.label ?? "");
};
const settle = (ms = 0) => vi.advanceTimersByTimeAsync(ms);
const clickQuit = () => {
  h.trayHandlers["right-click"]();
  h.lastMenu.find((m) => m.label === "Quit")!.click!();
};
const MIN = 60_000;

/** Boots the real main.ts and brings it to "signed in, clocked in, CRM window open". */
async function boot() {
  await import("./main");
  await settle(50);
  // The window only counts as open once Electron shows it.
  mainWin()?.emit("ready-to-show");
  await settle(50);
}

beforeEach(() => {
  vi.resetModules();
  // Off by default -- same as the real shipped build, where an employee has
  // no sign-out path at all. Tests that exercise Sign out opt in explicitly.
  delete process.env.OMNIOS_ALLOW_SIGN_OUT;
  vi.useFakeTimers();
  // 10:19:40 local -- 20s before the :20 recording slot.
  vi.setSystemTime(new Date(2026, 9, 5, 10, 19, 40));
  tokenCounter = 0;
  Object.assign(h, { lock: true, windows: [], trayHandlers: {}, lastMenu: [], ipc: new Map(), ipcHandle: {}, power: {}, appHandlers: {}, stored: "stored-refresh", cookieListener: undefined, clearedStorages: [] });
  h.appQuit = vi.fn();
  h.uiohook.start = vi.fn();
  h.uiohook.stop = vi.fn();
  h.auth.refreshAccessToken = vi.fn(async () => authOk());
  h.auth.logoutApi = vi.fn(async () => undefined);
  h.auth.login = vi.fn(async () => authOk());
  h.api.getActiveWorkSession = vi.fn(async () => activeSession);
  h.api.uploadRecording = vi.fn(async () => undefined);
  h.api.uploadActivityPing = vi.fn(async () => undefined);
  h.capturer.getSources = vi.fn(async () => [{ id: "screen:0" }]);
  h.api.reportAgentQuit = vi.fn(async () => undefined);
  h.api.reportAgentSignOut = vi.fn(async () => undefined);
  h.api.submitIdleReason = vi.fn(async () => undefined);
  h.idleSeconds = 0;
  h.dialog.showMessageBox = vi.fn(async () => ({ response: 1 })); // the person clicks "Quit anyway"
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  delete process.env.OMNIOS_ALLOW_SIGN_OUT;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ───────────────────────── tests ─────────────────────────

describe("monitoring while the CRM window is open", () => {
  it("starts monitoring once signed in, clocked in and the window is open", async () => {
    await boot();

    expect(mainWin().visible).toBe(true);
    expect(h.uiohook.start).toHaveBeenCalledTimes(1);
    expect(h.api.uploadActivityPing).toHaveBeenCalled();
    expect(trayLabels()).toContain("Clocked in — monitoring active");

    await settle(20_000); // reach the :20 slot
    expect(recorderStarts()).toBe(1);
  });

  it("uploads the finished clip", async () => {
    await boot();
    await settle(20_000);
    ipcEmit("recorder:done", { buffer: new Uint8Array(100), durationSec: 15 });
    await settle(10);
    expect(h.api.uploadRecording).toHaveBeenCalledTimes(1);
  });

  it("sends the screen snapshot taken at clip start as the clip's thumbnail", async () => {
    const jpeg = Buffer.from("jpeg-bytes");
    h.capturer.getSources = vi.fn(async () => [
      { id: "screen:0", thumbnail: { isEmpty: () => false, toJPEG: () => jpeg } },
    ]);
    await boot();
    await settle(20_000);
    ipcEmit("recorder:done", { buffer: new Uint8Array(100), durationSec: 15 });
    await settle(10);
    expect(h.api.uploadRecording.mock.calls[0][3]).toBe(jpeg);
  });

  it("waits before retrying when the screen can't be captured, instead of looping", async () => {
    h.capturer.getSources = vi.fn(async () => []); // e.g. no screen source / permission refused
    await boot();
    const calls = h.capturer.getSources.mock.calls.length;
    expect(calls).toBeGreaterThanOrEqual(1);

    await settle(5_000);
    expect(h.capturer.getSources.mock.calls.length).toBe(calls); // no tight loop
    await settle(6_000);
    expect(h.capturer.getSources.mock.calls.length).toBe(calls + 1); // tried again after 10s
  });

  it("keeps recording while nobody touches the keyboard or mouse", async () => {
    await boot();
    h.idleSeconds = 10 * 60; // idle for 10 minutes
    await settle(20_000);

    const sent = recorder().sent.map(([c]: any[]) => c);
    expect(sent).not.toContain("recorder:pause");
    ipcEmit("recorder:done", { buffer: new Uint8Array(100), durationSec: 15 });
    await settle(10);
    expect(h.api.uploadRecording).toHaveBeenCalledTimes(1);
    expect(recorderStarts()).toBe(2); // and the next clip is already recording
  });
});

describe("closing the agent window keeps it running and recording in the background", () => {
  it("keeps recording after the window is closed (X button / Alt+F4)", async () => {
    await boot();
    mainWin().close(); // hides to the tray -- must NOT stop anything
    await settle(10);

    expect(mainWin().visible).toBe(false);
    expect(mainWin().destroyed).toBe(false); // hidden, not destroyed
    expect(h.appQuit).not.toHaveBeenCalled(); // the app did not quit
    expect(h.uiohook.stop).not.toHaveBeenCalled();
    expect(trayLabels()).toContain("Clocked in — monitoring active");

    await settle(20_000); // the :20 slot arrives with the window closed
    expect(recorderStarts()).toBe(1);

    ipcEmit("recorder:done", { buffer: new Uint8Array(100), durationSec: 15 });
    await settle(10);
    expect(h.api.uploadRecording).toHaveBeenCalledTimes(1); // the clip is uploaded
  });

  it("keeps sending activity pings with the window closed", async () => {
    await boot();
    mainWin().close();
    await settle(10);
    const before = h.api.uploadActivityPing.mock.calls.length;
    await settle(5 * MIN);
    expect(h.api.uploadActivityPing.mock.calls.length).toBeGreaterThan(before);
  });

  it("records continuously, clip after clip, with the window closed", async () => {
    await boot();
    mainWin().close();
    await settle(10);

    // Each clip starts as soon as the previous one finishes -- no wait for a slot.
    for (let clip = 1; clip <= 3; clip++) {
      expect(recorderStarts()).toBe(clip);
      ipcEmit("recorder:done", { buffer: new Uint8Array(100), durationSec: 15 });
      await settle(10);
    }
    expect(recorderStarts()).toBe(4);
    expect(h.api.uploadRecording).toHaveBeenCalledTimes(3);
    expect(h.auth.logoutApi).not.toHaveBeenCalled(); // still signed in the whole time
  });

  it("keeps recording while a slow upload is still in progress", async () => {
    await boot();
    let finishUpload!: () => void;
    h.api.uploadRecording = vi.fn(() => new Promise<void>((resolve) => (finishUpload = resolve)));

    expect(recorderStarts()).toBe(1);
    ipcEmit("recorder:done", { buffer: new Uint8Array(100), durationSec: 15 });
    await settle(10);

    // The upload hasn't finished, but the next clip is already recording.
    expect(h.api.uploadRecording).toHaveBeenCalledTimes(1);
    expect(recorderStarts()).toBe(2);
    finishUpload();
  });

  it("stays signed in and reopens from the tray without disturbing monitoring", async () => {
    await boot();
    mainWin().close();
    await settle(25 * MIN);
    expect(trayLabels()).toContain("Signed in as emp@x.com");
    const starts = h.uiohook.start.mock.calls.length;

    h.trayHandlers["click"](); // left-click the tray icon
    await settle(10);

    expect(mainWin().visible).toBe(true);
    expect(h.uiohook.start.mock.calls.length).toBe(starts); // nothing restarted
    expect(h.uiohook.stop).not.toHaveBeenCalled();
  });

  it("an in-progress clip survives the window being closed", async () => {
    await boot();
    await settle(20_000);
    expect(recorderStarts()).toBe(1);

    mainWin().close();
    await settle(10);
    expect(recorderStops()).toBe(0); // recorder not interrupted

    ipcEmit("recorder:done", { buffer: new Uint8Array(100), durationSec: 15 });
    await settle(50);
    expect(h.api.uploadRecording).toHaveBeenCalledTimes(1);
  });

  it("minimizing and closing together change nothing", async () => {
    await boot();
    await settle(21 * MIN);
    expect(recorderStarts()).toBeGreaterThanOrEqual(1);
    expect(h.uiohook.stop).not.toHaveBeenCalled();
  });

  it("closing the window never quits the app", async () => {
    await boot();
    mainWin().close();
    await settle(10);
    expect(h.appQuit).not.toHaveBeenCalled();
    expect(h.dialog.showMessageBox).not.toHaveBeenCalled();
  });
});

describe("quitting from the tray while clocked in", () => {
  it("asks first, and the warning says HR and Admin will be notified", async () => {
    await boot();
    h.dialog.showMessageBox = vi.fn(() => new Promise(() => undefined)); // left open
    clickQuit();
    await settle(10);

    expect(h.dialog.showMessageBox).toHaveBeenCalledTimes(1);
    const opts = h.dialog.showMessageBox.mock.calls[0][0];
    expect(opts.buttons).toEqual(["Cancel", "Quit anyway"]);
    expect(opts.defaultId).toBe(0); // Enter = Cancel, not Quit
    expect(opts.detail).toContain("HR and Admin will be notified");
    expect(h.appQuit).not.toHaveBeenCalled(); // not until they answer
  });

  it("Cancel keeps the agent running and notifies nobody", async () => {
    await boot();
    h.dialog.showMessageBox = vi.fn(async () => ({ response: 0 }));
    clickQuit();
    await settle(10);

    expect(h.appQuit).not.toHaveBeenCalled();
    expect(h.api.reportAgentQuit).not.toHaveBeenCalled();
    expect(h.uiohook.stop).not.toHaveBeenCalled();
    await settle(20_000);
    expect(recorderStarts()).toBe(1); // still recording
  });

  it("closing the dialog (Esc) counts as Cancel", async () => {
    await boot();
    h.dialog.showMessageBox = vi.fn(async () => ({ response: 0 })); // cancelId is 0
    clickQuit();
    await settle(10);
    expect(h.appQuit).not.toHaveBeenCalled();
    expect(h.dialog.showMessageBox.mock.calls[0][0].cancelId).toBe(0);
  });

  it("Quit anyway notifies the server, THEN quits", async () => {
    await boot();
    const order: string[] = [];
    h.api.reportAgentQuit = vi.fn(async () => {
      order.push("notify");
    });
    h.appQuit = vi.fn(() => order.push("quit"));
    clickQuit();
    await settle(10);

    expect(h.api.reportAgentQuit).toHaveBeenCalledTimes(1);
    expect(h.api.reportAgentQuit.mock.calls[0][0]).toMatch(/^access-/); // with the user's token
    expect(order).toEqual(["notify", "quit"]);
  });

  it("still quits if the notification fails", async () => {
    await boot();
    h.api.reportAgentQuit = vi.fn(async () => {
      throw new Error("server down");
    });
    clickQuit();
    await settle(10);
    expect(h.appQuit).toHaveBeenCalledTimes(1);
  });

  it("still quits if the notification hangs (network down) -- after a short wait", async () => {
    await boot();
    h.api.reportAgentQuit = vi.fn(() => new Promise(() => undefined));
    clickQuit();
    await settle(10);
    expect(h.appQuit).not.toHaveBeenCalled();

    await settle(4_000);
    expect(h.appQuit).toHaveBeenCalledTimes(1);
  });

  it("refreshes an expired token and retries the notification", async () => {
    await boot();
    const err = Object.assign(new Error("Unauthorized"), { status: 401 });
    h.api.reportAgentQuit = vi.fn().mockRejectedValueOnce(err).mockResolvedValue(undefined);
    clickQuit();
    await settle(10);
    expect(h.api.reportAgentQuit).toHaveBeenCalledTimes(2);
    expect(h.appQuit).toHaveBeenCalledTimes(1);
  });

  it("also asks (and notifies) when quitting during a break -- the agent is still being quit", async () => {
    await boot();
    h.api.getActiveWorkSession = vi.fn(async () => ({ ...activeSession, isOnBreak: true, breakRemainingSeconds: 600 }));
    await settle(MIN + 10);
    clickQuit();
    await settle(10);
    expect(h.dialog.showMessageBox).toHaveBeenCalledTimes(1);
    expect(h.api.reportAgentQuit).toHaveBeenCalledTimes(1);
  });

  it("clicking Quit repeatedly shows only one dialog", async () => {
    await boot();
    h.dialog.showMessageBox = vi.fn(() => new Promise(() => undefined));
    clickQuit();
    clickQuit();
    clickQuit();
    await settle(10);
    expect(h.dialog.showMessageBox).toHaveBeenCalledTimes(1);
  });
});

describe("quitting while NOT clocked in", () => {
  it("still asks first and notifies, because recording is always on", async () => {
    await boot();
    h.api.getActiveWorkSession = vi.fn(async () => null);
    await settle(MIN + 10); // clocked out
    clickQuit();
    await settle(10);

    expect(h.dialog.showMessageBox).toHaveBeenCalledTimes(1);
    expect(h.dialog.showMessageBox.mock.calls[0][0].message).toContain("always on");
    expect(h.api.reportAgentQuit).toHaveBeenCalledTimes(1);
    expect(h.appQuit).toHaveBeenCalledTimes(1);
  });

  it("quits straight away when nobody is signed in", async () => {
    h.stored = null;
    await import("./main");
    await settle(50);
    clickQuit();
    await settle(10);

    expect(h.dialog.showMessageBox).not.toHaveBeenCalled();
    expect(h.api.reportAgentQuit).not.toHaveBeenCalled();
    expect(h.appQuit).toHaveBeenCalledTimes(1);
  });
});

describe("clocking out and breaks", () => {
  it("stops activity monitoring when the user clocks out, but screen recording carries on", async () => {
    await boot();
    expect(recorderStarts()).toBe(1);
    h.api.getActiveWorkSession = vi.fn(async () => null);
    await settle(MIN + 10); // next session poll
    expect(h.uiohook.stop).toHaveBeenCalled();
    expect(trayLabels()).toContain("Not clocked in — monitoring paused");
    expect(trayLabels()).toContain("Screen recording: always on while signed in");

    // The clip in progress is not interrupted and is still uploaded.
    expect(recorderStops()).toBe(0);
    ipcEmit("recorder:done", { buffer: new Uint8Array(100), durationSec: 15 });
    await settle(10);
    expect(h.api.uploadRecording).toHaveBeenCalledTimes(1);
    expect(recorderStarts()).toBe(2); // and the next one is already recording
  });

  it("pauses activity monitoring during a break and resumes after, recording throughout", async () => {
    await boot();
    h.api.getActiveWorkSession = vi.fn(async () => ({ ...activeSession, isOnBreak: true, breakRemainingSeconds: 1800 }));
    await settle(MIN + 10);
    expect(h.uiohook.stop).toHaveBeenCalledTimes(1);
    expect(trayLabels().some((l) => l.includes("On Break"))).toBe(true);
    expect(recorderStops()).toBe(0); // recording is not paused by a break

    h.api.getActiveWorkSession = vi.fn(async () => activeSession);
    await settle(MIN + 10);
    expect(h.uiohook.start).toHaveBeenCalledTimes(2);
  });
});

describe("screen recording is always on", () => {
  it("starts recording at launch without the employee ever clocking in", async () => {
    h.api.getActiveWorkSession = vi.fn(async () => null);
    await boot();
    expect(recorderStarts()).toBe(1);
    expect(h.uiohook.start).not.toHaveBeenCalled(); // activity counting still needs a clock-in
    expect(h.api.uploadActivityPing).not.toHaveBeenCalled();

    ipcEmit("recorder:done", { buffer: new Uint8Array(100), durationSec: 15 });
    await settle(10);
    expect(h.api.uploadRecording).toHaveBeenCalledTimes(1);
  });

  it("starts recording at launch even when the network is not up yet", async () => {
    h.api.getActiveWorkSession = vi.fn(async () => {
      throw new Error("network down");
    });
    await boot();
    expect(recorderStarts()).toBe(1);
  });

  it("keeps a clip for retry when it can't be uploaded while not clocked in", async () => {
    h.api.getActiveWorkSession = vi.fn(async () => null);
    h.api.uploadRecording = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    await boot();
    ipcEmit("recorder:done", { buffer: new Uint8Array(100), durationSec: 15 }); // fails, queued
    await settle(10);
    expect(h.api.uploadRecording).toHaveBeenCalledTimes(1);
    ipcEmit("recorder:done", { buffer: new Uint8Array(100), durationSec: 15 }); // succeeds, flushes the queue
    await settle(10);
    expect(h.api.uploadRecording).toHaveBeenCalledTimes(3);
  });

  it("stops when the person signs out (IT re-provisioning build, OMNIOS_ALLOW_SIGN_OUT=1)", async () => {
    process.env.OMNIOS_ALLOW_SIGN_OUT = "1";
    await boot();
    expect(recorderStarts()).toBe(1);
    h.trayHandlers["right-click"]();
    h.lastMenu.find((m) => m.label === "Sign out")!.click!();
    await settle(10);
    expect(recorderStops()).toBe(1);
  });
});

describe("signing out is confirmed and notified, same as quitting", () => {
  // These exercise Sign out itself, which is only reachable at all with
  // OMNIOS_ALLOW_SIGN_OUT=1 -- see "an employee has no sign-out path at all
  // by default" below for the normal, shipped behavior.
  beforeEach(() => {
    process.env.OMNIOS_ALLOW_SIGN_OUT = "1";
  });

  const clickSignOut = () => {
    h.trayHandlers["right-click"]();
    h.lastMenu.find((m) => m.label === "Sign out")!.click!();
  };

  it("asks first, warns that HR and Admin will be told, and notifies on confirm", async () => {
    await boot();
    clickSignOut();
    await settle(10);

    expect(h.dialog.showMessageBox).toHaveBeenCalledTimes(1);
    const opts = h.dialog.showMessageBox.mock.calls[0][0];
    expect(opts.detail).toContain("HR and Admin will be notified");
    expect(h.api.reportAgentSignOut).toHaveBeenCalledTimes(1);
    expect(h.auth.logoutApi).toHaveBeenCalledTimes(1);
    expect(loginWin()).toBeDefined();
  });

  it("Cancel keeps the person signed in and notifies nobody", async () => {
    h.dialog.showMessageBox = vi.fn(async () => ({ response: 0 })); // Cancel
    await boot();
    clickSignOut();
    await settle(10);

    expect(h.api.reportAgentSignOut).not.toHaveBeenCalled();
    expect(h.auth.logoutApi).not.toHaveBeenCalled();
    expect(recorderStops()).toBe(0);
    expect(recorderStarts()).toBe(1); // still recording
  });

  it("still signs out if the notification fails or hangs", async () => {
    h.api.reportAgentSignOut = vi.fn(() => new Promise(() => undefined)); // never resolves
    await boot();
    clickSignOut();
    await settle(10); // short wait, well under the notify timeout
    expect(loginWin()).toBeUndefined(); // still waiting

    await settle(4_000);
    expect(loginWin()).toBeDefined(); // gave up waiting and signed out anyway
  });

  it("clicking Sign out repeatedly shows only one dialog", async () => {
    await boot();
    clickSignOut();
    clickSignOut();
    clickSignOut();
    await settle(10);
    expect(h.dialog.showMessageBox).toHaveBeenCalledTimes(1);
  });
});

describe("an employee has no sign-out path at all by default", () => {
  it("the tray menu has no Sign out item (only Quit)", async () => {
    // beforeEach already deletes OMNIOS_ALLOW_SIGN_OUT -- this is the real
    // shipped behavior, not an opt-in.
    await boot();
    h.trayHandlers["right-click"]();
    expect(h.lastMenu.find((m) => m.label === "Sign out")).toBeUndefined();
    expect(h.lastMenu.find((m) => m.label === "Quit")).toBeDefined();
  });

  it("appears only when IT relaunches the agent with OMNIOS_ALLOW_SIGN_OUT=1", async () => {
    process.env.OMNIOS_ALLOW_SIGN_OUT = "1";
    await boot();
    h.trayHandlers["right-click"]();
    expect(h.lastMenu.find((m) => m.label === "Sign out")).toBeDefined();
  });
});

describe("staying signed in", () => {
  it("a 401 on an upload refreshes the token and retries instead of failing", async () => {
    await boot();
    const calls = h.api.uploadActivityPing.mock.calls.length;
    const err = Object.assign(new Error("Unauthorized"), { status: 401 });
    h.api.uploadActivityPing = vi.fn().mockRejectedValueOnce(err).mockResolvedValue(undefined);
    const refreshesBefore = h.auth.refreshAccessToken.mock.calls.length;

    await settle(MIN + 10); // next ping

    expect(h.auth.refreshAccessToken.mock.calls.length).toBe(refreshesBefore + 1);
    expect(h.api.uploadActivityPing).toHaveBeenCalledTimes(2);
    expect(h.api.uploadActivityPing.mock.calls[1][0]).not.toBe(h.api.uploadActivityPing.mock.calls[0][0]);
    expect(calls).toBeGreaterThan(0);
    expect(loginWin()).toBeUndefined(); // still signed in
  });

  it("waking from sleep refreshes the expired token straight away", async () => {
    await boot();
    const before = h.auth.refreshAccessToken.mock.calls.length;
    h.power["resume"]();
    await settle(10);
    expect(h.auth.refreshAccessToken.mock.calls.length).toBe(before + 1);
  });

  it("keeps retrying after wake while the network is still down, and never signs out", async () => {
    await boot();
    const down = new TypeError("fetch failed");
    h.auth.refreshAccessToken = vi
      .fn()
      .mockRejectedValueOnce(down)
      .mockRejectedValueOnce(down)
      .mockImplementation(async () => authOk());

    h.power["unlock-screen"]();
    await settle(10);
    expect(h.auth.refreshAccessToken).toHaveBeenCalledTimes(1);
    await settle(15_000);
    expect(h.auth.refreshAccessToken).toHaveBeenCalledTimes(2);
    await settle(15_000);
    expect(h.auth.refreshAccessToken).toHaveBeenCalledTimes(3); // network back -- succeeds

    expect(loginWin()).toBeUndefined();
    expect(h.auth.logoutApi).not.toHaveBeenCalled();
  });

  it("overlapping refreshes (wake + wake-unlock) cost a single refresh", async () => {
    await boot();
    const before = h.auth.refreshAccessToken.mock.calls.length;
    let release!: () => void;
    h.auth.refreshAccessToken = vi.fn(
      () =>
        new Promise((resolve) => {
          release = () => resolve(authOk());
        }),
    );
    h.power["resume"]();
    h.power["unlock-screen"]();
    await settle(10);
    expect(h.auth.refreshAccessToken).toHaveBeenCalledTimes(1);
    release();
    await settle(10);
    expect(before).toBeGreaterThan(0);
  });

  it("a transient server error (5xx) on the periodic refresh does not sign out", async () => {
    await boot();
    const badGateway = await authError("Bad gateway", 502);
    h.auth.refreshAccessToken = vi.fn(async () => {
      throw badGateway;
    });
    await settle(10 * MIN + 10);
    expect(h.auth.refreshAccessToken).toHaveBeenCalled();
    expect(loginWin()).toBeUndefined();
    expect(h.auth.logoutApi).not.toHaveBeenCalled();
    expect(h.stored).not.toBeNull();
  });
});

describe("signing out", () => {
  it("when the SERVER rejects the token, signs out locally WITHOUT calling the server logout", async () => {
    await boot();
    const rejected = await authError("Invalid refresh token", 401);
    h.auth.refreshAccessToken = vi.fn(async () => {
      throw rejected;
    });
    await settle(10 * MIN + 10);

    expect(loginWin()).toBeDefined(); // asked to log in again
    expect(h.stored).toBeNull();
    // The server's logout ends EVERY session this user has -- an involuntary,
    // stale-token sign-out must not trigger it.
    expect(h.auth.logoutApi).not.toHaveBeenCalled();
    expect(h.uiohook.stop).toHaveBeenCalled();
  });

  it("first tries a newer token before giving up", async () => {
    await boot();
    h.stored = "newer-token-from-another-process";
    const stale = await authError("stale", 401);
    h.auth.refreshAccessToken = vi
      .fn()
      .mockRejectedValueOnce(stale)
      .mockImplementation(async () => authOk());
    await settle(10 * MIN + 10);

    expect(h.auth.refreshAccessToken).toHaveBeenNthCalledWith(2, "newer-token-from-another-process");
    expect(loginWin()).toBeUndefined();
  });

  it("when the USER chooses Sign out, it does revoke the server session", async () => {
    process.env.OMNIOS_ALLOW_SIGN_OUT = "1";
    await boot();
    h.trayHandlers["right-click"]();
    h.lastMenu.find((m) => m.label === "Sign out")!.click!();
    await settle(10);

    expect(h.auth.logoutApi).toHaveBeenCalledTimes(1);
    expect(loginWin()).toBeDefined();
    expect(h.stored).toBeNull();
  });

  it("forgets the previous account's clock-in state, so the next user is not monitored by mistake", async () => {
    process.env.OMNIOS_ALLOW_SIGN_OUT = "1";
    await boot();
    h.trayHandlers["right-click"]();
    h.lastMenu.find((m) => m.label === "Sign out")!.click!();
    await settle(10);
    expect(trayLabels()).toContain("Signed out");

    // A different account signs in and is NOT clocked in.
    h.api.getActiveWorkSession = vi.fn(async () => null);
    h.uiohook.start.mockClear();
    await h.ipcHandle["login"]({}, { email: "b@x.com", password: "pw" });
    await settle(50);
    mainWin()?.emit("ready-to-show");
    await settle(50);

    expect(h.uiohook.start).not.toHaveBeenCalled();
    expect(trayLabels()).toContain("Not clocked in — monitoring paused");
  });

  it("clears the website's localStorage too, so the next account never sees the previous user", async () => {
    process.env.OMNIOS_ALLOW_SIGN_OUT = "1";
    await boot();
    h.trayHandlers["right-click"]();
    h.lastMenu.find((m) => m.label === "Sign out")!.click!();
    await settle(10);

    expect(h.clearedStorages).toContainEqual(expect.arrayContaining(["cookies", "localstorage"]));
  });

  it("signing out inside the CRM window signs the agent out right away, not 10 minutes later", async () => {
    await boot();
    const rejected = await authError("Invalid refresh token", 401);
    h.auth.refreshAccessToken = vi.fn(async () => {
      throw rejected;
    });
    // The website's logout response clears the refreshToken cookie.
    h.cookieListener!({}, { name: "refreshToken", value: "" }, "expired-overwrite", true);
    await settle(10);

    expect(loginWin()).toBeDefined();
    expect(h.auth.logoutApi).not.toHaveBeenCalled();
  });

  it("a cookie rotation (overwrite) is not mistaken for a sign-out", async () => {
    await boot();
    h.auth.refreshAccessToken.mockClear();
    h.cookieListener!({}, { name: "refreshToken", value: "old" }, "overwrite", true);
    await settle(10);

    expect(h.auth.refreshAccessToken).not.toHaveBeenCalled();
    expect(loginWin()).toBeUndefined();
  });

  it("signing out inside the CRM window stops monitoring even if the agent's own sign-in would still refresh", async () => {
    await boot();
    h.auth.refreshAccessToken.mockClear();
    h.cookieListener!({}, { name: "refreshToken", value: "" }, "expired-overwrite", true);
    await settle(10);

    expect(h.auth.refreshAccessToken).not.toHaveBeenCalled();
    expect(loginWin()).toBeDefined();
    expect(h.uiohook.stop).toHaveBeenCalled();
    expect(h.auth.logoutApi).not.toHaveBeenCalled(); // the website already ended the session
  });
});

describe("switching to a different person never records under the wrong name", () => {
  const otherUser = { id: "u2", email: "other@x.com", firstName: "O", lastName: "T" };
  /** The next refresh comes back as someone else (they signed in in the CRM window). */
  async function switchToOtherUser() {
    h.auth.refreshAccessToken = vi.fn(async () => ({ ...authOk(), user: otherUser }));
    h.cookieListener!({}, { name: "refreshToken", value: "" }, "explicit", true);
    await settle(10);
  }
  const uploadedSizes = () => h.api.uploadRecording.mock.calls.map((c: any[]) => c[1].length);

  it("throws away the clip that was recording when the account changed", async () => {
    await boot();
    expect(recorderStarts()).toBe(1);

    await switchToOtherUser();
    expect(recorderStops()).toBe(1);
    ipcEmit("recorder:done", { buffer: new Uint8Array(100), durationSec: 15 });
    await settle(10);

    expect(h.api.uploadRecording).not.toHaveBeenCalled();
    expect(trayLabels()).toContain("Signed in as other@x.com");
  });

  it("never sends the previous person's failed clips as the new person", async () => {
    await boot();
    h.api.uploadRecording = vi.fn().mockRejectedValueOnce(new Error("network down")).mockResolvedValue(undefined);
    ipcEmit("recorder:done", { buffer: new Uint8Array(100), durationSec: 15 }); // u1's clip: fails, queued for retry
    await settle(10);
    expect(h.api.uploadRecording).toHaveBeenCalledTimes(1);

    await switchToOtherUser();
    // The recorder answers the stop with u1's partial clip -- discarded, never uploaded.
    ipcEmit("recorder:done", { buffer: new Uint8Array(150), durationSec: 15 });
    await settle(MIN); // u2 clocked in: a fresh clip starts
    ipcEmit("recorder:done", { buffer: new Uint8Array(200), durationSec: 15 }); // u2's clip
    await settle(10);

    expect(uploadedSizes()).toEqual([100, 200]); // u1's clip was never retried
  });

  it("does not re-send a clip after a sign-in refresh that comes back as someone else", async () => {
    await boot();
    h.api.uploadRecording = vi.fn().mockRejectedValueOnce(Object.assign(new Error("expired"), { status: 401 }));
    h.auth.refreshAccessToken = vi.fn(async () => ({ ...authOk(), user: otherUser }));
    ipcEmit("recorder:done", { buffer: new Uint8Array(100), durationSec: 15 });
    await settle(10);

    expect(h.api.uploadRecording).toHaveBeenCalledTimes(1); // not retried with u2's token
    expect(trayLabels()).toContain("Signed in as other@x.com");
  });
});

describe("only one copy of the app", () => {
  it("a second launch quits itself and does not start a second agent", async () => {
    h.lock = false;
    await import("./main");
    await settle(50);

    expect(h.appQuit).toHaveBeenCalled();
    expect(h.auth.refreshAccessToken).not.toHaveBeenCalled();
    expect(h.windows.length).toBe(0); // no recorder, no tray, no windows
  });

  it("the first copy brings its window forward when a second launch is attempted", async () => {
    await boot();
    mainWin().close(); // hidden to the tray
    expect(mainWin().visible).toBe(false);

    h.appHandlers["second-instance"]({}, ["Venus CRM.exe"]);
    await settle(10);
    expect(mainWin().visible).toBe(true);
  });

  it("the first copy shows the sign-in window if nobody is signed in", async () => {
    h.stored = null;
    await import("./main");
    await settle(50);
    expect(loginWin()).toBeDefined();

    loginWin().visible = false;
    h.appHandlers["second-instance"]({}, ["Venus CRM.exe"]);
    await settle(10);
    expect(h.windows.filter((w) => w.file.includes("login.html") && !w.destroyed).length).toBe(1);
  });
});

describe("'Are you still working?' after 5 minutes idle", () => {
  const idleWin = () => winBy((w) => w.file.includes("idle.html") && !w.destroyed);

  it("does not ask while the person is active", async () => {
    await boot();
    h.idleSeconds = 4 * 60;
    await settle(10_000);
    expect(idleWin()).toBeUndefined();
  });

  it("asks once there's been no input for 5 minutes, and sends the reason with the idle time", async () => {
    await boot();
    const startedAt = Date.now();
    h.idleSeconds = 5 * 60;
    await settle(2_100);
    expect(idleWin()).toBeDefined();

    // Still away for 7 more minutes, then comes back.
    for (let s = 0; s < 7 * 60; s += 2) {
      h.idleSeconds += 2;
      await settle(2_000);
    }
    h.idleSeconds = 0;
    await settle(2_100);

    const info = await h.ipcHandle["idle:get"]({});
    // Within one 2-second check of when input actually stopped.
    expect(Math.abs(Date.parse(info.idleStartedAt) - (startedAt - 5 * 60 * 1000))).toBeLessThanOrEqual(2_100);

    const result = await h.ipcHandle["idle:submit"]({}, "In a meeting");
    expect(result).toEqual({ ok: true });
    expect(h.api.submitIdleReason).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ idleMinutes: 12, reason: "In a meeting" }),
    );
    expect(idleWin()).toBeUndefined();
  });

  it("can't be closed without answering", async () => {
    await boot();
    h.idleSeconds = 5 * 60;
    await settle(2_100);
    idleWin().close();
    expect(idleWin()).toBeDefined();
  });

  it("keeps the window open and shows the error if sending fails", async () => {
    await boot();
    h.idleSeconds = 5 * 60;
    await settle(2_100);
    h.api.submitIdleReason = vi.fn(async () => {
      throw Object.assign(new Error("Network down"), { status: 503 });
    });

    expect(await h.ipcHandle["idle:submit"]({}, "On a call")).toEqual({ ok: false, error: "Network down" });
    expect(idleWin()).toBeDefined();
  });

  it("goes away without asking when the person clocks out", async () => {
    await boot();
    h.idleSeconds = 5 * 60;
    await settle(2_100);
    expect(idleWin()).toBeDefined();

    h.api.getActiveWorkSession = vi.fn(async () => null);
    await settle(MIN);
    expect(idleWin()).toBeUndefined();
    expect(h.api.submitIdleReason).not.toHaveBeenCalled();
  });

  it("never asks during a break", async () => {
    h.api.getActiveWorkSession = vi.fn(async () => ({ ...activeSession, isOnBreak: true }));
    await boot();
    h.idleSeconds = 30 * 60;
    await settle(10_000);
    expect(idleWin()).toBeUndefined();
  });
});

describe("the CRM window never stays blank", () => {
  it("shows the reconnecting page when the site can't be reached, then retries by itself", async () => {
    await boot();
    const w = mainWin();
    w.webContents.emit("did-fail-load", -106, "ERR_INTERNET_DISCONNECTED", "https://crm.venusglobaltech.com/", true);
    expect(w.webContents.getURL()).toContain("offline.html");

    await settle(8_100);
    expect(w.webContents.getURL()).toBe("https://crm.venusglobaltech.com");
  });

  it("treats a server error page (e.g. 502 during a redeploy) the same way", async () => {
    await boot();
    const w = mainWin();
    w.webContents.emit("did-navigate", "https://crm.venusglobaltech.com/", 502);
    expect(w.webContents.getURL()).toContain("offline.html");
  });

  it("stops retrying once the CRM has loaded", async () => {
    await boot();
    const w = mainWin();
    w.webContents.emit("did-fail-load", -105, "ERR_NAME_NOT_RESOLVED", "https://crm.venusglobaltech.com/", true);
    await settle(8_100); // retried
    w.webContents.emit("did-finish-load");
    const loadsBefore = w.loads.length;
    await settle(60_000);
    expect(w.loads.length).toBe(loadsBefore);
  });

  it("ignores aborted navigations and failures inside sub-frames", async () => {
    await boot();
    const w = mainWin();
    w.webContents.emit("did-fail-load", -3, "ERR_ABORTED", "https://crm.venusglobaltech.com/", true);
    w.webContents.emit("did-fail-load", -106, "ERR_INTERNET_DISCONNECTED", "https://ads.example.com/", false);
    expect(w.webContents.getURL()).toBe("https://crm.venusglobaltech.com");
  });

  it("a crashed page comes back through the reconnecting page, not a tight reload loop", async () => {
    await boot();
    const w = mainWin();
    w.webContents.emit("render-process-gone", { reason: "crashed" });
    expect(w.webContents.getURL()).toContain("offline.html");
    await settle(8_100);
    expect(w.webContents.getURL()).toBe("https://crm.venusglobaltech.com");
  });
});
