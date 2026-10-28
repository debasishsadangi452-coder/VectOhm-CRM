import { BadRequestException, Injectable } from "@nestjs/common";
import { LeaveStatus, Prisma, ReasonReviewStatus, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../common/types/request-user.type";
import { AttendanceCalendarService } from "./attendance-calendar.service";
import { AttendancePolicyService } from "./attendance-policy.service";
import {
  addDaysToKey,
  IDLE_LIMIT_SEC,
  attendanceTrackedWhere,
  dayKey,
  eachDayKey,
  instantAt,
  isValidDayKey,
  isWeeklyOff,
  leaveCoversDay,
  shiftDayBounds,
  shiftDayKey,
  shiftDayWindow,
} from "./work-policy";

const MAX_RANGE_DAYS = 366;

/** No input for this long (per the desktop agent) shows someone as "Idle" on the live board. */
export const LIVE_IDLE_SECONDS = IDLE_LIMIT_SEC;
/** A desktop-agent ping newer than this means the agent is running and its idle figure is current. */
export const LIVE_PING_FRESH_MS = 3 * 60 * 1000;

export interface ReportRow {
  userId: string;
  name: string;
  department: string | null;
  /** Working days in the range (not weekends, holidays or approved leave), up to today. */
  expectedDays: number;
  daysWorked: number;
  daysAbsent: number;
  daysOnLeave: number;
  /** Late arrivals that still count (not excused). */
  lateCount: number;
  lateExcused: number;
  avgLateMin: number;
  earlyCount: number;
  earlyExcused: number;
  idleEvents: number;
  idleMin: number;
  /** Sessions the system had to close because the person never clocked out. */
  noClockOut: number;
  /** Clock-in to clock-out, summed over all sessions (breaks included, as in the 8h30m rule). */
  totalWorkedMin: number;
  avgWorkedMin: number;
  /** The minimum per working day that applied to this person. */
  minWorkMinutes: number;
  /** Finished working days under the minimum. */
  shortDays: number;
  shortfallMin: number;
  /** Minutes beyond the minimum on working days, plus all time worked on days off. */
  overtimeMin: number;
}

/**
 * WORKED / ABSENT / LEAVE / HOLIDAY / WEEKEND as expected. PENDING: today and not
 * clocked in yet (not a miss). NA: before the person joined, or before absence
 * tracking started, so there is nothing to judge.
 */
export type DayState = "WORKED" | "ABSENT" | "LEAVE" | "HOLIDAY" | "WEEKEND" | "PENDING" | "NA";

export type LiveStatus = "WORKING" | "ON_BREAK" | "IDLE" | "NOT_IN" | "NOT_YET" | "CLOCKED_OUT" | "ON_LEAVE" | "OFF";

export interface LivePerson {
  userId: string;
  name: string;
  department: string | null;
  avatarUrl: string | null;
  status: LiveStatus;
  /** When this status began (clock-in, break start, ...), if known. */
  since: string | null;
  /** Minutes late at clock-in (WORKING / ON_BREAK / IDLE), or minutes overdue (NOT_IN). */
  lateByMin: number | null;
  idleMin: number | null;
  shiftStart: string;
  shiftEnd: string;
  /** Marked absent by the no-show check. */
  markedAbsent: boolean;
}

const isValidKey = isValidDayKey;

const countsLate = (s: { lateByMin: number | null; lateReviewStatus: ReasonReviewStatus | null }) =>
  s.lateByMin != null && s.lateReviewStatus !== ReasonReviewStatus.EXCUSED;
const countsEarly = (s: { earlyByMin: number | null; earlyReviewStatus: ReasonReviewStatus | null }) =>
  s.earlyByMin != null && s.earlyReviewStatus !== ReasonReviewStatus.EXCUSED;

@Injectable()
export class AttendanceReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendar: AttendanceCalendarService,
    private readonly policy: AttendancePolicyService,
  ) {}

  // ─── monthly (or any range) report ─────────────────────────────────────────

  async buildReport(
    requestingUser: RequestUser,
    opts: { from?: string; to?: string; userId?: string; departmentId?: string },
    now: Date = new Date(),
  ) {
    const today = shiftDayKey(now);
    const to = opts.to && isValidKey(opts.to) ? (opts.to > today ? today : opts.to) : today;
    const from = opts.from && isValidKey(opts.from) ? opts.from : `${to.slice(0, 7)}-01`;
    if (from > to) return { from, to, rows: [] as ReportRow[], totals: this.totals([]) };
    if (eachDayKey(from, to).length > MAX_RANGE_DAYS) {
      throw new BadRequestException(`Choose a range of at most ${MAX_RANGE_DAYS} days.`);
    }

    const where: Prisma.UserWhereInput = {
      isActive: true,
      ...attendanceTrackedWhere(),
      ...this.calendar.scopeUserWhere(requestingUser, opts.userId),
      ...(opts.departmentId ? { departmentId: opts.departmentId } : {}),
    };
    const rows = await this.computeRows(where, from, to, now);
    return { from, to, rows, totals: this.totals(rows) };
  }

  private async computeRows(where: Prisma.UserWhereInput, from: string, to: string, now: Date): Promise<ReportRow[]> {
    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        departmentId: true,
        department: { select: { name: true } },
        role: { select: { name: true } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });
    if (users.length === 0) return [];
    const ids = users.map((u) => u.id);
    const today = shiftDayKey(now);

    const [sessions, leaves, holidays, absences, global] = await Promise.all([
      this.prisma.workSession.findMany({
        where: { userId: { in: ids }, clockInAt: { gte: shiftDayWindow(from).start, lt: shiftDayWindow(to).end } },
        include: { idleEvents: { select: { idleMinutes: true } } },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          userId: { in: ids },
          status: LeaveStatus.APPROVED,
          startDate: { lt: new Date(`${addDaysToKey(to, 1)}T00:00:00Z`) },
          endDate: { gte: new Date(`${from}T00:00:00Z`) },
        },
        select: { userId: true, startDate: true, endDate: true },
      }),
      this.calendar.listHolidays({ from, to }),
      this.prisma.absenceRecord.findMany({ where: { userId: { in: ids }, date: { gte: from, lte: to } }, select: { userId: true, date: true } }),
      this.policy.getGlobal(),
    ]);

    const holidayKeys = new Set(holidays.map((h) => h.date));
    const absentToday = new Set(absences.map((a) => `${a.userId}|${a.date}`));
    const sessionsByUserDay = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const k = `${s.userId}|${shiftDayKey(s.clockInAt)}`;
      sessionsByUserDay.set(k, [...(sessionsByUserDay.get(k) ?? []), s]);
    }
    const leavesByUser = new Map<string, typeof leaves>();
    for (const l of leaves) leavesByUser.set(l.userId, [...(leavesByUser.get(l.userId) ?? []), l]);

    const rows: ReportRow[] = [];
    for (const u of users) {
      const rules = await this.policy.forDepartment(u.departmentId);
      const joined = dayKey(u.createdAt);
      const row: ReportRow = {
        userId: u.id,
        name: `${u.firstName} ${u.lastName}`,
        department: u.department?.name ?? null,
        expectedDays: 0,
        daysWorked: 0,
        daysAbsent: 0,
        daysOnLeave: 0,
        lateCount: 0,
        lateExcused: 0,
        avgLateMin: 0,
        earlyCount: 0,
        earlyExcused: 0,
        idleEvents: 0,
        idleMin: 0,
        noClockOut: 0,
        totalWorkedMin: 0,
        avgWorkedMin: 0,
        minWorkMinutes: rules.minWorkMinutes,
        shortDays: 0,
        shortfallMin: 0,
        overtimeMin: 0,
      };
      let lateSum = 0;

      for (const key of eachDayKey(from, to)) {
        if (key < joined) continue;
        const daySessions = sessionsByUserDay.get(`${u.id}|${key}`) ?? [];
        const nonWorkingDay = holidayKeys.has(key) || isWeeklyOff(key, global.weeklyOffDays);
        const onLeave = (leavesByUser.get(u.id) ?? []).some((l) => leaveCoversDay(l.startDate, l.endDate, key));

        // What was worked, whatever kind of day it was. An open session counts up to now.
        let dayMin = 0;
        for (const s of daySessions) {
          dayMin += s.durationMin ?? (s.clockOutAt ? 0 : Math.max(0, Math.round((now.getTime() - s.clockInAt.getTime()) / 60_000)));
          if (countsLate(s)) {
            row.lateCount++;
            lateSum += s.lateByMin ?? 0;
          } else if (s.lateByMin != null) {
            row.lateExcused++;
          }
          if (countsEarly(s)) row.earlyCount++;
          else if (s.earlyByMin != null) row.earlyExcused++;
          for (const e of s.idleEvents) {
            row.idleEvents++;
            row.idleMin += e.idleMinutes;
          }
          if (s.autoClosed) row.noClockOut++;
        }
        row.totalWorkedMin += dayMin;
        if (daySessions.length > 0) row.daysWorked++;

        // Their first day isn't judged: the account may have been created after the shift
        // began (the no-show check skips new hires on day one too).
        if (key === joined) continue;

        const finished = key < today;
        const tracked = !global.absenceTrackingStart || key >= global.absenceTrackingStart;

        if (nonWorkingDay) {
          // Working on a holiday or weekend is overtime in full.
          if (finished) row.overtimeMin += dayMin;
          continue;
        }
        if (onLeave) {
          row.daysOnLeave++;
          if (finished) row.overtimeMin += dayMin;
          continue;
        }

        row.expectedDays++;
        if (daySessions.length === 0) {
          if ((finished && tracked) || absentToday.has(`${u.id}|${key}`)) row.daysAbsent++;
          continue;
        }
        if (finished && tracked) {
          if (dayMin < rules.minWorkMinutes) {
            row.shortDays++;
            row.shortfallMin += rules.minWorkMinutes - dayMin;
          } else {
            row.overtimeMin += dayMin - rules.minWorkMinutes;
          }
        }
      }

      row.avgLateMin = row.lateCount ? Math.round(lateSum / row.lateCount) : 0;
      row.avgWorkedMin = row.daysWorked ? Math.round(row.totalWorkedMin / row.daysWorked) : 0;
      rows.push(row);
    }
    return rows;
  }

  private totals(rows: ReportRow[]) {
    const sum = (f: (r: ReportRow) => number) => rows.reduce((n, r) => n + f(r), 0);
    const lateSum = rows.reduce((n, r) => n + r.avgLateMin * r.lateCount, 0);
    const daysWorked = sum((r) => r.daysWorked);
    return {
      people: rows.length,
      expectedDays: sum((r) => r.expectedDays),
      daysWorked,
      daysAbsent: sum((r) => r.daysAbsent),
      daysOnLeave: sum((r) => r.daysOnLeave),
      lateCount: sum((r) => r.lateCount),
      lateExcused: sum((r) => r.lateExcused),
      avgLateMin: sum((r) => r.lateCount) ? Math.round(lateSum / sum((r) => r.lateCount)) : 0,
      earlyCount: sum((r) => r.earlyCount),
      earlyExcused: sum((r) => r.earlyExcused),
      idleEvents: sum((r) => r.idleEvents),
      idleMin: sum((r) => r.idleMin),
      noClockOut: sum((r) => r.noClockOut),
      totalWorkedMin: sum((r) => r.totalWorkedMin),
      avgWorkedMin: daysWorked ? Math.round(sum((r) => r.totalWorkedMin) / daysWorked) : 0,
      shortDays: sum((r) => r.shortDays),
      shortfallMin: sum((r) => r.shortfallMin),
      overtimeMin: sum((r) => r.overtimeMin),
    };
  }

  // ─── "My attendance" ───────────────────────────────────────────────────────

  /** This month's numbers for the person themselves, their streaks, and the last two weeks day by day. */
  async mySummary(user: RequestUser, now: Date = new Date()) {
    const today = shiftDayKey(now);
    const monthStart = `${today.slice(0, 7)}-01`;
    const [row] = await this.computeRows({ id: user.id }, monthStart, today, now);

    const lookbackFrom = addDaysToKey(today, -120);
    const [dbUser, sessions, leaves, holidays, global, rules] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: user.id }, select: { createdAt: true } }),
      this.prisma.workSession.findMany({
        where: { userId: user.id, clockInAt: { gte: shiftDayWindow(lookbackFrom).start } },
        select: { clockInAt: true, durationMin: true, clockOutAt: true, lateByMin: true, lateReviewStatus: true },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          userId: user.id,
          status: LeaveStatus.APPROVED,
          endDate: { gte: new Date(`${lookbackFrom}T00:00:00Z`) },
        },
        select: { startDate: true, endDate: true },
      }),
      this.calendar.listHolidays({ from: lookbackFrom, to: today }),
      this.policy.getGlobal(),
      this.policy.forUser(user.id),
    ]);

    const joined = dbUser ? dayKey(dbUser.createdAt) : lookbackFrom;
    const holidayKeys = new Set(holidays.map((h) => h.date));
    const byDay = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const k = shiftDayKey(s.clockInAt);
      byDay.set(k, [...(byDay.get(k) ?? []), s]);
    }
    const stateOf = (key: string): DayState => {
      if (byDay.has(key)) return "WORKED";
      if (holidayKeys.has(key)) return "HOLIDAY";
      if (isWeeklyOff(key, global.weeklyOffDays)) return "WEEKEND";
      if (leaves.some((l) => leaveCoversDay(l.startDate, l.endDate, key))) return "LEAVE";
      return "ABSENT";
    };

    // Streaks: walk back from today; days off don't break or extend a streak, a missed working day ends it.
    let presentStreak = 0;
    let onTimeStreak = 0;
    let onTimeBroken = false;
    for (let key = today; key >= lookbackFrom && key >= joined; key = addDaysToKey(key, -1)) {
      const state = stateOf(key);
      if (state === "HOLIDAY" || state === "WEEKEND" || state === "LEAVE") continue;
      if (state === "ABSENT") {
        if (key === today) continue; // today isn't over -- not a miss yet
        break;
      }
      presentStreak++;
      if (!onTimeBroken) {
        if ((byDay.get(key) ?? []).some(countsLate)) onTimeBroken = true;
        else onTimeStreak++;
      }
    }

    const recentDays = eachDayKey(addDaysToKey(today, -13), today)
      .reverse()
      .map((key) => {
        // Before they joined -- or on the day they joined with nothing recorded -- there is nothing to judge.
        let state: DayState = key < joined || (key === joined && !byDay.has(key)) ? "NA" : stateOf(key);
        if (state === "ABSENT") {
          if (key === today) state = "PENDING";
          else if (global.absenceTrackingStart && key < global.absenceTrackingStart) state = "NA";
        }
        const day = byDay.get(key) ?? [];
        const workedMin = day.reduce(
          (n, s) => n + (s.durationMin ?? (s.clockOutAt ? 0 : Math.max(0, Math.round((now.getTime() - s.clockInAt.getTime()) / 60_000)))),
          0,
        );
        const late = day.find((s) => s.lateByMin != null);
        return {
          date: key,
          state,
          workedMin,
          lateByMin: late?.lateByMin ?? null,
          lateExcused: late ? late.lateReviewStatus === ReasonReviewStatus.EXCUSED : false,
        };
      });

    return {
      from: monthStart,
      to: today,
      minWorkMinutes: rules.minWorkMinutes,
      row,
      presentStreak,
      onTimeStreak,
      recentDays,
    };
  }

  // ─── live board ────────────────────────────────────────────────────────────

  async getLiveBoard(
    requestingUser: RequestUser,
    opts: { departmentId?: string },
    now: Date = new Date(),
  ): Promise<{ generatedAt: string; counts: Record<LiveStatus, number>; people: LivePerson[] }> {
    const today = shiftDayKey(now);
    const { start: dayStart, end: dayEnd } = shiftDayBounds(now);

    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        ...attendanceTrackedWhere(),
        ...this.calendar.scopeUserWhere(requestingUser),
        ...(opts.departmentId ? { departmentId: opts.departmentId } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        shiftStart: true,
        shiftEnd: true,
        createdAt: true,
        departmentId: true,
        department: { select: { name: true } },
        role: { select: { name: true } },
      },
    });
    const counts: Record<LiveStatus, number> = {
      WORKING: 0, ON_BREAK: 0, IDLE: 0, NOT_IN: 0, NOT_YET: 0, CLOCKED_OUT: 0, ON_LEAVE: 0, OFF: 0,
    };
    if (users.length === 0) return { generatedAt: now.toISOString(), counts, people: [] };
    const ids = users.map((u) => u.id);

    const [sessions, pings, holiday, leaves, absences, global] = await Promise.all([
      this.prisma.workSession.findMany({
        where: { userId: { in: ids }, clockInAt: { gte: dayStart, lt: dayEnd } },
        include: { breaks: { where: { endedAt: null }, take: 1 } },
        orderBy: { clockInAt: "desc" },
      }),
      this.prisma.activityPing.findMany({
        where: { userId: { in: ids }, capturedAt: { gte: new Date(now.getTime() - LIVE_PING_FRESH_MS) } },
        orderBy: { capturedAt: "desc" },
        select: { userId: true, idleSeconds: true },
      }),
      this.prisma.companyHoliday.findUnique({ where: { date: today } }),
      this.prisma.leaveRequest.findMany({
        where: {
          userId: { in: ids },
          status: LeaveStatus.APPROVED,
          startDate: { lt: new Date(`${addDaysToKey(today, 1)}T00:00:00Z`) },
          endDate: { gte: new Date(`${today}T00:00:00Z`) },
        },
        select: { userId: true },
      }),
      this.prisma.absenceRecord.findMany({ where: { userId: { in: ids }, date: today }, select: { userId: true } }),
      this.policy.getGlobal(),
    ]);

    const sessionsByUser = new Map<string, typeof sessions>();
    for (const s of sessions) sessionsByUser.set(s.userId, [...(sessionsByUser.get(s.userId) ?? []), s]);
    const latestPing = new Map<string, number>();
    for (const p of pings) if (!latestPing.has(p.userId)) latestPing.set(p.userId, p.idleSeconds);
    const onLeave = new Set(leaves.map((l) => l.userId));
    const markedAbsent = new Set(absences.map((a) => a.userId));
    const dayOff = !!holiday || isWeeklyOff(today, global.weeklyOffDays);

    const people: LivePerson[] = [];
    for (const u of users) {
      const rules = await this.policy.forDepartment(u.departmentId);
      const mine = sessionsByUser.get(u.id) ?? [];
      const open = mine.find((s) => !s.clockOutAt);
      const lastClosed = mine.find((s) => s.clockOutAt);
      const shiftStartAt = instantAt(today, u.shiftStart);

      let status: LiveStatus;
      let since: Date | null = null;
      let lateByMin: number | null = null;
      let idleMin: number | null = null;

      if (open) {
        lateByMin = open.lateByMin;
        const idleSec = latestPing.get(u.id);
        if (open.breaks.length > 0) {
          status = "ON_BREAK";
          since = open.breaks[0].startedAt;
        } else if (u.role.name !== RoleName.ADMIN && idleSec != null && idleSec >= LIVE_IDLE_SECONDS) {
          status = "IDLE";
          idleMin = Math.round(idleSec / 60);
          since = new Date(now.getTime() - idleSec * 1000);
        } else {
          status = "WORKING";
          since = open.clockInAt;
        }
      } else if (lastClosed) {
        status = "CLOCKED_OUT";
        since = lastClosed.clockOutAt;
      } else if (dayOff) {
        status = "OFF";
      } else if (onLeave.has(u.id)) {
        status = "ON_LEAVE";
      } else if (u.createdAt.getTime() >= shiftStartAt.getTime() || now.getTime() < shiftStartAt.getTime() + rules.lateGraceMin * 60_000) {
        status = "NOT_YET";
      } else {
        status = "NOT_IN";
        lateByMin = Math.round((now.getTime() - shiftStartAt.getTime()) / 60_000);
        since = shiftStartAt;
      }

      counts[status]++;
      people.push({
        userId: u.id,
        name: `${u.firstName} ${u.lastName}`,
        department: u.department?.name ?? null,
        avatarUrl: u.avatarUrl,
        status,
        since: since ? since.toISOString() : null,
        lateByMin,
        idleMin,
        shiftStart: u.shiftStart,
        shiftEnd: u.shiftEnd,
        markedAbsent: markedAbsent.has(u.id),
      });
    }

    // Who needs attention first: not in, idle, then the rest.
    const order: LiveStatus[] = ["NOT_IN", "IDLE", "ON_BREAK", "WORKING", "NOT_YET", "CLOCKED_OUT", "ON_LEAVE", "OFF"];
    people.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.name.localeCompare(b.name));
    return { generatedAt: now.toISOString(), counts, people };
  }
}
