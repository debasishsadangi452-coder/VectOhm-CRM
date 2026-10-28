import {
  app,
  Tray,
  Menu,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  dialog,
  nativeImage,
  powerMonitor,
  session,
  systemPreferences,
} from "electron";
import * as path from "path";
import { uIOhook } from "uiohook-napi";
import {
  login,
  logoutApi,
  refreshAccessToken,
  acceptTerms,
  TokenStore,
  API_URL,
  type AuthUser,
} from "./auth";
import { isInvalidRefreshToken } from "./auth-error";
import {
  describeMonitoringStatus,
  getMonitoringStatus,
  shouldMonitor,
  shouldRecord,
} from "./monitoring-state";
import { singleFlight } from "./single-flight";
import {
  getActiveWorkSession,
  uploadRecording,
  uploadActivityPing,
  reportAgentQuit,
  reportAgentSignOut,
  submitIdleReason,
  type ActiveSessionInfo,
} from "./api";
import { idleMinutesToReport, shouldPromptForIdle, type IdleStretch } from "./idle-prompt";

// Without these, an uncaught exception or unhandled rejection ANYWHERE in
// the main process (unlike a renderer crash, which Electron isolates) kills
// the entire app -- window, tray icon, background monitoring, all of it,
// with no dialog and no trace beyond stderr. This is a background tray app
// meant to run unattended for a full 8+ hour shift; one bad edge case (a
// malformed IPC payload, a webContents call racing a renderer crash) should
// never be able to take the whole thing down. Registered first, before
// anything else can throw.
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception (main process kept running):", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection (main process kept running):", reason);
});

// Only ever one copy of this app. It launches itself at OS login, so without
// this a second launch (Start menu, desktop shortcut, double-click) would run a
// second agent next to the first: two recorders, two activity-ping loops, two
// tray icons, and two copies rotating the same refresh token against each
// other. The second launch just brings the first one forward and exits.
const WATCHDOG_FLAG = "--watchdog";
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    // The Windows watchdog (build/installer.nsh) launches the exe every few
    // minutes just to check the agent is alive. That must stay invisible --
    // only a person opening the app should bring the window forward.
    if (argv.includes(WATCHDOG_FLAG)) return;
    if (currentUser) openMainWindow();
    else showLoginWindow();
  });
}

// The actual CRM website -- this app is now a native-feeling shell around it
// (same idea as how Slack/Discord "apps" are their web app in a window),
// not just a background monitor. Overridable for local dev, e.g.
// OMNIOS_WEB_URL=http://localhost:8081.
const WEB_URL = process.env.OMNIOS_WEB_URL ?? "https://crm.venusglobaltech.com";

// Whether the tray menu offers "Sign out" at all. Company laptops are
// provisioned once by IT (one sign-in, one monitoring-notice acceptance) and
// from then on are meant to keep recording unattended for as long as the
// laptop is on -- an employee signing themselves out would be a quiet way to
// stop that without the friction Quit already has (a warning, an HR/Admin
// notification, and the watchdog bringing the app back within minutes). Off
// by default, so the employee-facing build has no sign-out path at all; IT
// sets this when relaunching the agent to re-provision a laptop (reassigning
// it to someone else, or resetting it before a handover).
const ALLOW_SIGN_OUT = process.env.OMNIOS_ALLOW_SIGN_OUT === "1";

// The same "V" brand mark as the website's favicon (see
// ../../public/favicon.svg), rendered by scripts/generate-icons.mjs and
// inlined here so the running app never depends on a separate asset file
// existing on disk at runtime. Used as each BrowserWindow's `icon` option --
// without this, Electron falls back to its own default icon for whatever's
// actually on screen/in the taskbar/Alt-Tab while a window is open, which is
// a different (and lower-resolution) thing than the installer/shortcut icon
// set in package.json's "build.icon".
const APP_ICON_DATA_URL =
  "data:image/png;base64,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";

// Same brand mark, rendered small (32px) and inlined the same way -- kept
// separate from APP_ICON_DATA_URL above because the tray wants a small,
// crisp icon while window icons render best from a larger source.
const TRAY_ICON_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAABOvAAATrwFj5o7DAAACzElEQVRYhcWXTU8TURSGZ6P+Fz9+jisp7dCZFpSq2BaEgoDSFkwgNBi0UVEkIZLAQg2JRCTRxBjjClsW4AKjJJhotL0fnbZ0esyZ2w5gJZkZbHuSky7a9HnPx703ryT9FT4fPedXMgm/mk23q4R1qAQ6FAIXFQKXKtlZyYBC4LJX5BUvgateamQXZhuFayJZUCbpkEwmg230rHRUBAJwyqdkp31KRverBNoRfEx4sJKhNgphTJmUwh5yZ/A8nPwXfM2vZqF+cArdZrLXh0SoavZuo+A9MoPrMsPPKXPm9W17LRyzV6al/lZ6RhIL12g4gz4Pgz43m5B8SnajKXAPg4ibpSS/QmhT4EIAkZoG9zDo9zCQrMLnZ/KwMJuHuaR2JHxuWoOlx3l4el+zBB9AAVYrT6/vAUa5DDDSzWvgQwEGum78BNY/7FmCD7gZSFbb/iSpiX8HgBcL+Zq2Y+XVmE1oluA3qgKszLy7nYKWKxuAr9t6zcy30iXjO87KEFGtwQdRgJ2F+/hOjAFjrJeb8IPtf79WtAwfdHMhwOq2J8dzpoCXSwVz2xcf7bf/XkyzDB9CAXaOWthLIfNLjGH3m24etc2UaP/vn2WIyNbhhgC75/ztStGsdqI/B8OdHEqVyaw9L9qCD1cF2LlkEsPcFLD6rAiLM/vtn4zkbMFvtnKQnNxw33fExv3Y1WHzk2j/zrZuG24IcHK9riwVzKrxYsJYni/Yht+qCrB7t4+GuAmuihjr4rbhIyjA6cPyZUu0HuNzquQILgQ4fNUe3tbgzXLRyAdxzRE8igL+x5PqFB51oQCZkmbBYy6exQ5sNAkOcRdPSehYmgSHeAsfl9AuoWNpNDzm4qXohfxpwxugXWpo5a4cZsJ0RmiTemS22ij4aAt/lfTBiUP+sCJiCh1LPduOldfADwbaJXQsaBr63IweH84objsunDnzA/EH8zcHRsBNlmUAAAAASUVORK5CYII=";

// Overridable for local testing (e.g. OMNIOS_CAPTURE_MIN_MINUTES=0.1) --
// waiting the full production interval just to confirm the pipeline works
// makes verification painfully slow.
// Screen *recording* schedule, replacing the old 1-3 minute screenshot loop.
// A clip runs for RECORD_SECONDS starting at every SLOT_MINUTES boundary of
// the hour -- at :00, :20 and :40 -- which is exactly 3 clips an hour, so a
// 9-hour shift produces 27. Aligning to wall-clock boundaries (rather than
// "wait 20 minutes from whenever we started") keeps the count per hour exact
// no matter when the employee clocks in.
//
// SLOT_MINUTES = 0 (the default) means CONTINUOUS recording instead: clips run
// back to back, each RECORD_SECONDS long, for as long as monitoring is active,
// and each is uploaded in the background while the next one records -- idle
// stretches included. Set OMNIOS_RECORD_SLOT_MINUTES=20 to go back to 3 clips an hour.
const RECORD_SECONDS = Number(process.env.OMNIOS_RECORD_SECONDS ?? 180); // 3-minute clips
const SLOT_MINUTES = Number(process.env.OMNIOS_RECORD_SLOT_MINUTES ?? 0);
const CONTINUOUS_RECORDING = !(SLOT_MINUTES > 0);

