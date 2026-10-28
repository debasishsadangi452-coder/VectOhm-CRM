// Pure logic behind the Attendance page: formatting, filtering, summary numbers
// and the rows shown in each tab. Kept out of the component so it can be tested.
import type { AttendanceCalendar, DayStatus, PersonRef, WorkSession } from "./api/types";

const TZ = "Asia/Kolkata";

export const ALL = "__all__";

export type StatusFilter = "all" | "late" | "early" | "idle" | "flagged" | "active" | "absent" | "review";

// ─── formatting (company timezone) ──────────────────────────────────────────

/** YYYY-MM-DD in the company timezone, `offsetDays` from `base`. */
export function isoDay(offsetDays = 0, base = new Date()): string {
  return new Date(base.getTime() + offsetDays * 86_400_000).toLocaleDateString("en-CA", { timeZone: TZ });
}

export function dayKeyOf(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
}

export function fmtDate(iso: string, withWeekday = false): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    timeZone: TZ,
    ...(withWeekday ? { weekday: "short" } : {}),
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
}

/** A "YYYY-MM-DD" day key as a readable date, e.g. "Mon, 5 Oct 2026". */
export function fmtDayKey(key: string, withWeekday = true): string {
  return fmtDate(`${key}T12:00:00+05:30`, withWeekday);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const LEAVE_LABELS: Record<string, string> = {
  ANNUAL: "Annual leave",
  SICK: "Sick leave",
  CASUAL: "Casual leave",
  UNPAID: "Unpaid leave",
  MATERNITY_PATERNITY: "Parental leave",
};

export function leaveLabel(type?: string): string {
  return (type && LEAVE_LABELS[type]) || "On leave";
}

// ─── per-session helpers ────────────────────────────────────────────────────

export function idleTotal(s: WorkSession): number {
  return (s.idleEvents ?? []).reduce((sum, e) => sum + e.idleMinutes, 0);
}

export function personName(p?: PersonRef | null): string {
  return p ? `${p.firstName} ${p.lastName}` : "—";
}

/** The system closed this session because it was left open. */
export const isAutoClosed = (s: WorkSession) => !!s.autoClosed;

/** Auto-closed and the employee has not yet said when they really finished. */
export const awaitingCorrection = (s: WorkSession) => !!s.autoClosed && !s.correctionSubmittedAt;

const hasIdle = (s: WorkSession) => (s.idleEvents?.length ?? 0) > 0;

/** A late arrival that still counts against the person (not excused by HR). */
export const lateCounts = (s: WorkSession) => s.lateByMin != null && s.lateReviewStatus !== "EXCUSED";
/** An early leave that still counts against the person. */
export const earlyCounts = (s: WorkSession) => s.earlyByMin != null && s.earlyReviewStatus !== "EXCUSED";

/** They gave a reason for being late and nobody has decided on it yet. */
export const lateNeedsReview = (s: WorkSession) => s.lateByMin != null && !!s.lateReason && !s.lateReviewStatus;
export const earlyNeedsReview = (s: WorkSession) => s.earlyByMin != null && !!s.earlyReason && !s.earlyReviewStatus;
export const needsReview = (s: WorkSession) => lateNeedsReview(s) || earlyNeedsReview(s);

export function reviewLabel(status?: "EXCUSED" | "REJECTED" | null): string | null {
  return status === "EXCUSED" ? "Excused" : status === "REJECTED" ? "Not accepted" : null;
}

// ─── filtering ──────────────────────────────────────────────────────────────

interface Filter {
  employeeId: string;
  status: StatusFilter;
}

export function filterSessions(sessions: WorkSession[], { employeeId, status }: Filter): WorkSession[] {
  return sessions.filter((s) => {
    if (employeeId !== ALL && s.userId !== employeeId) return false;
    switch (status) {
      case "late":
        return s.lateByMin != null;
      case "early":
        return s.earlyByMin != null;
      case "idle":
        return hasIdle(s);
      case "flagged":
        return s.lateByMin != null || s.earlyByMin != null || hasIdle(s) || isAutoClosed(s);
      case "active":
        return !s.clockOutAt;
      case "review":
        return needsReview(s);
      case "absent":
        return false; // this filter is about days without a session
      default:
        return true;
    }
  });
}

export function filterDayStatuses(rows: DayStatus[], { employeeId, status }: Filter): DayStatus[] {
  return rows.filter((r) => {
    if (employeeId !== ALL && r.userId !== employeeId) return false;
    switch (status) {
      case "all":
      case "absent":
        return true; // absent AND on-leave days
      case "flagged":
        return r.status === "ABSENT"; // being on approved leave is not a problem
      default:
        return false; // late / early / idle / active only make sense for sessions
    }
  });
}

// ─── summary numbers ────────────────────────────────────────────────────────

export interface AttendanceStats {
  total: number;
  late: number;
  avgLate: number;
  early: number;
  idleEvents: number;
  idleMin: number;
  absent: number;
  onLeave: number;
  noClockOut: number;
  /** Late arrivals / early leaves HR has excused (not included in `late` / `early`). */
  lateExcused: number;
  earlyExcused: number;
  /** Reasons given that nobody has reviewed yet. */
  toReview: number;
}

export function computeStats(sessions: WorkSession[], statuses: DayStatus[], employeeId: string): AttendanceStats {
  const list = sessions.filter((s) => employeeId === ALL || s.userId === employeeId);
  const days = statuses.filter((r) => employeeId === ALL || r.userId === employeeId);
  const late = list.filter(lateCounts);
  return {
    total: list.length,
    late: late.length,
    avgLate: late.length ? Math.round(late.reduce((n, s) => n + (s.lateByMin ?? 0), 0) / late.length) : 0,
    early: list.filter(earlyCounts).length,
    lateExcused: list.filter((s) => s.lateByMin != null && s.lateReviewStatus === "EXCUSED").length,
    earlyExcused: list.filter((s) => s.earlyByMin != null && s.earlyReviewStatus === "EXCUSED").length,
    toReview: list.filter(needsReview).length,
    idleEvents: list.reduce((n, s) => n + (s.idleEvents?.length ?? 0), 0),
    idleMin: list.reduce((n, s) => n + idleTotal(s), 0),
    absent: days.filter((r) => r.status === "ABSENT").length,
    onLeave: days.filter((r) => r.status === "LEAVE").length,
    noClockOut: list.filter(isAutoClosed).length,
  };
}

// ─── the "All sessions" tab: sessions plus absent / on-leave days ───────────

export type SessionTabRow =
  | { kind: "session"; at: number; session: WorkSession }
  | { kind: "day"; at: number; day: DayStatus };

export function mergeSessionRows(sessions: WorkSession[], days: DayStatus[]): SessionTabRow[] {
  const rows: SessionTabRow[] = [
    ...sessions.map((session) => ({ kind: "session" as const, at: Date.parse(session.clockInAt), session })),
    ...days.map((day) => ({ kind: "day" as const, at: Date.parse(`${day.date}T12:00:00+05:30`), day })),
  ];
  return rows.sort((a, b) => b.at - a.at);
}

// ─── the "Late & Idle report" tab ───────────────────────────────────────────

export type ReportKind = "late" | "early" | "idle" | "absent" | "noclockout";

export interface ReportRow {
  key: string;
  at: number;
  kind: ReportKind;
  userId: string;
  person?: PersonRef | null;
  /** The session this row belongs to, when it has one (absences don't). */
  session?: WorkSession;
  detail: string;
  /** The reason the employee gave; null if none (yet). */
  reason: string | null;
  /** HR's decision on that reason, for late / early rows. */
  review?: { status: "EXCUSED" | "REJECTED" | null; note: string | null };
}

/** Which kinds of row a status filter shows. */
function kindsFor(status: StatusFilter): ReportKind[] {
  switch (status) {
    case "late":
      return ["late"];
    case "early":
      return ["early"];
    case "idle":
      return ["idle"];
    case "absent":
      return ["absent"];
    case "review":
      return ["late", "early"];
    default:
      return ["late", "early", "idle", "absent", "noclockout"];
  }
}

export function buildReportRows(sessions: WorkSession[], days: DayStatus[], status: StatusFilter): ReportRow[] {
  const kinds = new Set(kindsFor(status));
  const rows: ReportRow[] = [];
  const onlyUnreviewed = status === "review";

  for (const s of sessions) {
    if (kinds.has("late") && s.lateByMin != null && (!onlyUnreviewed || lateNeedsReview(s))) {
      rows.push({
        key: `${s.id}-late`,
        at: Date.parse(s.clockInAt),
        kind: "late",
        userId: s.userId,
        person: s.user,
        session: s,
        detail: `Clocked in ${fmtTime(s.clockInAt)} — ${formatDuration(s.lateByMin)} late`,
        reason: s.lateReason ?? null,
        review: { status: s.lateReviewStatus ?? null, note: s.lateReviewNote ?? null },
      });
    }
    if (kinds.has("early") && s.earlyByMin != null && (!onlyUnreviewed || earlyNeedsReview(s))) {
      rows.push({
        key: `${s.id}-early`,
        at: Date.parse(s.clockOutAt ?? s.clockInAt),
        kind: "early",
        userId: s.userId,
        person: s.user,
        session: s,
        detail: `Clocked out ${s.clockOutAt ? fmtTime(s.clockOutAt) : ""} — ${formatDuration(s.earlyByMin)} before shift end`,
        reason: s.earlyReason ?? null,
        review: { status: s.earlyReviewStatus ?? null, note: s.earlyReviewNote ?? null },
      });
    }
    if (kinds.has("noclockout") && isAutoClosed(s)) {
      const closedAt = s.clockOutAt ? fmtTime(s.clockOutAt) : "";
      rows.push({
        key: `${s.id}-noclockout`,
        at: Date.parse(s.clockOutAt ?? s.clockInAt),
        kind: "noclockout",
        userId: s.userId,
        person: s.user,
        session: s,
        detail: s.correctionSubmittedAt
          ? `Forgot to clock out — employee corrected it to ${s.correctedClockOutAt ? fmtTime(s.correctedClockOutAt) : closedAt}`
          : `Forgot to clock out — closed automatically at ${closedAt}`,
        reason: s.correctionNote ?? null,
      });
    }
    if (kinds.has("idle")) {
      for (const e of s.idleEvents ?? []) {
        rows.push({
          key: e.id,
          at: Date.parse(e.idleStartedAt),
          kind: "idle",
          userId: s.userId,
          person: s.user,
          session: s,
          detail: `Idle ${formatDuration(e.idleMinutes)} from ${fmtTime(e.idleStartedAt)}`,
          reason: e.reason,
        });
      }
    }
  }

  if (kinds.has("absent")) {
    for (const d of days) {
      if (d.status !== "ABSENT") continue;
      rows.push({
        key: `${d.userId}-${d.date}-absent`,
        at: Date.parse(`${d.date}T12:00:00+05:30`),
        kind: "absent",
        userId: d.userId,
        person: d.user,
        detail: "Did not clock in",
        reason: null,
      });
    }
  }

  return rows.sort((a, b) => b.at - a.at);
}

// ─── the "Daily summary" tab ────────────────────────────────────────────────

export interface DailyRow {
  key: string;
  sessions: number;
  totalMin: number;
  late: number;
  idle: number;
  absent: number;
  onLeave: number;
  /** "Weekend", or the holiday's name; null on a normal working day. */
  note: string | null;
}

export function buildDailySummary(
  sessions: WorkSession[],
  days: DayStatus[],
  calendar?: AttendanceCalendar,
): DailyRow[] {
  const holidayByKey = new Map((calendar?.holidays ?? []).map((h) => [h.date, h.name]));
  const weeklyOff = new Set(calendar?.weeklyOffDays ?? []);
  const rows = new Map<string, DailyRow>();

  const get = (key: string): DailyRow => {
    let row = rows.get(key);
    if (!row) {
      const holiday = holidayByKey.get(key);
      const weekend = weeklyOff.has(new Date(`${key}T00:00:00Z`).getUTCDay());
      row = {
        key,
        sessions: 0,
        totalMin: 0,
        late: 0,
        idle: 0,
        absent: 0,
        onLeave: 0,
        note: holiday ? `Holiday: ${holiday}` : weekend ? "Weekend" : null,
      };
      rows.set(key, row);
    }
    return row;
  };

  for (const s of sessions) {
    const row = get(dayKeyOf(s.clockInAt));
    row.sessions += 1;
    row.totalMin += s.durationMin ?? 0;
    if (lateCounts(s)) row.late += 1;
    row.idle += s.idleEvents?.length ?? 0;
  }
  for (const d of days) {
    const row = get(d.date);
    if (d.status === "ABSENT") row.absent += 1;
    else row.onLeave += 1;
  }
  // Holidays are shown even when nobody worked, so the gap is explained.
  for (const h of calendar?.holidays ?? []) get(h.date);

  return Array.from(rows.values()).sort((a, b) => b.key.localeCompare(a.key));
}

// ─── the monthly report ─────────────────────────────────────────────────────

/** "YYYY-MM" of the current month in the company timezone. */
export function currentMonthKey(now = new Date()): string {
  return isoDay(0, now).slice(0, 7);
}

/** First and last day ("YYYY-MM-DD") of a "YYYY-MM" month. */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); // day 0 of next month = last day of this one
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

/** Shifts a "YYYY-MM" month by whole months. */
export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string): string {
  return new Date(`${month}-01T12:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

export type ReportSortKey =
  | "name"
  | "daysAbsent"
  | "lateCount"
  | "earlyCount"
  | "idleMin"
  | "totalWorkedMin"
  | "avgWorkedMin"
  | "shortDays"
  | "overtimeMin";

/** A sorted copy. Numbers sort high-to-low first; names A-Z. Ties fall back to name. */
export function sortReportRows<T extends { name: string } & Record<ReportSortKey, string | number>>(
  rows: T[],
  key: ReportSortKey,
  direction: "asc" | "desc" = key === "name" ? "asc" : "desc",
): T[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
    return cmp * sign || a.name.localeCompare(b.name);
  });
}
