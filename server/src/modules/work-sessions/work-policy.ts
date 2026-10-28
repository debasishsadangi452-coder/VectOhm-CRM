import type { RoleName } from "@prisma/client";
// Attendance policy knobs. Change these to match the company's working hours.
export const DEFAULT_SHIFT_START = "10:00"; // used when a user has none; per-user value lives on User.shiftStart
export const DEFAULT_SHIFT_END = "19:00";
export const EARLY_GRACE_MIN = 5; // clocking out up to this long before shiftEnd is not "early"
export const SHIFT_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const LATE_GRACE_MIN = 10; // clock in up to this long after SHIFT_START without being "late"
export const WORK_TZ_OFFSET_MIN = 330; // Asia/Kolkata (UTC+05:30, no DST)
export const SHIFT_DAY_START_MIN = 8 * 60; // a shift day runs 08:00 to 08:00 (see "Shift days" below)
// The one idle limit: no keyboard/mouse input for this long = idle (live board "Idle", pings not "active").
export const IDLE_LIMIT_SEC = 10 * 60;
export const IDLE_PROMPT_MIN = 5; // minutes without activity before the CRM asks "are you still working?"

// ─── Calendar rules ───────────────────────────────────────────────────────────
// Days the company is closed every week, as JS weekday numbers in the company
// timezone (0 = Sunday ... 6 = Saturday). Nobody is marked late or absent on these.
export const WEEKLY_OFF_DAYS = [0, 6];
// Roles that are not expected to clock in, so are never marked absent.
export const ATTENDANCE_EXEMPT_ROLES = ["ADMIN"];
// Accounts that clock in and are tracked even though their role is exempt.
export const ATTENDANCE_TRACKED_EMAILS = ["jivan@venushiring.com"];
/** Prisma filter for users expected to clock in: non-exempt roles, plus the tracked accounts. */
export const attendanceTrackedWhere = () => ({
  OR: [
    { role: { name: { notIn: ATTENDANCE_EXEMPT_ROLES as RoleName[] } } },
    { email: { in: ATTENDANCE_TRACKED_EMAILS, mode: "insensitive" as const } },
  ],
});
// Someone who still has not clocked in this long after THEIR shift start (and is
// not on leave) is marked absent.
export const ABSENT_AFTER_SHIFT_START_MIN = 60;
// A session still open after this long is assumed forgotten and closed by the system.
export const MAX_OPEN_SESSION_HOURS = 14;
// HR and managers are alerted when someone has been late this many times...
export const REPEAT_LATE_THRESHOLD = 3;
// ...within this many days.
export const REPEAT_LATE_WINDOW_DAYS = 7;

// The minimum worked minutes in a working day (8h30m); less is a "short day".
export const MIN_WORK_MINUTES = 510;

/**
 * The attendance rules in force. The constants above are only the defaults:
 * Admin/HR can change them (see AttendancePolicyService), per company and, for
 * some of them, per department -- so code that applies a rule takes the value as
 * a parameter instead of reading a constant.
 */
export interface AttendancePolicy {
  lateGraceMin: number;
  earlyGraceMin: number;
  idlePromptMin: number;
  absentAfterMin: number;
  maxOpenSessionHours: number;
  repeatLateThreshold: number;
  repeatLateWindowDays: number;
  minWorkMinutes: number;
  weeklyOffDays: number[];
  /** "YYYY-MM-DD"; days before this are never judged absent or short. */
  absenceTrackingStart: string | null;
}