// Deliberately small: a full-resolution clip adds up fast across 27 slots per
// employee per day. Bitrate is the lever that actually matters for size here,
// not resolution/fps -- office-app screen content is mostly static between
// frames, so VP9 already compresses it hard, and keeping the full 720p frame
// (rather than downscaling) is what keeps on-screen text legible for review.
// 110kbps at 4fps puts a 3-minute clip at roughly 2.5MB while
// keeping text and UI elements crystal-clear.
const RECORD_WIDTH = Number(process.env.OMNIOS_RECORD_WIDTH ?? 1280);
const RECORD_HEIGHT = Number(process.env.OMNIOS_RECORD_HEIGHT ?? 720);
const RECORD_FPS = Number(process.env.OMNIOS_RECORD_FPS ?? 4);
const RECORD_BITRATE = Number(process.env.OMNIOS_RECORD_BITRATE ?? 110_000);

// A clip cut short (stopped moments after it started) has nothing worth
// uploading. Matches the ~1 keyframe minimum a webm needs to even be a valid,
// playable file.
const MIN_RECORDING_SECONDS = 5;

const MAX_RETRY_QUEUE = 3;
const SESSION_POLL_MS = 60_000;
// How often to report the OS idle-time signal (see reportActivity below).
// Independent of the screenshot cadence above -- activity pings are much
// cheaper than an image upload, so they run on their own steady clock.
const ACTIVITY_PING_MS = 60_000;
// Mirrors the server's ACTIVE_THRESHOLD_SECONDS -- only used here to decide
// what to show in the tray, the server independently derives its own
// active/idle flag from the raw idleSeconds it's sent.
const ACTIVE_THRESHOLD_SECONDS = 90;
// Rolling window for the tray's "recent activity" display -- 15 pings at
// the 60s cadence above is the last ~15 minutes.
const ACTIVITY_HISTORY_SIZE = 15;
// Access tokens are short-lived (15m server-side default) -- refresh well
// before that so a capture/session-poll never races an expiry.
const TOKEN_REFRESH_MS = 10 * 60_000;

// Decoded once at module load and reused for every window -- see
// APP_ICON_DATA_URL above for why this needs to be set explicitly per window.
const appIcon = nativeImage.createFromDataURL(APP_ICON_DATA_URL);

let tray: Tray | null = null;
let loginWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;
let termsWindow: BrowserWindow | null = null;
// Set right before showTermsWindow() so the terms renderer has something to
// fetch via the "terms:get" IPC channel; cleared once handled.
let pendingTerms: { version: string; text: string } | null = null;
// Set right before a real quit (tray "Quit", Cmd+Q, etc.) so the main
// window's close handler knows to actually close instead of hiding to tray.
let quitting = false;

let accessToken: string | null = null;
let refreshCookie: string | null = null;
let currentUser: AuthUser | null = null;

let sessionPollTimer: NodeJS.Timeout | null = null;
let captureTimer: NodeJS.Timeout | null = null;
let recorderWindow: BrowserWindow | null = null;
let recordingInFlight = false;
// Set when the server refuses this account's department (403). Cleared on
// the next sign-in, since a different account may well be covered.
let recordingDisabled = false;
let activityPingTimer: NodeJS.Timeout | null = null;
let tokenRefreshTimer: NodeJS.Timeout | null = null;
let clockedIn = false;
let onBreak = false;
let breakRemainingSec = 0;

// Surfaced in the tray menu so "is this actually working" is answerable by
// hovering/clicking the tray icon, not by guessing from logs.
let lastCaptureAt: Date | null = null;
let lastCaptureError: string | null = null;
// Recent active/idle results (newest last), for the tray's rolling
// "activity" percentage -- see reportActivity.
const activityHistory: boolean[] = [];
let lastActivityError: string | null = null;

// Keystroke/click COUNTS since the last successful ping -- see the
// "input counters" section below for why these can only ever be numbers,
// never key/click content. lastReported* are just what the tray displays
// (most recent successfully-uploaded counts), same transparency purpose as
// lastCaptureAt.
let keystrokeCounter = 0;
let clickCounter = 0;
let lastReportedKeystrokes = 0;
let lastReportedClicks = 0;
let inputHookRunning = false;
// macOS: whether the Accessibility permission prompt has been shown this run (see startInputCounters).
let accessibilityPrompted = false;

// Captures are only ever held in memory, never written to disk. If an
// upload fails (offline, VPN drop, etc.) a few of the most recent ones wait
// here for the next successful upload to flush them -- unbounded retry
// would risk silently accumulating captures forever while offline, which is
// worse than just dropping old ones.
// `owner`: the user the clip was recorded for; it is only ever uploaded as them.
const retryQueue: Array<{ webm: Buffer; durationSec: number; owner: string; thumbnail?: Buffer }> = [];

let tokenStore: TokenStore;

app.whenReady().then(async () => {
  // A duplicate launch is already quitting (see above) -- don't start a second agent.
  if (!gotSingleInstanceLock) return;
  if (process.platform === "win32") {
    app.setAppUserModelId("com.venuscrm.desktopagent");
  }
  tokenStore = new TokenStore(app.getPath("userData"));
  // Launches quietly at OS login, same as Slack/Discord -- the point of a
  // tray-resident app is that it's already running when the workday starts,
  // not something the employee has to remember to open.
  app.setLoginItemSettings({ openAtLogin: true });
  // Older builds registered the start-at-login entry under Electron's default
  // name ("electron.app.Electron") before the app ID above existed, so those
  // machines launch the app twice at sign-in (the second copy just exits).
  // Remove that leftover entry; the one above is the real one.
  if (process.platform === "win32") {
    app.setLoginItemSettings({ openAtLogin: false, name: "electron.app.Electron" });
  }
  // No-op on Windows; sets the Dock icon on macOS (a Windows build has no
  // dock, but this keeps a future mac build correct without extra work).
  app.dock?.setIcon?.(appIcon);
  createTray();
  createRecorderWindow();
  ipcMain.handle("login", handleLoginRequest);
  ipcMain.handle("terms:get", () => pendingTerms);
  ipcMain.handle("terms:accept", handleTermsAccept);
  ipcMain.handle("terms:decline", handleTermsDecline);
  ipcMain.handle("idle:get", () =>
    idleStretch ? { idleStartedAt: new Date(idleStretch.startedAtMs).toISOString() } : null,
  );
  ipcMain.handle("idle:submit", (_event, reason: string) => handleIdleReason(reason));
  // Read synchronously by web-preload.ts before the website boots, so the CRM
  // window opens already signed in instead of showing a second sign-in page.
  ipcMain.on("web-auth:seed", (event) => {
    let origin: string | null = null;
    try {
      origin = new URL(WEB_URL).origin;
    } catch {}
    event.returnValue =
      currentUser && accessToken && origin ? { origin, user: currentUser, accessToken } : null;
  });

  // Keep desktop-agent's refresh token in sync with silent refreshes in the CRM web window
  session.defaultSession.cookies.on("changed", (_event, cookie, cause, removed) => {
    if (cookie.name !== "refreshToken") return;
    if (!removed && cookie.value) {
      if (refreshCookie !== cookie.value) {
        refreshCookie = cookie.value;
        tokenStore.save(cookie.value);
      }
      return;
    }
    // "overwrite" is just a rotation (the new value arrives as its own event).
    if (!removed || cause === "overwrite" || !currentUser) return;
    // The server clearing the cookie ("expired-overwrite") means the employee
    // clicked Sign out inside the CRM window. The app shares that session, so it
    // signs out too, at once -- otherwise the next person to sign in there would
    // be recorded under this one's name. The server already ended the session.
    if (cause === "expired-overwrite") {
      signOut({ revokeServerSession: false });
      return;
    }
    // Any other removal may or may not mean the session ended: check now instead
    // of waiting for the next 10-minute tick. refreshSession() only signs out on a
    // real 401, so a false alarm is harmless.
    void refreshSession();
  });

  // After sleep / screen lock the 15-minute access token has long expired and
  // the network is often not back yet. Refresh right away (retrying while the
  // connection comes back) instead of leaving monitoring silently dead until
  // the next 10-minute timer tick.
  powerMonitor.on("resume", handleSystemWake);
  powerMonitor.on("unlock-screen", handleSystemWake);

  await bootstrapAuth();
});

