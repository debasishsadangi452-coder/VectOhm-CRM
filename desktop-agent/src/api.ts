// Same production default and override as auth.ts -- keep them in sync.
const API_URL = process.env.OMNIOS_API_URL ?? "https://crm.venusglobaltech.com/api";

export interface ActiveSessionInfo {
  id: string;
  isOnBreak: boolean;
  breakRemainingSeconds: number;
  cooldownRemainingSeconds: number;
  // Minutes without input before the "Are you still working?" prompt -- an
  // Admin/HR attendance setting, so read from the server rather than hardcoded.
  idlePromptMinutes?: number;
}

// Records why the screen was idle (the answer to the "Are you still working?"
// prompt in main.ts). The server stores it as an idle event -- it shows in the
// Employee Daily Log -- and notifies Admin, HR and the department manager.
// It rejects idleMinutes below the idle-prompt setting, so callers send at least that.
export async function submitIdleReason(
  accessToken: string,
  input: { idleStartedAt: string; idleMinutes: number; reason: string },
): Promise<void> {
  const res = await fetch(`${API_URL}/work-sessions/idle-events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { message?: string });
    const err = new Error(body.message ?? `Couldn't save the reason (${res.status})`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
}

// null = not clocked in right now.
export async function getActiveWorkSession(accessToken: string): Promise<ActiveSessionInfo | null> {
  const res = await fetch(`${API_URL}/work-sessions/active`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    // Carry the status so the caller can refresh an expired token and retry on a 401.
    const err = new Error(`Failed to check work session (${res.status})`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Tells the server the employee chose to Quit the app, so it can notify HR
// and Admin. The employee was warned of exactly this in the quit confirmation
// (see main.ts's requestQuit). Best-effort: the caller quits regardless of
// whether this succeeds.
export async function reportAgentQuit(accessToken: string): Promise<void> {
  const res = await fetch(`${API_URL}/activity-monitoring/agent-quit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = new Error(`Agent-quit report failed (${res.status})`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
}

// Same as reportAgentQuit, for a deliberate Sign out from the tray menu (see
// main.ts's requestSignOut) -- stopping screen recording either way, so it
// gets the same HR/Admin notification. Never sent for a forced/automatic
// sign-out (stale token, declined notice, account switch).
export async function reportAgentSignOut(accessToken: string): Promise<void> {
  const res = await fetch(`${API_URL}/activity-monitoring/agent-sign-out`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = new Error(`Agent-sign-out report failed (${res.status})`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
}

// Uploads straight from the in-memory buffer -- the caller never writes it
// to disk (see main.ts's captureAndUpload). Throws on any non-2xx response,
// including the 409 the backend returns if the employee clocked out between
// the capture and this call -- the caller treats that as a dropped capture,
// not a retryable failure (see main.ts's uploadOne).
export async function uploadCapture(accessToken: string, jpeg: Buffer): Promise<void> {
  const form = new FormData();
  // Wrap in a plain Uint8Array -- Buffer's ArrayBufferLike type includes
  // SharedArrayBuffer, which BlobPart doesn't accept.
  form.append("file", new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" }), "capture.jpg");

  const res = await fetch(`${API_URL}/screen-monitoring/captures`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { message?: string });
    const err = new Error(body.message ?? `Upload failed (${res.status})`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
}

// idleSeconds comes straight from Electron's powerMonitor.getSystemIdleTime()
// (see main.ts) -- an OS-level "seconds since last input" signal, never
// individual key/click events. keystrokeCount/clickCount are plain counts
// of keydown/mousedown events since the last ping, from the uIOhook
// listeners in main.ts -- those listeners only ever increment a counter,
// never read/store the key pressed or the click's coordinates, so there is
// no key/click content to send here even in principle. Same
// 409-on-clocked-out semantics as uploadCapture.
export async function uploadActivityPing(
  accessToken: string,
  idleSeconds: number,
  keystrokeCount: number,
  clickCount: number,
): Promise<void> {
  const res = await fetch(`${API_URL}/activity-monitoring/pings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ idleSeconds, keystrokeCount, clickCount }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { message?: string });
    const err = new Error(body.message ?? `Activity ping failed (${res.status})`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
}

// Uploads a finished screen recording. Same 409-on-clocked-out semantics as
// uploadCapture: the employee clocking out mid-clip is expected, not an error
// worth retrying -- the clip is simply dropped.
export async function uploadRecording(
  accessToken: string,
  webm: Buffer,
  durationSec: number,
  thumbnail?: Buffer,
): Promise<void> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(webm)], { type: "video/webm" }), "recording.webm");
  form.append("durationSec", String(durationSec));
  if (thumbnail?.length) {
    form.append("thumbnail", new Blob([new Uint8Array(thumbnail)], { type: "image/jpeg" }), "thumbnail.jpg");
  }

  const res = await fetch(`${API_URL}/screen-recordings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { message?: string });
    const err = new Error(body.message ?? `Recording upload failed (${res.status})`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
}