export const DEFAULT_POLICY: AttendancePolicy = {
  lateGraceMin: LATE_GRACE_MIN,
  earlyGraceMin: EARLY_GRACE_MIN,
  idlePromptMin: IDLE_PROMPT_MIN,
  absentAfterMin: ABSENT_AFTER_SHIFT_START_MIN,
  maxOpenSessionHours: MAX_OPEN_SESSION_HOURS,
  repeatLateThreshold: REPEAT_LATE_THRESHOLD,
  repeatLateWindowDays: REPEAT_LATE_WINDOW_DAYS,
  minWorkMinutes: MIN_WORK_MINUTES,
  weeklyOffDays: WEEKLY_OFF_DAYS,
  absenceTrackingStart: null,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Shifts a UTC instant into "fake UTC" so getUTC* reads the policy-timezone wall clock. */
function toWorkLocal(d: Date) {
  return new Date(d.getTime() + WORK_TZ_OFFSET_MIN * 60 * 1000);
}

/** Start/end (UTC instants) of the policy-timezone calendar day containing `d`. */
export function workDayBounds(d: Date) {
  const local = toWorkLocal(d);
  const startLocal = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
  );
  const start = new Date(startLocal - WORK_TZ_OFFSET_MIN * 60 * 1000);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function minutesIntoWorkDay(d: Date): number {
  const local = toWorkLocal(d);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

/**
 * Minutes since the start of the shift day (08:00) for an instant, 0 to 1439. Shifts here run
 * overnight (e.g. 18:00 to 03:00), so lateness and early clock-out are measured on this scale:
 * 18:00 is 600 and 01:00 the next morning is 1020, which keeps "after midnight" later than "evening".
 */
function minutesIntoShiftDay(d: Date): number {
  return (minutesIntoWorkDay(d) - SHIFT_DAY_START_MIN + 24 * 60) % (24 * 60);
}

/** Same scale for a "HH:MM" shift time. */
function shiftTimeIntoShiftDay(hhmm: string): number {
  return (toMinutes(hhmm) - SHIFT_DAY_START_MIN + 24 * 60) % (24 * 60);
}

/** Minutes past the user's shift start (beyond the grace period), or null if on time. */
export function computeLateByMin(
  clockInAt: Date,
  shiftStart: string,
  graceMin: number = LATE_GRACE_MIN,
): number | null {
  const late = minutesIntoShiftDay(clockInAt) - shiftTimeIntoShiftDay(shiftStart);
  return late > graceMin ? late : null;
}

/**
 * Minutes before the user's shift end that they clocked out, or null if not
 * early. Only meaningful when the clock-out belongs to the same shift day as the
 * clock-in. Works for overnight shifts too (18:00 to 03:00).
 */
export function computeEarlyByMin(
  clockInAt: Date,
  clockOutAt: Date,
  shiftStart: string,
  shiftEnd: string,
  graceMin: number = EARLY_GRACE_MIN,
): number | null {
  if (shiftDayKey(clockInAt) !== shiftDayKey(clockOutAt)) return null;
  const early = shiftTimeIntoShiftDay(shiftEnd) - minutesIntoShiftDay(clockOutAt);
  return early > graceMin ? early : null;
}

// ─── Day keys ("YYYY-MM-DD" in the company timezone) ──────────────────────────

/** The company-timezone calendar day containing an instant, as "YYYY-MM-DD". */
export function dayKey(d: Date): string {
  return toWorkLocal(d).toISOString().slice(0, 10);
}

// ─── Shift days ───────────────────────────────────────────────────────────────
// Everyone works nights, so a shift (18:00 to 03:00) crosses midnight and a calendar date would
// split it in two. A "shift day" starts at SHIFT_DAY_START_MIN (08:00) and runs 24 hours, and is
// named after the calendar date it starts on: the Oct 25 shift day is Oct 25 08:00 to Oct 26 08:00.
// Day-shift people are unaffected (an ordinary 09:00 to 18:00 day sits inside one shift day).

/** The shift day (as "YYYY-MM-DD") that contains an instant. */
export function shiftDayKey(d: Date): string {
  return dayKey(new Date(d.getTime() - SHIFT_DAY_START_MIN * 60_000));
}

/** Start (inclusive) and end (exclusive) instants of a shift day. */
export function shiftDayWindow(key: string): { start: Date; end: Date } {
  const start = new Date(instantAt(key, "00:00").getTime() + SHIFT_DAY_START_MIN * 60_000);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/** The shift day containing an instant, as start/end instants. */
export function shiftDayBounds(d: Date) {
  return shiftDayWindow(shiftDayKey(d));
}

/**
 * True for a real calendar day written "YYYY-MM-DD". Never throws -- "2026-13-45"
 * and "2026-02-30" are simply false (a bare `new Date(...).toISOString()` would throw).
 */
export function isValidDayKey(key: unknown): key is string {
  if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const t = Date.parse(`${key}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === key;
}

/** Shifts a "YYYY-MM-DD" key by whole days. */
export function addDaysToKey(key: string, days: number): string {
  return new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Every day key from `from` to `to`, inclusive. Empty if `to` is before `from`. */
export function eachDayKey(from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = from; k <= to; k = addDaysToKey(k, 1)) out.push(k);
  return out;
}

/** True if this calendar day is one of the company's weekly days off. */
export function isWeeklyOff(key: string, weeklyOffDays: number[] = WEEKLY_OFF_DAYS): boolean {
  return weeklyOffDays.includes(new Date(`${key}T00:00:00Z`).getUTCDay());
}

/** The UTC instant at which company-timezone wall-clock `hhmm` occurs on day `key`. */
export function instantAt(key: string, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.parse(`${key}T00:00:00Z`) + (h * 60 + m) * 60_000 - WORK_TZ_OFFSET_MIN * 60_000);
}

/**
 * True if an approved leave (date-only values, stored at midnight UTC) covers
 * the calendar day `key`.
 */
export function leaveCoversDay(startDate: Date, endDate: Date, key: string): boolean {
  return startDate.toISOString().slice(0, 10) <= key && key <= endDate.toISOString().slice(0, 10);
}

/**
 * When a forgotten session is closed on the person's behalf: the end of their
 * shift on the day they clocked in (the next morning for an overnight shift),
 * but never before they clocked in and never more than MAX_OPEN_SESSION_HOURS after.
 */
export function autoCloseTime(
  clockInAt: Date,
  shiftStart: string,
  shiftEnd: string,
  maxOpenHours: number = MAX_OPEN_SESSION_HOURS,
): Date {
  const overnight = toMinutes(shiftEnd) <= toMinutes(shiftStart);
  // An overnight shift belongs to the shift day it started in, even if they clocked in after midnight.
  const day = overnight ? shiftDayKey(clockInAt) : dayKey(clockInAt);
  const shiftEndAt = instantAt(overnight ? addDaysToKey(day, 1) : day, shiftEnd);
  const latest = new Date(clockInAt.getTime() + maxOpenHours * 60 * 60 * 1000);
  const closeAt = shiftEndAt.getTime() > clockInAt.getTime() ? shiftEndAt : clockInAt;
  return closeAt.getTime() > latest.getTime() ? latest : closeAt;
}