app.on("window-all-closed", () => {
  // Tray-resident app -- closing a window should never quit it (see the
  // main window's own "close" handler below, which hides rather than closes).
});

app.on("before-quit", () => {
  quitting = true;
});

// Hidden, never-shown window that exists only to run MediaRecorder -- the
// main process has no getUserMedia/MediaRecorder, so screen video must be
// captured in a renderer. It loads a local file and holds no session; node
// integration is on purely so it can talk back over ipcRenderer.
function createRecorderWindow() {
  if (recorderWindow) return;
  recorderWindow = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false, backgroundThrottling: false },
  });
  recorderWindow.loadFile(path.join(__dirname, "..", "renderer", "recorder.html"));
  recorderWindow.on("closed", () => {
    recorderWindow = null;
  });
  // A hidden window doing continuous desktopCapturer + MediaRecorder work for
  // hours a day is exactly the kind of renderer that can hit a GPU/driver
  // crash. Without this, a crashed recorder renderer leaves recorderWindow
  // pointing at a destroyed webContents forever -- every future
  // recordAndUpload() call would throw trying to .send() to it. Recreate it
  // instead so the next scheduled slot can just try again.
  recorderWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("Recorder renderer process gone, recreating:", details.reason);
    recorderWindow = null;
    createRecorderWindow();
  });
}

function createTray() {
  const icon = nativeImage.createFromDataURL(TRAY_ICON_DATA_URL);
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip("Venus CRM");
  // Deliberately not using Tray.setContextMenu -- that makes every click
  // (left or right) pop the menu on some platforms, which would fight with
  // wanting a plain left-click to just open the app like any other tray
  // app. Left-click opens the window; right-click shows the status/quit menu.
  tray.on("click", openMainWindow);
  tray.on("right-click", () => tray?.popUpContextMenu(buildTrayMenu()));
  refreshTrayMenu();
}

// Single source of truth for the tray menu, rebuilt from current state --
// so "is this actually working" is answerable by right-clicking the tray
// icon (last capture time, last error) instead of digging through logs.
function buildTrayMenu(): Menu {
  const lines: string[] = [];
  if (!currentUser) {
    lines.push("Signed out");
  } else {
    lines.push(`Signed in as ${currentUser.email}`);
    lines.push(describeMonitoringStatus(getMonitoringStatus(monitoringInputs()), Math.floor(breakRemainingSec / 60)));
    lines.push(
      recordingDisabled
        ? "Screen recording: off for this account"
        : "Screen recording: always on while signed in",
    );
    lines.push(lastCaptureAt ? `Last capture: ${lastCaptureAt.toLocaleTimeString()}` : "Last capture: none yet");
    if (lastCaptureError) {
      lines.push(`Last error: ${lastCaptureError}`);
    }
    if (activityHistory.length > 0) {
      const activeCount = activityHistory.filter(Boolean).length;
      const percent = Math.round((activeCount / activityHistory.length) * 100);
      lines.push(`Activity (last ${activityHistory.length} min): ${percent}%`);
      lines.push(`Last minute: ${lastReportedKeystrokes} keystrokes, ${lastReportedClicks} clicks`);
    }
    if (lastActivityError) {
      lines.push(`Activity ping error: ${lastActivityError}`);
    }
  }
  return Menu.buildFromTemplate([
    { label: "Open Venus CRM", click: openMainWindow },
    { type: "separator" },
    ...lines.map((label) => ({ label, enabled: false })),
    { type: "separator" },
    // Not present at all by default -- see ALLOW_SIGN_OUT above.
    ...(ALLOW_SIGN_OUT
      ? [{ label: "Sign out", click: () => void requestSignOut(), enabled: !!currentUser }]
      : []),
    { label: "Quit", click: () => void requestQuit() },
  ]);
}

// Kept as a no-op-shaped hook so every place that changes auth/capture/
// activity state can keep calling "refreshTrayMenu()" without needing to
// know the menu is now built lazily on right-click rather than eagerly
// pushed to the OS -- the tooltip is the one piece worth updating eagerly,
// since it's visible without any click at all.
function refreshTrayMenu() {
  if (!tray) return;
  tray.setToolTip(currentUser ? `Venus CRM — ${currentUser.email}` : "Venus CRM");
}

// Only a 401 (see isInvalidRefreshToken) means the server genuinely rejected
// the refresh token -- the one case where forgetting the session and asking to
// log in again is correct. Anything else (no response, a 5xx, DNS not resolved
// yet after waking from sleep) is transient and must never be a sign-out.

const BOOTSTRAP_RETRY_MS = 15_000;
// Don't hold the app open waiting on a slow network when the person has
// already chosen to quit.
const QUIT_NOTIFY_TIMEOUT_MS = 4_000;
const WAKE_RETRY_MS = 15_000;

async function bootstrapAuth() {
  let stored = tokenStore.load();
  if (!stored) {
    try {
      const cookies = await session.defaultSession.cookies.get({ name: "refreshToken" });
      if (cookies.length > 0 && cookies[0].value) {
        stored = cookies[0].value;
      }
    } catch {}
  }

  if (!stored) {
    showLoginWindow();
    return;
  }
  try {
    await applyAuthResult(await refreshAccessToken(stored), { openWindow: true });
  } catch (err) {
    if (isInvalidRefreshToken(err)) {
      // Attempt recovery from session cookie jar before clearing
      let recovered = false;
      try {
        const cookies = await session.defaultSession.cookies.get({ name: "refreshToken" });
        if (cookies.length > 0 && cookies[0].value && cookies[0].value !== stored) {
          await applyAuthResult(await refreshAccessToken(cookies[0].value), { openWindow: true });
          recovered = true;
        }
      } catch {}

      if (!recovered) {
        tokenStore.clear();
        showLoginWindow();
      }
    } else {
      console.error("Startup token refresh failed transiently, retrying shortly", err);
      setTimeout(bootstrapAuth, BOOTSTRAP_RETRY_MS);
    }
  }
}

// `openWindow` only true for an actual sign-in (fresh login, or the silent
// bootstrap refresh at app startup) -- this function also runs every 10
// minutes from the token-refresh loop just to keep the access token and
// injected cookie current, and that must never yank the main window back
// open/focused if the employee had deliberately closed or minimized it.
async function applyAuthResult(
  result: {
    accessToken: string;
    refreshCookie: string;
    user: AuthUser;
    termsAccepted: boolean;
    termsVersion: string;
    termsText: string;
  },
  { openWindow = false }: { openWindow?: boolean } = {},
) {
  // A different person than before: whatever was recorded or counted for the
  // previous one is theirs, never the new account's.
  if (currentUser && currentUser.id !== result.user.id) resetAccountState();
  accessToken = result.accessToken;
  refreshCookie = result.refreshCookie;
  currentUser = result.user;
  idlePromptMinutes = 0; // off until the server confirms this account's limit (Admins stay 0)
  // A different account may be in a recorded department even if the last one
  // wasn't, so give recording a clean slate on every sign-in.
  recordingDisabled = false;
  tokenStore.save(result.refreshCookie);
  refreshTrayMenu();
  loginWindow?.close();
  startTokenRefreshLoop();
  await injectWebSessionCookie(result.refreshCookie);

  if (!result.termsAccepted) {
    // Monitoring stays off until the employee explicitly accepts the current
    // notice -- startSessionPolling() (which arms the screen-recording and
    // activity loops) is deliberately NOT called on this path. openWindow is
    // false on the periodic 10-minute refresh, so a mid-session version bump
    // won't pop this over someone's work; it's enforced at their next real
    // login/app restart instead, not revoked live mid-session.
    if (openWindow) showTermsWindow(result.termsVersion, result.termsText);
    return;
  }
  startSessionPolling();
  if (openWindow) openMainWindow();
}

