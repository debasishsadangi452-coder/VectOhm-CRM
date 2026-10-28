import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { LeaveStatus, Prisma, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { isHrUser } from "../../common/utils/directory-access";
import { AttendancePolicyService } from "./attendance-policy.service";
import type { RequestUser } from "../../common/types/request-user.type";
import {
  addDaysToKey,
  attendanceTrackedWhere,
  dayKey,
  eachDayKey,
  isValidDayKey,
  isWeeklyOff,
  leaveCoversDay,
  shiftDayKey,
  shiftDayWindow,
} from "./work-policy";

export type DayType = "WORKING" | "HOLIDAY" | "WEEKEND" | "LEAVE";

export interface DayStatusRow {
  userId: string;
  user: { id: string; firstName: string; lastName: string; avatarUrl: string | null };
  /** Company-timezone calendar day, "YYYY-MM-DD". */
  date: string;
  status: "ABSENT" | "LEAVE";
  /** For LEAVE, the leave type (e.g. SICK). */
  note?: string;
}

const MAX_RANGE_DAYS = 92;
const isValidKey = isValidDayKey;

/**
 * What kind of day it is for a person -- the one place that decides whether
 * someone is expected to work, so lateness, early-leave and no-show checks all
 * agree. Precedence: company holiday, then weekly off, then approved leave.
 */
@Injectable()
export class AttendanceCalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AttendancePolicyService,
  ) {}

  // ─── day type ──────────────────────────────────────────────────────────────

  async getDayType(userId: string, key: string): Promise<{ type: DayType; note?: string }> {
    const holiday = await this.prisma.companyHoliday.findUnique({ where: { date: key } });
    if (holiday) return { type: "HOLIDAY", note: holiday.name };
    if (isWeeklyOff(key, (await this.policy.getGlobal()).weeklyOffDays)) return { type: "WEEKEND" };
    const leave = await this.findApprovedLeave(userId, key);
    if (leave) return { type: "LEAVE", note: leave.type };
    return { type: "WORKING" };
  }

  /** True when this person is expected to work on the day containing `at`. */
  async isWorkingDay(userId: string, at: Date): Promise<boolean> {
    return (await this.getDayType(userId, shiftDayKey(at))).type === "WORKING";
  }

  private findApprovedLeave(userId: string, key: string) {
    // Leave dates are date-only values stored at midnight UTC, so a leave covers
    // `key` when it starts before the end of that UTC day and ends on/after its start.
    return this.prisma.leaveRequest.findFirst({
      where: {
        userId,
        status: LeaveStatus.APPROVED,
        startDate: { lt: new Date(`${addDaysToKey(key, 1)}T00:00:00Z`) },
        endDate: { gte: new Date(`${key}T00:00:00Z`) },
      },
      select: { type: true },
    });
  }

  // ─── holidays ──────────────────────────────────────────────────────────────

  listHolidays(range?: { from?: string; to?: string }) {
    const date: Prisma.StringFilter = {};
    if (range?.from) date.gte = range.from;
    if (range?.to) date.lte = range.to;
    return this.prisma.companyHoliday.findMany({
      where: Object.keys(date).length ? { date } : {},
      orderBy: { date: "asc" },
    });
  }

  async createHoliday(user: RequestUser, date: string, name: string) {
    this.assertCanManageHolidays(user);
    if (!isValidKey(date)) throw new BadRequestException("Date must be a valid YYYY-MM-DD day.");
    const existing = await this.prisma.companyHoliday.findUnique({ where: { date } });
    if (existing) throw new ConflictException(`${date} is already a holiday (${existing.name}).`);
    return this.prisma.companyHoliday.create({ data: { date, name: name.trim(), createdById: user.id } });
  }

  async deleteHoliday(user: RequestUser, id: string) {
    this.assertCanManageHolidays(user);
    const holiday = await this.prisma.companyHoliday.findUnique({ where: { id } });
    if (!holiday) throw new NotFoundException("Holiday not found.");
    await this.prisma.companyHoliday.delete({ where: { id } });
    return { success: true };
  }

  private assertCanManageHolidays(user: RequestUser) {
    if (user.role.name !== RoleName.ADMIN && !isHrUser(user)) {
      throw new ForbiddenException("Only Admin and HR can manage holidays.");
    }
  }

  // ─── "Absent" / "On leave" rows for the Attendance page ────────────────────

  /**
   * The days in [from, to] on which someone was expected to work but did not
   * clock in -- either because they were on approved leave, or because the
   * no-show job marked them absent. Days with a session are not listed (they are
   * shown as sessions), nor are holidays, weekly offs or the future.
   */
  async listDayStatuses(
    requestingUser: RequestUser,
    opts: { userId?: string; from?: string; to?: string },
    now: Date = new Date(),
  ): Promise<DayStatusRow[]> {
    const today = shiftDayKey(now);
    const to = opts.to && isValidKey(opts.to) ? (opts.to > today ? today : opts.to) : today;
    const from = opts.from && isValidKey(opts.from) ? opts.from : addDaysToKey(to, -29);
    if (from > to) return [];
    if (eachDayKey(from, to).length > MAX_RANGE_DAYS) {
      throw new BadRequestException(`Choose a range of at most ${MAX_RANGE_DAYS} days.`);
    }

    const { weeklyOffDays, absenceTrackingStart } = await this.policy.getGlobal();
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        ...attendanceTrackedWhere(),
        ...this.scopeUserWhere(requestingUser, opts.userId),
      },
      select: { id: true, firstName: true, lastName: true, avatarUrl: true, createdAt: true },
    });
    if (users.length === 0) return [];
    const ids = users.map((u) => u.id);

    const rangeStart = shiftDayWindow(from).start;
    const rangeEnd = shiftDayWindow(to).end;
    const [sessions, leaves, absences, holidays] = await Promise.all([
      this.prisma.workSession.findMany({
        where: { userId: { in: ids }, clockInAt: { gte: rangeStart, lt: rangeEnd } },
        select: { userId: true, clockInAt: true },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          userId: { in: ids },
          status: LeaveStatus.APPROVED,
          startDate: { lt: new Date(`${addDaysToKey(to, 1)}T00:00:00Z`) },
          endDate: { gte: new Date(`${from}T00:00:00Z`) },
        },
        select: { userId: true, type: true, startDate: true, endDate: true },
      }),
      this.prisma.absenceRecord.findMany({
        where: { userId: { in: ids }, date: { gte: from, lte: to } },
        select: { userId: true, date: true },
      }),
      this.listHolidays({ from, to }),
    ]);

    const worked = new Set(sessions.map((s) => `${s.userId}|${shiftDayKey(s.clockInAt)}`));
    const absent = new Set(absences.map((a) => `${a.userId}|${a.date}`));
    const holidayKeys = new Set(holidays.map((h) => h.date));
    const leavesByUser = new Map<string, typeof leaves>();
    for (const l of leaves) leavesByUser.set(l.userId, [...(leavesByUser.get(l.userId) ?? []), l]);

    const rows: DayStatusRow[] = [];
    for (const u of users) {
      const joined = dayKey(u.createdAt);
      const person = { id: u.id, firstName: u.firstName, lastName: u.lastName, avatarUrl: u.avatarUrl };
      for (const key of eachDayKey(from, to)) {
        // Not their first day either: the account may have been created after the shift began.
        if (key <= joined || holidayKeys.has(key) || isWeeklyOff(key, weeklyOffDays)) continue;
        if (worked.has(`${u.id}|${key}`)) continue;
        const leave = (leavesByUser.get(u.id) ?? []).find((l) => leaveCoversDay(l.startDate, l.endDate, key));
        if (leave) {
          rows.push({ userId: u.id, user: person, date: key, status: "LEAVE", note: leave.type });
        } else if (
          absent.has(`${u.id}|${key}`) ||
          // A finished working day with no session and no leave is an absence even if the
          // no-show job wasn't running then -- but only from when tracking started, so
          // turning this on doesn't retroactively mark everyone absent for past weeks.
          (key < today && (!absenceTrackingStart || key >= absenceTrackingStart))
        ) {
          rows.push({ userId: u.id, user: person, date: key, status: "ABSENT" });
        }
      }
    }
    return rows.sort((a, b) => b.date.localeCompare(a.date) || a.user.firstName.localeCompare(b.user.firstName));
  }

  /** Same visibility rules as the sessions list: Admin/HR everyone, Managers their department, others themselves. */
  scopeUserWhere(user: RequestUser, userId?: string): Prisma.UserWhereInput {
    const fullAccess = user.role.name === RoleName.ADMIN || isHrUser(user);
    if (fullAccess) return userId ? { id: userId } : {};
    if (user.role.name === RoleName.MANAGER && user.department?.id) {
      const inDept = { departmentId: user.department.id };
      return userId ? { AND: [{ id: userId }, inDept] } : inDept;
    }
    return { id: user.id };
  }
}
