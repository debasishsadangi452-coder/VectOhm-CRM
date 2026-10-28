// The rules for "is this app allowed to monitor / record right now?". Pure (no
// Electron imports) so they can be unit-tested; main.ts calls them from every
// place that starts or stops screen recording, activity pings and input
// counting, so they can never disagree.
//
// Activity monitoring runs while someone is signed in, clocked in, and not on a
// break. Screen recording is separate and always on while signed in -- see
// shouldRecord below.
// Whether the Venus CRM window is open does NOT matter: closing the window just
// hides the app to the tray and it keeps running in the background.

export interface MonitoringInputs {
  signedIn: boolean;
  clockedIn: boolean;
  onBreak: boolean;
}

export type MonitoringStatus = "signed-out" | "not-clocked-in" | "on-break" | "active";

/** Why monitoring is on or off. Earlier conditions win, so the reason shown is the most fundamental one. */
export function getMonitoringStatus(i: MonitoringInputs): MonitoringStatus {
  if (!i.signedIn) return "signed-out";
  if (!i.clockedIn) return "not-clocked-in";
  if (i.onBreak) return "on-break";
  return "active";
}

export function shouldMonitor(i: MonitoringInputs): boolean {
  return getMonitoringStatus(i) === "active";
}

/**
 * Screen recording is always on: it runs whenever the app is signed in (which it
 * restores by itself when the computer starts), whether or not the employee is
 * clocked in or on a break. Only signing out -- or not having accepted the
 * current notice, which the caller enforces by never arming it -- stops it.
 * Activity pings, input counts and the idle prompt still follow shouldMonitor().
 */
export function shouldRecord(i: MonitoringInputs): boolean {
  return i.signedIn;
}

/** One line for the tray menu. */
export function describeMonitoringStatus(status: MonitoringStatus, breakMinutesLeft = 0): string {
  switch (status) {
    case "signed-out":
      return "Signed out";
    case "not-clocked-in":
      return "Not clocked in — monitoring paused";
    case "on-break":
      return `Clocked in — On Break (${breakMinutesLeft > 0 ? `${breakMinutesLeft}m` : "<1m"} left, monitoring paused)`;
    case "active":
      return "Clocked in — monitoring active";
  }
}
