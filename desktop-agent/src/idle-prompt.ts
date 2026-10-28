// Pure helpers for the "Are you still working?" idle prompt (see main.ts), kept
// free of Electron imports so they can be unit-tested.

export interface IdleStretch {
  /** When the last keyboard/mouse input happened before the stretch began. */
  startedAtMs: number;
  /** When input was first seen again, or null if the person hasn't come back yet. */
  returnedAtMs: number | null;
}

/** True when the OS has seen no input for at least the prompt threshold. */
export function shouldPromptForIdle(idleSeconds: number, promptMinutes: number): boolean {
  return idleSeconds >= promptMinutes * 60;
}

/**
 * Minutes to record for the stretch: from its start until the person came back
 * (or until now, if they somehow answered without any input being seen). Never
 * less than the prompt threshold -- the server refuses anything shorter, and the
 * prompt only appears once that much idle time has already passed.
 */
export function idleMinutesToReport(stretch: IdleStretch, nowMs: number, promptMinutes: number): number {
  const endMs = stretch.returnedAtMs ?? nowMs;
  const minutes = Math.round((endMs - stretch.startedAtMs) / 60_000);
  return Math.min(24 * 60, Math.max(promptMinutes, minutes));
}
