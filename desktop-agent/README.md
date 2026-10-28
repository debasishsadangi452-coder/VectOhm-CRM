# Venus CRM (desktop app)

The real Venus CRM website, running in its own native window instead of a
browser tab — same idea as how Slack/Discord ship their web app as a desktop
app. Sign in once and it opens the actual CRM (`OMNIOS_WEB_URL`, defaults to
`https://crm.venusglobaltech.com`) in a window, with no browser bars.

This same app **records the screen continuously whenever it is running and
someone is signed in** -- it starts with the computer, and recording does not
depend on clocking in, breaks, idleness or working hours. While the employee
is clocked in (and not on a break) it also reports a plain active/idle signal
and keystroke/click COUNTS (numbers only -- never what was typed or clicked,
never a key value or click coordinate). All of it is in the
background, disclosed per company policy (the monitoring notice says
recording is always on and must be accepted before use) — see `PROJECT_STATUS.md` at the
repo root and the phase 10/13 plans for the full context on why this exists
and what it deliberately does not do.

This has to be a real installed program rather than just a website: a
browser tab can't silently capture the OS desktop (that's a real security
boundary), so the disclosed-monitoring piece needs an actual app. Once that
app exists anyway, it made sense for it to also just *be* how employees use
the CRM day to day, rather than asking them to install a second thing.

## Requirements

- The Venus CRM backend running and reachable (defaults to
  `http://localhost:4001`; override with the `OMNIOS_API_URL` env var).
- The Venus CRM website reachable (defaults to
  `https://crm.venusglobaltech.com`; override with `OMNIOS_WEB_URL` for
  local dev, e.g. `http://localhost:8081`).
- A Venus CRM account for the employee whose laptop this runs on.

## Running in development

```
npm install
npm start
```

This compiles the TypeScript (`src/` → `dist/`) and launches Electron. On
first run it shows a small sign-in window — use the employee's normal Venus
CRM email/password. After signing in, the real CRM opens in its own window,
and the app also settles into the system tray. Left-click the tray icon to
reopen the window if it's closed/hidden; right-click it for status (signed
in as, clocked-in state, last capture time) and to sign out or quit.

**Note**: this can't be launched from a sandboxed/headless shell that sets
`ELECTRON_RUN_AS_NODE=1` (common in CI/agent sandboxes) — that env var forces
Electron's bundled Node to run in plain-Node compatibility mode, which
disables every Electron API (`app`, `Tray`, `desktopCapturer`, etc.) and the
app will crash on startup. Run it from a normal terminal on an actual
Windows/Mac machine with a desktop session.

## How it behaves

- Signing in hands the same session to the main window's cookie jar, so the
  website loads already signed in instead of asking for credentials a
  second time.
- Screen recording is always on while signed in: it begins as soon as the app
  starts at OS login (even before the network is up -- clips are retried), and
  keeps going through clock-out, breaks, idle stretches and nights/weekends.
  Clips are stored without a work session when the employee isn't clocked in.
  Only signing out or quitting stops it. The tray menu says so.
- Closing the window (the X button, Alt+F4) never stops the agent: it hides to
  the tray and keeps running in the background. Screen recording continues
  always; activity pings and keystroke/click counts continue while the employee
  is clocked in and not on a break, exactly as if the window were open -- same as closing
  a Slack window doesn't sign you out of Slack. Left-click the tray icon to
  bring the window back. Only "Quit" from the tray menu (or Cmd+Q) exits the
  app.
- Quitting while signed in asks first. "Quit" in the tray menu shows a
  confirmation ("Quitting stops screen recording and activity reporting, and
  HR and Admin will be notified…", default button Cancel). If the employee
  confirms, HR and Admin get a "Desktop agent quit" notification (once per
  person per two minutes) and the app exits; if the notification cannot be sent
  within a few seconds, the app still exits. Signed out, there is nothing to
  confirm or report, so it just quits. Closing the window is not quitting.
- A Windows watchdog (two Scheduled Tasks, installed alongside the app --
  see `build/installer.nsh`) relaunches Venus CRM if it isn't running: once at
  every logon, and again every 5 minutes for as long as the machine is on.
  This covers the process being ended from Task Manager or its "open at
  login" entry being removed -- either way the agent is back (and recording
  resumes automatically, since it's always on while signed in) within a few
  minutes, not whenever someone remembers to reopen it. It's a best-effort
  net, not a guarantee: a laptop asleep or off stays off, same as always, and
  a sufficiently determined user could still remove both scheduled tasks.
  Uninstalling the app removes them too.
  This covers the tray menu only -- it cannot see the process being ended from
  Task Manager.
- Only one copy runs at a time. Launching it again (it also starts itself at
  OS login) just brings the running copy forward; it never starts a second
  agent.
- Launches automatically at OS login (`app.setLoginItemSettings`), so it's
  already running when the workday starts.
- Polls `GET /work-sessions/active` once a minute; only arms the capture and
  activity-ping timers while the employee has an open (clocked-in) work
  session.
- Captures via Electron's `desktopCapturer`, encodes to JPEG in memory, and
  uploads immediately — the buffer is discarded right after a successful
  upload and is never written to a file.
- Reports OS idle-time (`powerMonitor.getSystemIdleTime()`) once a minute --
  a single "seconds since last input" number -- so the server can derive an
  active/idle signal, alongside a keystroke count and a click count since
  the previous ping (via `uiohook-napi`). All three are plain numbers: the
  input-count listeners only ever increment a counter and never read which
  key was pressed or where a click landed, so there is no key/click content
  anywhere in this app even in principle.
- If an upload fails (offline, VPN drop, etc.), up to 3 of the most recent
  captures are held in memory and retried on the next successful upload —
  deliberately bounded, and still never falls back to local-disk storage.
- The refresh token is the only thing persisted across restarts, encrypted
  via Electron's `safeStorage` (OS keychain — DPAPI on Windows, Keychain on
  macOS) in the app's userData directory. If encryption isn't available on a
  given machine, the app simply doesn't persist and asks for login again
  next launch, rather than ever writing a token in the clear.
