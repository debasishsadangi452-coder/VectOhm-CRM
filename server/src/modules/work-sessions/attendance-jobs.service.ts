import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { LeaveStatus, NotificationType, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AttendanceOversightService } from "./attendance-oversight.service";
import { AttendancePolicyService } from "./attendance-policy.service";
import {
  addDaysToKey,
  attendanceTrackedWhere,
  autoCloseTime,
  instantAt,
  isWeeklyOff,
  shiftDayKey,
  shiftDayWindow,
} from "./work-policy";

const MAX_NAMES_IN_ALERT = 8;
const BREAK_MAX_MS = 60 * 60 * 1000;

function formatDay(key: string): string {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

/**
 * Two scheduled checks that keep attendance data honest:
 *  - no-shows: people expected to work who never clocked in are marked absent
 *    (and their manager and HR are told),
 *  - forgotten clock-outs: sessions left open for far too long are closed by the
 *    system, flagged, and the employee is asked to correct them.
 */
@Injectable()
export class AttendanceJobsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AttendanceJobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oversight: AttendanceOversightService,
    private readonly policy: AttendancePolicyService,
  ) {}

  onApplicationBootstrap() {
    // Catch up after a restart (e.g. the server was down at the time a check was due).
    this.runAll().catch((err) => this.logger.error("Initial attendance checks failed", err));
  }

  @Cron("*/10 * * * *")
  async runAll() {
    try {
      await this.markAbsences();
    } catch (err) {
      this.logger.error("No-show check failed", err);
    }
    try {
      await this.closeForgottenSessions();
    } catch (err) {
      this.logger.error("Forgotten clock-out check failed", err);
    }
  }

  // ─── no-shows ──────────────────────────────────────────────────────────────

  /**
   * Marks as absent everyone who was expected to work today, is past their shift
   * start + grace, has no session today and isn't on approved leave. Managers and
   * HR get ONE digest per run rather than one alert per person.
   */
  async markAbsences(now: Date = new Date()): Promise<{ marked: number }> {
    const today = shiftDayKey(now);
    const global = await this.policy.getGlobal();
    if (isWeeklyOff(today, global.weeklyOffDays)) return { marked: 0 };
    if (global.absenceTrackingStart && today < global.absenceTrackingStart) return { marked: 0 };
    if (await this.prisma.companyHoliday.findUnique({ where: { date: today } })) return { marked: 0 };

    const users = await this.prisma.user.findMany({
      where: { isActive: true, ...attendanceTrackedWhere() },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        shiftStart: true,
        createdAt: true,
        departmentId: true,
        managerId: true,
      },
    });

    // Due: their shift started at least `absentAfterMin` ago (the rule can differ by
    // department), and the account existed before that shift began (a new hire isn't
    // "absent" on day one).
    const due: typeof users = [];
    for (const u of users) {
      const shiftStartAt = instantAt(today, u.shiftStart);
      const { absentAfterMin } = await this.policy.forDepartment(u.departmentId);
      if (
        now.getTime() >= shiftStartAt.getTime() + absentAfterMin * 60_000 &&
        u.createdAt.getTime() < shiftStartAt.getTime()
      ) {
        due.push(u);
      }
    }
    if (due.length === 0) return { marked: 0 };
    const ids = due.map((u) => u.id);

    const { start: dayStart, end: dayEnd } = shiftDayWindow(today);
    const [sessions, leaves, existing] = await Promise.all([
      this.prisma.workSession.findMany({
        where: { userId: { in: ids }, clockInAt: { gte: dayStart, lt: dayEnd } },
        select: { userId: true },
      }),
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
    ]);
    const skip = new Set([...sessions, ...leaves, ...existing].map((r) => r.userId));
    const absentees = due.filter((u) => !skip.has(u.id));
    if (absentees.length === 0) return { marked: 0 };

    await this.prisma.absenceRecord.createMany({
      data: absentees.map((u) => ({ userId: u.id, date: today })),
      skipDuplicates: true,
    });

    // One digest per recipient, listing the absentees they are responsible for.
    const hrIds = await this.oversight.getHrUserIds();
    const byRecipient = new Map<string, string[]>();
    for (const u of absentees) {
      const name = `${u.firstName} ${u.lastName}`;
      for (const rid of await this.oversight.recipientsFor(u, hrIds)) {
        byRecipient.set(rid, [...(byRecipient.get(rid) ?? []), name]);
      }
    }
    for (const [recipientId, names] of byRecipient) {
      const shown = names.slice(0, MAX_NAMES_IN_ALERT).join(", ");
      const more = names.length > MAX_NAMES_IN_ALERT ? ` and ${names.length - MAX_NAMES_IN_ALERT} more` : "";
      await this.oversight.notify([recipientId], {
        type: NotificationType.ATTENDANCE_ABSENT,
        title: "🚫 Not clocked in",
        message: `${names.length === 1 ? "1 person has" : `${names.length} people have`} not clocked in today (${formatDay(today)}): ${shown}${more}.`,
        link: "/attendance",
      });
    }
    return { marked: absentees.length };
  }

  // ─── forgotten clock-outs ──────────────────────────────────────────────────

  /**
   * Closes sessions that have been open longer than the configured maximum. The
   * recorded clock-out is the end of the person's shift (the best guess at when
   * they stopped), the session is flagged `autoClosed`, and the employee is asked
   * to say when they really finished.
   */
  async closeForgottenSessions(now: Date = new Date()): Promise<{ closed: number }> {
    const { maxOpenSessionHours } = await this.policy.getGlobal();
    const cutoff = new Date(now.getTime() - maxOpenSessionHours * 60 * 60 * 1000);
    const stale = await this.prisma.workSession.findMany({
      where: { clockOutAt: null, clockInAt: { lte: cutoff } },
      include: { user: { select: { id: true, shiftStart: true, shiftEnd: true } } },
    });

    let closed = 0;
    for (const session of stale) {
      try {
        const closeAt = autoCloseTime(
          session.clockInAt,
          session.user.shiftStart,
          session.user.shiftEnd,
          maxOpenSessionHours,
        );

        // Don't leave a break dangling past the close time.
        const openBreaks = await this.prisma.workBreak.findMany({
          where: { workSessionId: session.id, endedAt: null },
        });
        for (const b of openBreaks) {
          const endedAt = new Date(
            Math.max(b.startedAt.getTime(), Math.min(closeAt.getTime(), b.startedAt.getTime() + BREAK_MAX_MS)),
          );
          await this.prisma.workBreak.update({
            where: { id: b.id },
            data: {
              endedAt,
              durationMin: Math.round((endedAt.getTime() - b.startedAt.getTime()) / 60_000),
              autoEnded: true,
            },
          });
        }

        // updateMany with clockOutAt:null so a real clock-out that just landed wins.
        const res = await this.prisma.workSession.updateMany({
          where: { id: session.id, clockOutAt: null },
          data: {
            clockOutAt: closeAt,
            durationMin: Math.max(0, Math.round((closeAt.getTime() - session.clockInAt.getTime()) / 60_000)),
            autoClosed: true,
            autoClosedAt: now,
          },
        });
        if (res.count === 0) continue;
        closed++;

        await this.oversight.notify([session.userId], {
          type: NotificationType.ATTENDANCE_NO_CLOCKOUT,
          title: "⏱ You didn't clock out",
          message: `Your session from ${formatDay(shiftDayKey(session.clockInAt))} was still open, so it was closed automatically. Please tell us when you actually finished.`,
          link: "/attendance",
        });
      } catch (err) {
        this.logger.error(`Failed to auto-close session ${session.id}`, err);
      }
    }
    return { closed };
  }
}