// Signing into the tray app already produced a valid refresh-token cookie
// value (see auth.ts) -- hand it to the main window's own cookie jar before
// it loads the site, so the website's own silent-refresh logic (the same
// one that lets a browser tab stay signed in across reloads) picks it up
// immediately instead of showing its login form a second time.
async function injectWebSessionCookie(rawRefreshToken: string): Promise<void> {
  const targetUrls = [WEB_URL];
  try {
    const apiOrigin = new URL(API_URL).origin;
    const webOrigin = new URL(WEB_URL).origin;
    if (apiOrigin !== webOrigin) {
      targetUrls.push(apiOrigin);
    }
  } catch {}

  for (const targetUrl of targetUrls) {
    try {
      await session.defaultSession.cookies.set({
        url: targetUrl,
        name: "refreshToken",
        value: rawRefreshToken,
        httpOnly: true,
        secure: targetUrl.startsWith("https://"),
        sameSite: "lax",
        path: "/",
        // Persistent for 10 years (effectively permanent until user manually signs out)
        expirationDate: Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 60 * 60,
      });
    } catch (err) {
      console.error(`Failed to hand the session cookie to ${targetUrl}`, err);
    }
  }
}

function openMainWindow() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: "Venus CRM",
    icon: appIcon,
    autoHideMenuBar: true,
    show: false,
    webPreferences: { preload: path.join(__dirname, "web-preload.js") },
  });
  loadCrm();
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  // ready-to-show waits for a first paint, which a failed load may never give.
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) mainWindow.show();
  }, 5_000);

  // A failed load used to leave a plain white window that never recovered
  // (Electron shows no error page): site unreachable at Windows start-up before
  // Wi-Fi is up, a server redeploy, a network blip. Show a "reconnecting" page
  // instead and keep retrying until the CRM is back.
  mainWindow.webContents.on("did-fail-load", (_event, code, description, url, isMainFrame) => {
    // -3 = ERR_ABORTED: a navigation replaced by another one, not a failure.
    if (!isMainFrame || code === -3 || url.startsWith("file:")) return;
    console.error(`CRM page failed to load (${code} ${description})`);
    showCrmUnreachable(description || `error ${code}`);
  });
  // The server answering with an error page (e.g. 502 while it redeploys).
  mainWindow.webContents.on("did-navigate", (_event, url, httpResponseCode) => {
    if (httpResponseCode >= 500 && isCrmUrl(url)) showCrmUnreachable(`server error ${httpResponseCode}`);
  });
  mainWindow.webContents.on("did-finish-load", () => {
    if (mainWindow && isCrmUrl(mainWindow.webContents.getURL())) clearCrmRetry();
  });

  // Closing the window (the X button, Alt+F4) hides it rather than quitting --
  // the agent keeps running in the background and monitoring continues while
  // the employee is clocked in, same as Slack. Closing the window must never
  // stop it. Only a real quit (tray menu, Cmd+Q) tears it down, via the
  // `quitting` flag set in the app-level "before-quit" handler above.
  mainWindow.on("close", (event) => {
    if (quitting) return;
    event.preventDefault();
    mainWindow?.hide();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // The website's renderer can die on its own (GPU/driver crash, out of
  // memory after a long day). Without this the window just goes blank or dead,
  // which looks exactly like the app closing itself. Reload it instead --
  // the session lives in the cookie jar, so it comes back still signed in.
  // Goes through the reconnecting page, so a renderer that keeps crashing
  // retries every few seconds instead of reloading in a tight loop.
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("CRM window renderer gone, reloading:", details.reason);
    if (details.reason === "clean-exit") return;
    showCrmUnreachable("the page stopped unexpectedly");
  });
}

const CRM_RETRY_MS = 8_000;
let crmRetryTimer: NodeJS.Timeout | null = null;

function isCrmUrl(url: string): boolean {
  try {
    return new URL(url).origin === new URL(WEB_URL).origin;
  } catch {
    return false;
  }
}

function clearCrmRetry() {
  if (crmRetryTimer) clearTimeout(crmRetryTimer);
  crmRetryTimer = null;
}

function loadCrm() {
  clearCrmRetry();
  if (!mainWindow || mainWindow.isDestroyed()) return;
  // loadURL's promise rejects on a failed load; did-fail-load handles that.
  mainWindow.loadURL(WEB_URL).catch(() => {});
}

function showCrmUnreachable(reason: string) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow
    .loadFile(path.join(__dirname, "..", "renderer", "offline.html"), { query: { url: WEB_URL, reason } })
    .catch(() => {});
  clearCrmRetry();
  crmRetryTimer = setTimeout(loadCrm, CRM_RETRY_MS);
}