- Staying signed in: the access token is refreshed every 10 minutes, right
  away after the laptop wakes or unlocks (retrying while the network comes
  back), and once more on any 401. Refreshes never overlap. A failed refresh
  only signs the app out when the server answers 401; network errors and 5xx
  never do. When the app has to sign itself out because the server rejected
  the token, it does so locally and does NOT call the server's logout (which
  would end every other session the user has).
- **There is no Sign out option for an employee**, by default. The tray menu
  only has Open Venus CRM and Quit. A company laptop is provisioned once by
  IT (one sign-in, one monitoring-notice acceptance) and is meant to keep
  recording unattended from then on for as long as it's on; a self-serve sign
  out would be a quiet way to stop that without any of the friction Quit
  already has. Set `OMNIOS_ALLOW_SIGN_OUT=1` when launching the agent to
  bring the Sign out item back -- IT's way to re-provision a laptop (reassign
  it to someone else, or reset it before a handover). When it is present (and
  only then), Sign out asks first, the same way Quit does -- "Signing out
  stops screen recording and activity reporting, and HR and Admin will be
  notified that you signed out", default button Cancel. Confirming notifies
  HR and Admin (best-effort, same few-second timeout as Quit's notification
  so a slow network can't trap the person signed in), then clears the stored
  token and the main window's session and requires a fresh login. That is a
  deliberate sign-out, so it also revokes the user's sessions on the server.
  A forced/automatic sign-out (the server rejected a stale token, declining
  the monitoring notice, a different account signing in) is unaffected by
  this setting either way -- it's never a menu action, so it's never
  something an employee chooses.

## Tests

The agent's logic is covered by the repo's Vitest run (from the repo root):

```
npx vitest run desktop-agent
```

`main.integration.test.ts` loads the real `main.ts` against a fake Electron
and fake time, and exercises closing the window (monitoring keeps running in the
background), reopening it from the tray, clock-out, breaks,
sleep/wake, 401 refresh-and-retry, forced vs deliberate sign-out, and the
single-instance lock.

## Building an installer

```
npm run dist:win   # Windows .exe (NSIS) -- needs to run on Windows
npm run dist:mac   # macOS .dmg -- needs to run on macOS
```

No Mac? GitHub builds it: **Actions → "Desktop app (macOS)" → Run workflow**,
then download `venus-crm-mac` from the finished run's Artifacts. It contains
`Venus CRM <version> arm64.dmg` (Apple Silicon, M1 and later) and
`Venus CRM <version> x64.dmg` (Intel Macs). Apple menu → About This Mac shows
which one a Mac needs.

### Installing on macOS

The Mac app isn't signed with an Apple Developer ID, so macOS blocks it the
first time. Each employee does this once:

1. Open the .dmg and drag **Venus CRM** into **Applications**.
2. Open Venus CRM from Applications. macOS says it can't be opened — click **Done**.
3. Open **System Settings → Privacy & Security**, scroll down to the message about
   Venus CRM, and click **Open Anyway** (enter the Mac password if asked).
4. When asked, allow **Screen Recording** and **Accessibility** for Venus CRM
   (System Settings → Privacy & Security). Screen Recording is needed for the
   recordings; Accessibility for the keystroke/click counts. Restart Venus CRM after
   turning Screen Recording on.

If macOS says the app "is damaged and can't be opened", run this in Terminal once,
then open it again: `xattr -cr "/Applications/Venus CRM.app"`.

## What's deliberately not here yet

- Real branding art for the tray icon (currently a 1x1 placeholder — swap
  `TRAY_ICON_DATA_URL` in `src/main.ts` for real artwork).
- Code signing / notarization for the built installers.
- Auto-update (so shipping a code change to this app means re-distributing
  a new installer, unlike the website which updates itself on every deploy).
- Linux support.