async function handleLoginRequest(
  _event: unknown,
  { email, password }: { email: string; password: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await applyAuthResult(await login(email, password), { openWindow: true });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

function showLoginWindow() {
  if (loginWindow) {
    loginWindow.focus();
    return;
  }
  loginWindow = new BrowserWindow({
    width: 380,
    height: 460,
    resizable: false,
    title: "Sign in to Venus CRM",
    icon: appIcon,
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  loginWindow.setMenuBarVisibility(false);
  loginWindow.loadFile(path.join(__dirname, "..", "renderer", "login.html"));
  loginWindow.on("closed", () => {
    loginWindow = null;
  });
}

// Shown in place of the main window right after a fresh sign-in when the
// employee hasn't yet accepted the current monitoring notice (see
// server/src/modules/auth/terms.ts). Blocks progress to the main app until
// they explicitly accept or decline -- see handleTermsAccept/Decline below.
function showTermsWindow(version: string, text: string) {
  pendingTerms = { version, text };
  if (termsWindow) {
    termsWindow.focus();
    return;
  }
  termsWindow = new BrowserWindow({
    width: 460,
    height: 560,
    resizable: false,
    title: "Venus CRM Monitoring Notice",
    icon: appIcon,
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  termsWindow.setMenuBarVisibility(false);
  termsWindow.loadFile(path.join(__dirname, "..", "renderer", "terms.html"));
  termsWindow.on("closed", () => {
    termsWindow = null;
  });
}

// Records acceptance server-side, then does what applyAuthResult's tail
// would have done had termsAccepted already been true.
async function handleTermsAccept(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!accessToken || !pendingTerms) {
    return { ok: false, error: "No pending notice to accept" };
  }
  try {
    await acceptTerms(accessToken, pendingTerms.version);
    pendingTerms = null;
    termsWindow?.close();
    startSessionPolling();
    openMainWindow();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// Declining means fully signing out -- no partial "logged in but
// unmonitored" state. Reuses the existing signOut(), which already revokes
// the refresh token server-side, clears local storage, and shows the login
// window again.
function handleTermsDecline(): { ok: true } {
  pendingTerms = null;
  termsWindow?.close();
  signOut();
  return { ok: true };
}

// `revokeServerSession` is true when the person chose to sign out (tray menu,
// declining the notice). It is false when the app is signing itself out because
// the server rejected the stored token: the server's logout endpoint deletes
// EVERY refresh token the user has, so calling it for a merely-stale token would
// sign the user out of the browser and every other device too.
let quitPromptOpen = false;

// The tray's "Quit". Quitting while clocked in stops screen monitoring and
// activity reporting, so it asks first -- and says plainly that HR and Admin
// will be told -- then notifies them and quits. Not clocked in (or nobody signed
// in), nothing is being monitored, so it just quits.
async function requestQuit() {
  if (quitPromptOpen) return;
  // Screen recording is always on while signed in, so quitting always stops it.
  if (!currentUser) {
    app.quit();
    return;
  }
  quitPromptOpen = true;
  try {
    const { response } = await dialog.showMessageBox({
      type: "warning",
      buttons: ["Cancel", "Quit anyway"],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      title: "Quit Venus CRM?",
      message: "Screen recording is always on.",
      detail:
        "Quitting stops screen recording and activity reporting, and HR and Admin will be notified that you quit the app. A background watchdog relaunches the app automatically within a few minutes.\n\nTo stop working, clock out in Venus CRM instead.",
    });
    if (response !== 1) return; // Cancel -- keep running

    // Best-effort and time-boxed: a slow or failed notification must never
    // trap the person in an app they have decided to close.
    await Promise.race([
      withFreshToken((token) => reportAgentQuit(token)).catch((err) => {
        console.error("Failed to report agent quit", err);
      }),
      new Promise<void>((resolve) => setTimeout(resolve, QUIT_NOTIFY_TIMEOUT_MS)),
    ]);
    app.quit();
  } finally {
    quitPromptOpen = false;
  }
}

let signOutPromptOpen = false;
// Time-boxed the same way as the quit notification (QUIT_NOTIFY_TIMEOUT_MS) --
// a slow or failed HR/Admin notification must never trap the person signed in.
const SIGN_OUT_NOTIFY_TIMEOUT_MS = 4_000;

// The tray's "Sign out". Signing out stops screen recording exactly like
// quitting does (recording only runs while signed in), so it gets the same
// confirm-first, notify-HR-and-Admin treatment as requestQuit above --
// otherwise Sign out would be a quieter, unwarned way to do the same thing
// Quit is deliberately not quiet about. Declining the monitoring notice and
// any forced/automatic sign-out (stale token, account switch) call signOut()
// directly and skip this, since those aren't the employee choosing to walk
// away from a working session.
async function requestSignOut() {
  if (signOutPromptOpen || !currentUser) return;
  signOutPromptOpen = true;
  try {
    const { response } = await dialog.showMessageBox({
      type: "warning",
      buttons: ["Cancel", "Sign out"],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      title: "Sign out of Venus CRM?",
      message: "Screen recording is always on while signed in.",
      detail:
        "Signing out stops screen recording and activity reporting, and HR and Admin will be notified that you signed out. You'll need to sign in again to resume using the app.",
    });
    if (response !== 1) return; // Cancel -- stay signed in

    await Promise.race([
      withFreshToken((token) => reportAgentSignOut(token)).catch((err) => {
        console.error("Failed to report agent sign-out", err);
      }),
      new Promise<void>((resolve) => setTimeout(resolve, SIGN_OUT_NOTIFY_TIMEOUT_MS)),
    ]);
    signOut();
  } finally {
    signOutPromptOpen = false;
  }
}

// Nothing about the previous account may leak into the next one: stops monitoring
// and drops every unsent clip, count and idle stretch. Used on sign-out, and when a
// refresh comes back as a different person (someone else signed in in the CRM window).
function resetAccountState() {
  stopCaptureLoop();
  stopActivityPingLoop();
  stopInputCounters();
  stopIdleWatch();
  clockedIn = false;
  onBreak = false;
  breakRemainingSec = 0;
  retryQueue.length = 0;
  if (recordingInFlight) sendToRecorder("recorder:stop");
  keystrokeCounter = 0;
  clickCounter = 0;
  lastReportedKeystrokes = 0;
  lastReportedClicks = 0;
  lastCaptureAt = null;
  lastCaptureError = null;
  activityHistory.length = 0;
  lastActivityError = null;
}

function signOut({ revokeServerSession = true }: { revokeServerSession?: boolean } = {}) {
  const cookieToRevoke = refreshCookie || tokenStore.load();
  if (revokeServerSession && cookieToRevoke) {
    logoutApi(cookieToRevoke).catch(() => {});
  }
  tokenStore.clear();
  accessToken = null;
  refreshCookie = null;
  currentUser = null;
  stopTokenRefreshLoop();
  stopSessionPolling();
  resetAccountState();
  refreshTrayMenu();
  // Shared-machine safety: don't leave the next person who opens the main
  // window silently signed in as whoever just signed out. destroy() (not
  // close()) so this bypasses the hide-on-close handler in openMainWindow.
  // localStorage too: the website persists the signed-in user and access token
  // there, so clearing only cookies left the next account's window showing the
  // previous person until that stale access token expired.
  session.defaultSession
    .clearStorageData({ storages: ["cookies", "localstorage"] })
    .catch(() => {});
  mainWindow?.destroy();
  showLoginWindow();
}

// ---- token refresh ----

function startTokenRefreshLoop() {
  stopTokenRefreshLoop();
  tokenRefreshTimer = setInterval(() => {
    void refreshSession();
  }, TOKEN_REFRESH_MS);
}

// Refreshes the access token. Resolves true when we hold a valid session
// afterwards, false when it failed transiently or we had to sign out.
//
// Single-flight on purpose: the 10-minute timer, a wake-from-sleep refresh and a
// 401-triggered retry can all land together, and each successful refresh rotates
// the refresh token server-side -- two at once would leave one of them holding
// a token the server has already replaced.
const refreshSession = singleFlight(async (): Promise<boolean> => {
  // If refreshCookie is not in memory, try recovering from session cookies or tokenStore
  if (!refreshCookie) {
    try {
      const cookies = await session.defaultSession.cookies.get({ name: "refreshToken" });
      if (cookies.length > 0 && cookies[0].value) {
        refreshCookie = cookies[0].value;
      }
    } catch {}
    if (!refreshCookie) {
      refreshCookie = tokenStore.load();
    }
  }
  if (!refreshCookie) return false;

  try {
    await applyAuthResult(await refreshAccessToken(refreshCookie));
    return true;
  } catch (err) {
    if (!isInvalidRefreshToken(err)) {
      // Transient failure (laptop asleep, network not back yet, 5xx) --
      // never treat this as a sign-out. Just retry later.
      console.error("Token refresh failed transiently, staying signed in", err);
      return false;
    }

    // The server rejected this token. Before giving up, look for a newer one:
    // the web window's own silent refresh may already have rotated the cookie,
    // or the token file may hold a newer token than this process remembers.
    const candidates = new Set<string>();
    try {
      const cookies = await session.defaultSession.cookies.get({ name: "refreshToken" });
      if (cookies.length > 0 && cookies[0].value) candidates.add(cookies[0].value);
    } catch {}
    const stored = tokenStore.load();
    if (stored) candidates.add(stored);
    candidates.delete(refreshCookie);

    for (const candidate of candidates) {
      try {
        await applyAuthResult(await refreshAccessToken(candidate));
        return true;
      } catch (candidateErr) {
        if (!isInvalidRefreshToken(candidateErr)) return false; // transient -- try again later
      }
    }

    // Really is expired/revoked/deactivated -- only now is signing out and
    // asking for credentials again correct. This is the app signing ITSELF out,
    // so it must not call the server's logout (which would end every other
    // session this user has, in the browser and on other devices).
    signOut({ revokeServerSession: false });
    return false;
  }
});

let wakeRefreshRunning = false;

// Runs when the machine wakes or is unlocked. The network is frequently still
// down for a few seconds, so keep trying (without ever signing out) until the
// refresh succeeds.
async function handleSystemWake() {
  if (!currentUser || wakeRefreshRunning) return;
  wakeRefreshRunning = true;
  try {
    for (let attempt = 0; attempt < 8; attempt++) {
      if (await refreshSession()) {
        await checkSessionAndSchedule();
        return;
      }
      if (!currentUser) return; // signed out in the meantime
      await new Promise((resolve) => setTimeout(resolve, WAKE_RETRY_MS));
    }
  } finally {
    wakeRefreshRunning = false;
  }
}

// Runs an authenticated API call; if the server says the access token expired
// (401), refreshes once and retries instead of failing until the next timer tick.
/** Thrown instead of sending something recorded for one person with another person's sign-in. */
class AccountChangedError extends Error {
  constructor() {
    super("Signed-in account changed");
  }
}

// `owner`: the user the data being sent was recorded for. If a different person
// is signed in by the time it goes (or after a refresh), it is never sent.
async function withFreshToken<T>(call: (token: string) => Promise<T>, owner?: string): Promise<T> {
  const assertOwner = () => {
    if (owner !== undefined && currentUser?.id !== owner) throw new AccountChangedError();
  };
  if (!accessToken) throw new Error("Not signed in");
  assertOwner();
  try {
    return await call(accessToken);
  } catch (err) {
    if ((err as { status?: number }).status === 401 && (await refreshSession()) && accessToken) {
      assertOwner();
      return call(accessToken);
    }
    throw err;
  }
}

function stopTokenRefreshLoop() {
  if (tokenRefreshTimer) clearInterval(tokenRefreshTimer);
  tokenRefreshTimer = null;
}

// ---- work-session polling -> arms/disarms the capture loop ----

function startSessionPolling() {
  stopSessionPolling();
  sessionPollTimer = setInterval(checkSessionAndSchedule, SESSION_POLL_MS);
  checkSessionAndSchedule();
}

function stopSessionPolling() {
  if (sessionPollTimer) clearInterval(sessionPollTimer);
  sessionPollTimer = null;
}

function monitoringInputs() {
  return { signedIn: !!accessToken, clockedIn, onBreak };
}

function monitoringActive(): boolean {
  return shouldMonitor(monitoringInputs());
}

function recordingActive(): boolean {
  return shouldRecord(monitoringInputs());
}

// Brings recording, activity pings and input counting in line with
// monitoringActive(). Idempotent -- called whenever anything that feeds it
// changes (clock in/out, break, sign in/out).
function applyMonitoringState() {
  // Screen recording runs whenever someone is signed in -- clocked in or not,
  // on a break or not -- so it starts by itself when the computer does.
  if (recordingActive()) {
    if (!captureTimer && !recordingInFlight) scheduleNextRecording();
  } else {
    stopCaptureLoop();
    // Stop a clip that is mid-recording; recordAndUpload discards it rather than
    // uploading footage captured after the person signed out.
    if (recordingInFlight) sendToRecorder("recorder:stop");
  }

  if (monitoringActive()) {
    if (!activityPingTimer) startActivityPingLoop();
    startInputCounters();
    startIdleWatch();
    return;
  }
  stopActivityPingLoop();
  stopInputCounters();
  stopIdleWatch();
}

async function checkSessionAndSchedule() {
  if (!accessToken) return;
  let active: ActiveSessionInfo | null = null;
  try {
    active = await withFreshToken((token) => getActiveWorkSession(token));
  } catch {
    // Transient network issue -- try again on the next poll tick. Recording does
    // not depend on the work session, so it still starts (e.g. at boot, before
    // the network is up) and just queues clips until uploads work.
    applyMonitoringState();
    return;
  }

  if (active) {
    clockedIn = true;
    onBreak = active.isOnBreak;
    breakRemainingSec = active.breakRemainingSeconds;
    if (typeof active.idlePromptMinutes === "number" && active.idlePromptMinutes >= 0) {
      idlePromptMinutes = active.idlePromptMinutes;
    }
  } else if (clockedIn) {
    clockedIn = false;
    onBreak = false;
    breakRemainingSec = 0;
  }
  applyMonitoringState();
  refreshTrayMenu();
}

// ---- "Are you still working?" idle prompt ----
//
// While monitoring is active, after idlePromptMinutes (an Admin/HR attendance
// setting, 5 by default) with no keyboard or mouse input ANYWHERE on the machine
// -- not just in the CRM window -- an always-on-top window asks "Hey, are you
// still working?". Answering Yes asks why the screen was idle; the reason and
// the idle duration go to the server as an idle event, which notifies Admin, HR
// and the department manager and appears in the Employee Daily Log and Screen
// Monitoring. The website has no idle prompt of its own: a browser tab can't see
// input in other programs.

// Short, so the moment the person comes back is caught to within a couple of seconds.
const IDLE_CHECK_MS = 2_000;


let idlePromptMinutes = 0; // 0 = not tracked; set from the server's per-user rule
let idleCheckTimer: NodeJS.Timeout | null = null;
let idleWindow: BrowserWindow | null = null;
let idleStretch: IdleStretch | null = null;

function startIdleWatch() {
  if (idleCheckTimer) return;
  idleCheckTimer = setInterval(checkForIdle, IDLE_CHECK_MS);
}

// Clocked out, on a break or signed out: nothing to ask about any more.
function stopIdleWatch() {
  if (idleCheckTimer) clearInterval(idleCheckTimer);
  idleCheckTimer = null;
  closeIdlePrompt();
}

function checkForIdle() {
  if (idlePromptMinutes <= 0) {
    if (idleStretch) closeIdlePrompt(); // 0 = idle not tracked (Admins)
    return;
  }
  if (!monitoringActive()) return;
  const idleSeconds = powerMonitor.getSystemIdleTime();
  const now = Date.now();
  if (idleStretch) {
    // Fresh input while the prompt is up: that's when the person came back.
    if (idleStretch.returnedAtMs == null && idleSeconds * 1000 < IDLE_CHECK_MS * 2) {
      idleStretch.returnedAtMs = now - idleSeconds * 1000;
    }
    return;
  }
  if (shouldPromptForIdle(idleSeconds, idlePromptMinutes)) {
    idleStretch = { startedAtMs: now - idleSeconds * 1000, returnedAtMs: null };
    showIdleWindow();
  }
}

function showIdleWindow() {
  if (idleWindow) {
    idleWindow.show();
    idleWindow.focus();
    return;
  }
  idleWindow = new BrowserWindow({
    width: 460,
    height: 440,
    resizable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    title: "Venus CRM",
    icon: appIcon,
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  idleWindow.setMenuBarVisibility(false);
  idleWindow.loadFile(path.join(__dirname, "..", "renderer", "idle.html"));
  idleWindow.flashFrame(true);
  // Must be answered: closing it does nothing while the question is open
  // (a real quit still goes through).
  idleWindow.on("close", (event) => {
    if (!quitting && idleStretch) event.preventDefault();
  });
  idleWindow.on("closed", () => {
    idleWindow = null;
  });
}

function closeIdlePrompt() {
  idleStretch = null;
  // destroy(), not close(): bypasses the must-answer close handler above.
  idleWindow?.destroy();
  idleWindow = null;
}

async function handleIdleReason(reason: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const stretch = idleStretch;
  const text = typeof reason === "string" ? reason.trim() : "";
  if (!stretch) return { ok: true };
  if (text.length < 3) return { ok: false, error: "Please give a short reason." };
  // An account switch closes the prompt (resetAccountState), so whoever is signed in
  // now is the person who was idle -- unless it changes while this is being sent.
  const owner = currentUser?.id;
  try {
    await withFreshToken(
      (token) =>
        submitIdleReason(token, {
          idleStartedAt: new Date(stretch.startedAtMs).toISOString(),
          idleMinutes: idleMinutesToReport(stretch, Date.now(), idlePromptMinutes),
          reason: text,
        }),
      owner,
    );
  } catch (err) {
    // 400 = no longer clocked in (or the setting changed underneath us): there's
    // nothing left to report against, so just let the person go. A changed
    // account has nothing to report either.
    if ((err as { status?: number }).status !== 400 && !(err instanceof AccountChangedError)) {
      return { ok: false, error: (err as Error).message || "Couldn't send. Check your connection and try again." };
    }
  }
  closeIdlePrompt();
  return { ok: true };
}

// ---- capture loop ----

function stopCaptureLoop() {
  if (captureTimer) clearTimeout(captureTimer);
  captureTimer = null;
}

// Milliseconds until the next :00 / :20 / :40 boundary. Aligning to the wall
// clock (instead of counting 20 minutes from clock-in) is what guarantees
// exactly 3 clips per hour regardless of when the shift starts.
function msUntilNextSlot(): number {
  const now = new Date();
  const slotMs = SLOT_MINUTES * 60_000;
  const msIntoHour = now.getMinutes() * 60_000 + now.getSeconds() * 1000 + now.getMilliseconds();
  const next = Math.ceil(msIntoHour / slotMs) * slotMs;
  // Landing exactly on a boundary means the next one is a full slot away.
  return next === msIntoHour ? slotMs : next - msIntoHour;
}

// When a slot records nothing (no screen source, permission refused, recorder
// gone...), wait this long before trying again rather than spinning in a tight
// loop in continuous mode.
const CAPTURE_RETRY_MS = 10_000;

function scheduleNextRecording(delayMs?: number) {
  stopCaptureLoop();
  if (!recordingActive()) return;
  captureTimer = setTimeout(async () => {
    // This timer has fired -- forget it, so applyMonitoringState() can arm a
    // fresh one later (e.g. after signing back in).
    captureTimer = null;
    if (!recordingActive()) return;
    let recorded = false;
    // fire-and-forget from setTimeout's perspective -- a rejection here with
    // nothing awaiting it becomes an unhandled promise rejection, which
    // Node/Electron escalates to an uncaught exception and kills the whole
    // process. One failed clip must never take down the app.
    try {
      recorded = await recordAndUpload();
    } catch (err) {
      console.error("recordAndUpload failed for this slot", err);
      recordingInFlight = false;
    }
    if (recordingActive() && !captureTimer) {
      scheduleNextRecording(CONTINUOUS_RECORDING && !recorded ? CAPTURE_RETRY_MS : undefined);
    }
  }, delayMs ?? (CONTINUOUS_RECORDING ? 0 : msUntilNextSlot()));
}

// Uploads run one at a time, in order, off the recording path: in continuous
// mode the next clip is already recording while this one uploads, and two
// overlapping uploads could also both flush (and double-send) the retry queue.
let uploadChain: Promise<void> = Promise.resolve();
function queueUpload(webm: Buffer, durationSec: number, owner: string, thumbnail?: Buffer): Promise<void> {
  uploadChain = uploadChain
    .then(() => uploadOne(webm, durationSec, owner, thumbnail))
    .catch((err) => console.error("Recording upload failed", err));
  return uploadChain;
}

// webContents.send() throws synchronously if the target has been destroyed
// (e.g. the recorder renderer crashed a moment ago and render-process-gone
// hasn't nulled recorderWindow out yet) -- centralize the guard so every
// call site fails safely (returns false) instead of throwing.
function sendToRecorder(channel: string, ...args: unknown[]): boolean {
  if (!recorderWindow || recorderWindow.webContents.isDestroyed()) return false;
  try {
    recorderWindow.webContents.send(channel, ...args);
    return true;
  } catch (err) {
    console.error(`Failed to send ${channel} to recorder window`, err);
    return false;
  }
}

// Captures one clip through the hidden recorder window. Resolves once the
// recording has finished and been handed back, so the caller can schedule the
// next slot without two clips ever overlapping.
// Resolves true when the recorder produced a clip (uploaded or not), false when nothing was recorded.
async function recordAndUpload(): Promise<boolean> {
  if (!recordingActive() || recordingInFlight || recordingDisabled || !recorderWindow) return false;

  // macOS asks for Screen Recording permission the first time the screen is captured.
  // If it was refused, captures would only show the desktop background -- say so in
  // the tray instead. (macOS needs the app restarted after the permission is granted.)
  if (process.platform === "darwin" && systemPreferences.getMediaAccessStatus("screen") === "denied") {
    lastCaptureError =
      "Screen Recording is not allowed. Turn on Venus CRM in System Settings → Privacy & Security → Screen Recording, then restart the app.";
    refreshTrayMenu();
    return false;
  }

  let sourceId: string;
  // Snapshot of the screen as the clip starts; the dashboard shows it on the clip's card.
  let thumbnail: Buffer | undefined;
  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 480, height: 270 },
    });
    const primary = sources[0];
    if (!primary) {
      lastCaptureError = "No screen source available";
      refreshTrayMenu();
      return false;
    }
    sourceId = primary.id;
    thumbnail = primary.thumbnail?.isEmpty() === false ? primary.thumbnail.toJPEG(70) : undefined;
  } catch (err) {
    lastCaptureError = (err as Error).message;
    refreshTrayMenu();
    return false;
  }

  if (!recordingActive() || !currentUser) return false;

  // The clip belongs to whoever is signed in when it starts.
  const owner = currentUser.id;
  recordingInFlight = true;
  refreshTrayMenu();

  const result = await new Promise<{ buffer: Buffer; durationSec: number } | null>((resolve) => {
    // A clip should never outlive its slot; if the renderer wedges, give up
    // rather than blocking every future recording.
    const guard = setTimeout(() => finish(null), (RECORD_SECONDS + 30) * 1000);

    // Recording deliberately does NOT pause while the person is idle: reviewers
    // need to see what was on screen during an idle stretch too (e.g. next to the
    // reason given in Screen Monitoring).

    function finish(value: { buffer: Buffer; durationSec: number } | null) {
      clearTimeout(guard);
      ipcMain.removeListener("recorder:done", onDone);
      ipcMain.removeListener("recorder:failed", onFailed);
      resolve(value);
    }
    // Guarded: a malformed/unexpected IPC payload must fail this one clip,
    // not throw synchronously out of a raw ipcMain.on listener -- Electron
    // doesn't wrap those the way it wraps ipcMain.handle, so an uncaught
    // throw here would take down the whole main process.
    function onDone(_e: unknown, payload: { buffer: Uint8Array; durationSec: number }) {
      try {
        finish({ buffer: Buffer.from(payload.buffer), durationSec: payload.durationSec });
      } catch (err) {
        lastCaptureError = (err as Error).message;
        finish(null);
      }
    }
    function onFailed(_e: unknown, message: string) {
      lastCaptureError = message;
      finish(null);
    }

    ipcMain.on("recorder:done", onDone);
    ipcMain.on("recorder:failed", onFailed);

    if (!sendToRecorder("recorder:start", {
      sourceId,
      durationMs: RECORD_SECONDS * 1000,
      width: RECORD_WIDTH,
      height: RECORD_HEIGHT,
      frameRate: RECORD_FPS,
      bitsPerSecond: RECORD_BITRATE,
    })) {
      // recorderWindow was destroyed between the top-of-function check and
      // here (e.g. a render-process-gone race) -- fail this slot cleanly
      // instead of leaving the promise hanging until the 30s guard timeout.
      lastCaptureError = "Recorder window unavailable";
      finish(null);
    }
  });

  recordingInFlight = false;

  // A clip that came out (near-)empty -- e.g. stopped moments after it started --
  // isn't worth an upload round-trip; see MIN_RECORDING_SECONDS. And if
  // recording ended while the clip was being recorded (signed out, or someone
  // else signed in), the footage is discarded, never uploaded.
  if (
    !recordingActive() ||
    currentUser?.id !== owner ||
    !result ||
    result.buffer.length === 0 ||
    result.durationSec < MIN_RECORDING_SECONDS
  ) {
    refreshTrayMenu();
    return result !== null;
  }
  const upload = queueUpload(result.buffer, result.durationSec, owner, thumbnail);
  // Continuous mode starts the next clip straight away rather than waiting
  // for this upload, so a slow network never leaves a gap in the footage.
  if (!CONTINUOUS_RECORDING) await upload;
  return true;
}

async function uploadOne(webm: Buffer, durationSec: number, owner: string, thumbnail?: Buffer) {
  if (!accessToken || currentUser?.id !== owner) return;
  try {
    await withFreshToken((token) => uploadRecording(token, webm, durationSec, thumbnail), owner);
    console.log(`Recording uploaded at ${new Date().toLocaleTimeString()} (${durationSec}s)`);
    lastCaptureAt = new Date();
    lastCaptureError = null;
    refreshTrayMenu();
    await flushRetryQueue();
  } catch (err) {
    // Someone else signed in meanwhile: the clip is the previous person's, so drop it.
    if (err instanceof AccountChangedError) return;
    const status = (err as { status?: number }).status;
    // 403 means this account's department isn't being recorded (see
    // RECORDED_DEPARTMENTS on the server). That won't change mid-session, so
    // stop the loop rather than burning a clip every slot to be refused again.
    if (status === 403) {
      recordingDisabled = true;
      retryQueue.length = 0;
      stopCaptureLoop();
      lastCaptureError = null;
      refreshTrayMenu();
      return;
    }
    // 409 is no longer expected (the server accepts clips whether or not the
    // employee is clocked in); if one still arrives, drop the clip rather than
    // retry something the server has refused.
    if (status === 409) {
      retryQueue.length = 0;
      return;
    }
    console.error("Recording upload failed", err);
    lastCaptureError = (err as Error).message;
    refreshTrayMenu();
    if (currentUser?.id === owner && retryQueue.length < MAX_RETRY_QUEUE) {
      retryQueue.push({ webm, durationSec, owner, thumbnail });
    }
  }
}

async function flushRetryQueue() {
  if (!accessToken) return;
  while (retryQueue.length > 0) {
    const next = retryQueue[0];
    try {
      await withFreshToken((token) => uploadRecording(token, next.webm, next.durationSec, next.thumbnail), next.owner);
      retryQueue.shift();
    } catch (err) {
      // Recorded for someone who is no longer signed in: drop it, never send it as the new person.
      if (err instanceof AccountChangedError) {
        retryQueue.shift();
        continue;
      }
      break; // still failing -- leave it queued and stop for this cycle
    }
  }
}

// ---- activity ping loop ----
//
// Reports idle-time (seconds since the OS last saw any mouse/keyboard
// input, via Electron's own powerMonitor.getSystemIdleTime()) plus two
// keystroke/click COUNTS (see the "keyboard/mouse activity counters"
// section below reportActivity). Both are numbers only -- nothing about
// *what* was pressed, *where* a click landed, or any key/click content is
// ever observable to this app, on purpose. The server turns idleSeconds
// into an active/idle flag; this process never even needs to know the
// threshold to do its job -- it's tracked locally only so the tray can show
// a rough "how active have I been lately" readout, same transparency goal
// as lastCaptureAt above.

function startActivityPingLoop() {
  stopActivityPingLoop();
  activityPingTimer = setInterval(reportActivity, ACTIVITY_PING_MS);
  reportActivity();
}

function stopActivityPingLoop() {
  if (activityPingTimer) clearInterval(activityPingTimer);
  activityPingTimer = null;
}

async function reportActivity() {
  if (!accessToken || !monitoringActive() || !currentUser) return;
  // The counts belong to whoever is signed in now; an account switch resets them.
  const owner = currentUser.id;
  // Snapshot-and-subtract rather than reset-to-0: uIOhook delivers events
  // via native callbacks on the event loop, which can fire while the
  // `await` below is in flight. Subtracting only the snapshotted amount
  // (instead of zeroing the counter after the request settles) means any
  // keystrokes/clicks that land mid-upload roll into the *next* ping
  // instead of being silently dropped.
  const keystrokes = keystrokeCounter;
  const clicks = clickCounter;
  try {
    const idleSeconds = Math.round(powerMonitor.getSystemIdleTime());
    await withFreshToken((token) => uploadActivityPing(token, idleSeconds, keystrokes, clicks), owner);
    // Switched accounts while this was in flight: the counters were already reset
    // for the new person, so there is nothing of theirs to subtract.
    if (currentUser?.id !== owner) return;
    keystrokeCounter -= keystrokes;
    clickCounter -= clicks;
    lastReportedKeystrokes = keystrokes;
    lastReportedClicks = clicks;
    activityHistory.push(idleSeconds < ACTIVE_THRESHOLD_SECONDS);
    if (activityHistory.length > ACTIVITY_HISTORY_SIZE) activityHistory.shift();
    lastActivityError = null;
    refreshTrayMenu();
  } catch (err) {
    const status = (err as { status?: number }).status;
    // Same "clocked out in between" race as uploadOne -- not a real failure.
    // Nor is a switched account: the counts were the previous person's, already reset.
    if (status === 409 || err instanceof AccountChangedError) return;
    console.error("Activity ping failed", err);
    lastActivityError = (err as Error).message;
    refreshTrayMenu();
  }
}

// ---- keyboard/mouse activity counters ----
//
// uIOhook is a global input hook, which is CAPABLE of reporting exactly
// which key was pressed and exactly where a click landed. This app
// deliberately never reads either: both listeners below do nothing but
// increment a counter. No key code, no character, no click coordinate is
// ever inspected, logged, held in memory beyond the count, or sent
// anywhere -- see reportActivity above, which only ever transmits the two
// numbers. Registered once at module load (cheap, inert until start());
// only actually capturing input while clocked in and off break, armed/
// disarmed alongside startActivityPingLoop/stopActivityPingLoop in
// checkSessionAndSchedule and cleared in signOut.
uIOhook.on("keydown", () => {
  keystrokeCounter++;
});
uIOhook.on("mousedown", () => {
  clickCounter++;
});

function startInputCounters() {
  if (inputHookRunning) return;
  // macOS only lets an app count keyboard/mouse events once the person allows it in
  // System Settings → Privacy & Security → Accessibility. Ask once per run; this is
  // retried on every session poll, so counting starts as soon as it's allowed.
  if (process.platform === "darwin" && !systemPreferences.isTrustedAccessibilityClient(!accessibilityPrompted)) {
    accessibilityPrompted = true;
    return;
  }
  try {
    uIOhook.start();
    inputHookRunning = true;
  } catch (err) {
    // Never fatal -- the idle-time-derived active/idle signal still works
    // without this, same "one failed signal shouldn't take down the rest"
    // principle as recordAndUpload's error handling.
    console.error("Failed to start keyboard/mouse activity counters", err);
  }
}

function stopInputCounters() {
  if (!inputHookRunning) return;
  try {
    uIOhook.stop();
  } catch (err) {
    console.error("Failed to stop keyboard/mouse activity counters", err);
  }
  inputHookRunning = false;
}
