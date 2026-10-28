import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AttendanceAdjustmentStatus, NotificationType, ReasonReviewStatus, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AttendanceCalendarService } from "./attendance-calendar.service";
import { AttendanceOversightService } from "./attendance-oversight.service";
import { AttendancePolicyService } from "./attendance-policy.service";
import { isHrUser } from "../../common/utils/directory-access";
import type { RequestUser } from "../../common/types/request-user.type";
import {
  computeEarlyByMin,
  computeLateByMin,
  DEFAULT_SHIFT_END,
  DEFAULT_SHIFT_START,
  dayKey,
  shiftDayBounds,
  shiftDayKey,
  shiftDayWindow,
} from "./work-policy";
import type { IdleEventDto } from "./dto/idle-event.dto";
import type { CorrectClockOutDto } from "./dto/correct-clock-out.dto";
import type { ReviewReasonDto } from "./dto/review-reason.dto";

const BREAK_MAX_MS = 60 * 60 * 1000; // 1 hour maximum break duration
const BREAK_COOLDOWN_MS = 5 * 60 * 60 * 1000; // 5 hours cooldown before next break

/** Inclusive YYYY-MM-DD bounds, interpreted in the policy timezone. */
export type DateRange = { from?: string; to?: string };

function clockInFilter(range?: DateRange) {
  if (!range?.from && !range?.to) return {};
  const clockInAt: { gte?: Date; lt?: Date } = {};
  // Dates are shift days (08:00 to 08:00), so a night shift stays on the date it started.
  if (range.from) clockInAt.gte = shiftDayWindow(range.from).start;
  if (range.to) clockInAt.lt = shiftDayWindow(range.to).end;
  return { clockInAt };
}

@Injectable()
export class WorkSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly calendar: AttendanceCalendarService,
    private readonly oversight: AttendanceOversightService,
    private readonly policy: AttendancePolicyService,
  ) {}

  private async getShift(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { shiftStart: true, shiftEnd: true },
    });
    return {
      shiftStart: u?.shiftStart ?? DEFAULT_SHIFT_START,
      shiftEnd: u?.shiftEnd ?? DEFAULT_SHIFT_END,
    };
  }

  /** Tell Admins, HR and the employee's department managers about a late/idle reason. */
  private async notifyOversight(
    user: RequestUser,
    type: NotificationType,
    title: string,
    message: string,
    link = "/attendance",
  ) {
    try {
      const recipients = await this.prisma.user.findMany({
        where: {
          isActive: true,
          id: { not: user.id },
          OR: [
            { role: { name: RoleName.ADMIN } },
            { department: { name: { contains: "hr", mode: "insensitive" } } },
            ...(user.department?.id
              ? [{ departmentId: user.department.id, role: { name: RoleName.MANAGER } }]
              : []),
          ],
        },
        select: { id: true },
      });
      for (const r of recipients) {
        await this.notifications.create({
          userId: r.id,
          type,
          title,
          message,
          link,
        });
      }
    } catch {
      // Notifying is best-effort -- never fail the employee's submission.
    }
  }

  /**
   * Start a new work session for the requesting user.
   * Fails if the user already has an active (un-clocked-out) session.
   */
  async clockIn(user: RequestUser) {
    const active = await this.findActiveSession(user.id);
    if (active) {
      throw new BadRequestException(
        "You already have an active session. Clock out first.",
      );
    }

    const now = new Date();
    // Store the shift day (midnight UTC of its date) for grouping: a night shift clocked in at
    // 01:00 still belongs to the day it started.
    const date = new Date(`${shiftDayKey(now)}T00:00:00Z`);

    // Only the first clock-in of the working day can be "late"; later
    // sessions (back from lunch, reconnects) are not.
    const { start, end } = shiftDayBounds(now);
    const earlierToday = await this.prisma.workSession.count({
      where: { userId: user.id, clockInAt: { gte: start, lt: end } },
    });
    const { shiftStart } = await this.getShift(user.id);
    const rules = await this.policy.forUser(user.id);
    // No lateness on a day they aren't expected to work: a weekend, a company
    // holiday, or approved leave.
    const working = await this.calendar.isWorkingDay(user.id, now);
    const lateByMin =
      working && earlierToday === 0 ? computeLateByMin(now, shiftStart, rules.lateGraceMin) : null;

    // An owner-approved late start for today covers a late clock-in within the
    // minutes they gave. The lateness stays on record (lateByMin), flagged and
    // excused; anything later than approved is judged as a normal late arrival.
    const approvedLateStart =
      lateByMin != null
        ? await this.prisma.lateStartRequest.findFirst({
            where: { userId: user.id, forDay: shiftDayKey(now), status: AttendanceAdjustmentStatus.APPROVED },
            orderBy: { createdAt: "desc" },
          })
        : null;
    const covered = approvedLateStart != null && lateByMin != null && lateByMin <= approvedLateStart.expectedLateMin + rules.lateGraceMin;

    const session = await this.prisma.workSession.create({
      data: {
        userId: user.id,
        clockInAt: now,
        date,
        lateByMin,
        ...(covered && approvedLateStart
          ? {
              approvedLateStartId: approvedLateStart.id,
              lateReason: `Owner-approved late start (${approvedLateStart.expectedLateMin} min)`,
              lateReasonAt: now,
              lateReviewStatus: ReasonReviewStatus.EXCUSED,
              lateReviewNote: "Approved in advance by the owner",
              lateReviewedById: approvedLateStart.decidedById,
              lateReviewedAt: approvedLateStart.decidedAt,
            }
          : {}),
      },
    });

    // Clocking in clears any "absent" mark the no-show job put on today.
    await this.prisma.absenceRecord.deleteMany({ where: { userId: user.id, date: shiftDayKey(now) } });

    if (lateByMin != null && !covered) await this.checkRepeatLate(user.id);
    return session;
  }

  /** Alerts the manager(s) and HR once someone has been late too often in a short time. Best-effort. */
  private async checkRepeatLate(userId: string) {
    try {
      const { repeatLateWindowDays, repeatLateThreshold } = await this.policy.getGlobal();
      const since = new Date(Date.now() - repeatLateWindowDays * 24 * 60 * 60 * 1000);
      const count = await this.prisma.workSession.count({
        where: {
          userId,
          lateByMin: { not: null },
          clockInAt: { gte: since },
          // A late arrival HR has excused no longer counts against the person.
          OR: [{ lateReviewStatus: null }, { lateReviewStatus: { not: ReasonReviewStatus.EXCUSED } }],
        },
      });
      if (count < repeatLateThreshold) return;

      const subject = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, firstName: true, lastName: true, departmentId: true, managerId: true },
      });
      if (!subject) return;
      const recipients = await this.oversight.recipientsFor(subject);
      await this.oversight.notify(recipients, {
        type: NotificationType.ATTENDANCE_REPEAT_LATE,
        title: "🔁 Repeated late arrivals",
        message: `${subject.firstName} ${subject.lastName} has been late ${count} times in the last ${repeatLateWindowDays} days.`,
        link: "/attendance",
      });
    } catch {
      // never fail a clock-in over an alert
    }
  }

  /**
   * Admin, HR, or the person's department manager decides whether a late or early
   * reason is accepted. EXCUSED stops it counting against the person (reports,
   * the repeat-late alert); REJECTED keeps it counting and needs a note; PENDING
   * clears an earlier decision. Nobody can review their own reasons.
   */
  async reviewReason(reviewer: RequestUser, sessionId: string, dto: ReviewReasonDto) {
    const session = await this.prisma.workSession.findUnique({
      where: { id: sessionId },
      include: { user: { select: { id: true, departmentId: true } } },
    });
    if (!session) throw new NotFoundException("Work session not found.");
    if (session.userId === reviewer.id) throw new ForbiddenException("You can't review your own reasons.");

    const isFullAccess = reviewer.role.name === RoleName.ADMIN || isHrUser(reviewer);
    const isDeptManager =
      reviewer.role.name === RoleName.MANAGER &&
      !!reviewer.department?.id &&
      reviewer.department.id === session.user.departmentId;
    if (!isFullAccess && !isDeptManager) throw new ForbiddenException("You can't review this person's reasons.");

    const late = dto.kind === "LATE";
    if (late ? session.lateByMin == null : session.earlyByMin == null) {
      throw new BadRequestException(late ? "This session wasn't a late arrival." : "This session wasn't an early leave.");
    }
    const note = dto.note?.trim() || null;
    if (dto.status === "REJECTED" && (!note || note.length < 3)) {
      throw new BadRequestException("Add a short note explaining why it isn't accepted.");
    }

    const status = dto.status === "PENDING" ? null : ReasonReviewStatus[dto.status];
    const cleared = status === null;
    const stamp = {
      status,
      note: cleared ? null : note,
      by: cleared ? null : reviewer.id,
      at: cleared ? null : new Date(),
    };
    const updated = await this.prisma.workSession.update({
      where: { id: sessionId },
      data: late
        ? { lateReviewStatus: stamp.status, lateReviewNote: stamp.note, lateReviewedById: stamp.by, lateReviewedAt: stamp.at }
        : { earlyReviewStatus: stamp.status, earlyReviewNote: stamp.note, earlyReviewedById: stamp.by, earlyReviewedAt: stamp.at },
    });

    if (status) {
      const day = new Date(`${shiftDayKey(session.clockInAt)}T12:00:00Z`).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      });
      await this.oversight.notify([session.userId], {
        type: NotificationType.ATTENDANCE_REVIEWED,
        title: status === ReasonReviewStatus.EXCUSED ? "✅ Reason accepted" : "❌ Reason not accepted",
        message: `Your ${late ? "late arrival" : "early clock-out"} on ${day} was ${
          status === ReasonReviewStatus.EXCUSED ? "excused" : "not accepted"
        }${note ? `: ${note}` : "."}`,
        link: "/attendance",
      });
    }
    return updated;
  }

  /** The oldest auto-closed session this user still has to correct (last 14 days), or null. */
  getPendingCorrection(userId: string) {
    return this.prisma.workSession.findFirst({
      where: {
        userId,
        autoClosed: true,
        correctionSubmittedAt: null,
        clockOutAt: { not: null },
        clockInAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { clockInAt: "asc" },
    });
  }

  /** The employee says when they really finished a session the system had to close for them. */
  async submitCorrection(user: RequestUser, sessionId: string, dto: CorrectClockOutDto) {
    const session = await this.prisma.workSession.findFirst({ where: { id: sessionId, userId: user.id } });
    if (!session) throw new NotFoundException("Work session not found.");
    if (!session.autoClosed) throw new BadRequestException("This session was not closed automatically.");
    if (session.correctionSubmittedAt) throw new BadRequestException("This session was already corrected.");

    const at = new Date(dto.clockOutAt);
    const { maxOpenSessionHours } = await this.policy.getGlobal();
    const latest = new Date(session.clockInAt.getTime() + maxOpenSessionHours * 60 * 60 * 1000);
    if (at.getTime() < session.clockInAt.getTime()) {
      throw new BadRequestException("You can't have finished before you clocked in.");
    }
    if (at.getTime() > Date.now()) throw new BadRequestException("That time is in the future.");
    if (at.getTime() > latest.getTime()) {
      throw new BadRequestException(`A session can't run longer than ${maxOpenSessionHours} hours.`);
    }

    return this.prisma.workSession.update({
      where: { id: sessionId },
      data: {
        clockOutAt: at,
        durationMin: Math.round((at.getTime() - session.clockInAt.getTime()) / 60_000),
        correctedClockOutAt: at,
        correctionNote: dto.note.trim(),
        correctionSubmittedAt: new Date(),
      },
    });
  }

  /** Record why the employee clocked in late. One answer per session. */
  async submitLateReason(user: RequestUser, sessionId: string, reason: string) {
    const session = await this.prisma.workSession.findFirst({
      where: { id: sessionId, userId: user.id },
    });
    if (!session) throw new NotFoundException("Work session not found.");
    if (session.lateByMin == null) {
      throw new BadRequestException("This session was not a late clock-in.");
    }
    if (session.lateReason) {
      throw new BadRequestException("A reason was already submitted.");
    }
    const updated = await this.prisma.workSession.update({
      where: { id: sessionId },
      data: { lateReason: reason.trim(), lateReasonAt: new Date() },
    });
    await this.notifyOversight(
      user,
      NotificationType.ATTENDANCE_LATE,
      "⏰ Late clock-in",
      `${user.firstName} ${user.lastName} clocked in ${session.lateByMin} min late. Reason: ${reason.trim()}`,
    );
    return updated;
  }

  /** Record the reason for an idle stretch (past the idle-prompt setting) during the active session. */
  async submitIdleReason(user: RequestUser, dto: IdleEventDto) {
    const active = await this.findActiveSession(user.id);
    if (!active) {
      throw new BadRequestException("You must be clocked in to report idle time.");
    }
    const { idlePromptMin } = await this.policy.forUser(user.id);
    if (dto.idleMinutes < idlePromptMin) {
      throw new BadRequestException(
        `Idle time under ${idlePromptMin} minutes does not need a reason.`,
      );
    }
    const idleStartedAt = new Date(dto.idleStartedAt);
    if (idleStartedAt.getTime() > Date.now()) {
      throw new BadRequestException("idleStartedAt cannot be in the future.");
    }
    // Idle time before clock-in is not work time.
    const startedAt =
      idleStartedAt < active.clockInAt ? active.clockInAt : idleStartedAt;

    const event = await this.prisma.idleEvent.create({
      data: {
        userId: user.id,
        workSessionId: active.id,
        idleStartedAt: startedAt,
        idleMinutes: dto.idleMinutes,
        reason: dto.reason.trim(),
      },
    });
    await this.notifyOversight(
      user,
      NotificationType.ATTENDANCE_IDLE,
      "💤 Idle during work time",
      `${user.firstName} ${user.lastName} was idle for ${dto.idleMinutes} min. Reason: ${dto.reason.trim()}`,
      "/screen-monitoring",
    );
    return event;
  }

  /**
   * End the user's active session.
   * Also closes any active break automatically.
   */
  async clockOut(user: RequestUser, earlyReason?: string) {
    const active = await this.findActiveSession(user.id);
    if (!active) {
      throw new BadRequestException("No active session to clock out from.");
    }

    const now = new Date();

    // Leaving before the end of their own shift needs a reason.
    const { shiftStart, shiftEnd } = await this.getShift(user.id);
    // ...but only on a day they were expected to work.
    const working = await this.calendar.isWorkingDay(user.id, now);
    const rules = await this.policy.forUser(user.id);
    const earlyByMin = working
      ? computeEarlyByMin(active.clockInAt, now, shiftStart, shiftEnd, rules.earlyGraceMin)
      : null;
    const reason = earlyReason?.trim();
    if (earlyByMin != null && (!reason || reason.length < 3)) {
      throw new BadRequestException({
        code: "EARLY_CLOCK_OUT_REASON_REQUIRED",
        message: `Your shift ends at ${shiftEnd}. Please give a reason for clocking out early.`,
        earlyByMin,
      });
    }

    // Auto-close any active break if user clocks out while on break
    try {
      const activeBreak = await this.prisma.workBreak.findFirst({
        where: { workSessionId: active.id, endedAt: null },
      });
      if (activeBreak) {
        const breakDurationMin = Math.max(
          1,
          Math.round((now.getTime() - activeBreak.startedAt.getTime()) / 60000),
        );
        await this.prisma.workBreak.update({
          where: { id: activeBreak.id },
          data: { endedAt: now, durationMin: breakDurationMin, autoEnded: false },
        });
        await this.prisma.workSession.update({
          where: { id: active.id },
          data: { lastBreakEndedAt: now },
        });
      }
    } catch (err) {
      // Safe fallback if table is not yet created
    }

    const durationMin = Math.round(
      (now.getTime() - active.clockInAt.getTime()) / 60000,
    );

    const closed = await this.prisma.workSession.update({
      where: { id: active.id },
      data:
        earlyByMin != null
          ? { clockOutAt: now, durationMin, earlyByMin, earlyReason: reason }
          : { clockOutAt: now, durationMin },
    });
    if (earlyByMin != null) {
      await this.notifyOversight(
        user,
        NotificationType.ATTENDANCE_EARLY,
        "🚪 Early clock-out",
        `${user.firstName} ${user.lastName} clocked out ${earlyByMin} min before shift end (${shiftEnd}). Reason: ${reason}`,
      );
    }
    return closed;
  }

  /**
   * Start a 1-hour break.
   * Validates active session, non-active break, and 5-hour cooldown.
   */
  async startBreak(user: RequestUser) {
    const active = await this.findActiveSession(user.id);
    if (!active) {
      throw new BadRequestException("You must be clocked in to start a break.");
    }

    // Check if break already open
    const currentBreak = await this.prisma.workBreak.findFirst({
      where: { workSessionId: active.id, endedAt: null },
    });

    const now = new Date();

    if (currentBreak) {
      // Check if expired past 1 hour
      if (now.getTime() - currentBreak.startedAt.getTime() >= BREAK_MAX_MS) {
        const endedAt = new Date(currentBreak.startedAt.getTime() + BREAK_MAX_MS);
        await this.prisma.workBreak.update({
          where: { id: currentBreak.id },
          data: { endedAt, durationMin: 60, autoEnded: true },
        });
        await this.prisma.workSession.update({
          where: { id: active.id },
          data: { lastBreakEndedAt: endedAt },
        });
      } else {
        throw new BadRequestException("You are already on an active break.");
      }
    }

    // Check 5-hour cooldown across all recent breaks for this user
    const lastBreak = await this.prisma.workBreak.findFirst({
      where: { workSession: { userId: user.id }, endedAt: { not: null } },
      orderBy: { endedAt: "desc" },
    });

    if (lastBreak?.endedAt) {
      const elapsedSinceBreak = now.getTime() - lastBreak.endedAt.getTime();
      if (elapsedSinceBreak < BREAK_COOLDOWN_MS) {
        const remainingMs = BREAK_COOLDOWN_MS - elapsedSinceBreak;
        const hours = Math.floor(remainingMs / (3600 * 1000));
        const mins = Math.ceil((remainingMs % (3600 * 1000)) / (60 * 1000));
        throw new BadRequestException(
          `Break is on cooldown. You can take another break in ${hours > 0 ? `${hours}h ` : ""}${mins}m.`,
        );
      }
    }

    return this.prisma.workBreak.create({
      data: {
        workSessionId: active.id,
        startedAt: now,
      },
    });
  }

  /**
   * End the current break manually.
   * Starts the 5-hour cooldown timer.
   */
  async endBreak(user: RequestUser) {
    const active = await this.findActiveSession(user.id);
    if (!active) {
      throw new BadRequestException("No active work session found.");
    }

    const currentBreak = await this.prisma.workBreak.findFirst({
      where: { workSessionId: active.id, endedAt: null },
    });
    if (!currentBreak) {
      throw new BadRequestException("No active break to end.");
    }

    const now = new Date();
    const durationMin = Math.max(
      1,
      Math.round((now.getTime() - currentBreak.startedAt.getTime()) / 60000),
    );

    const updated = await this.prisma.workBreak.update({
      where: { id: currentBreak.id },
      data: {
        endedAt: now,
        durationMin,
        autoEnded: false,
      },
    });

    await this.prisma.workSession.update({
      where: { id: active.id },
      data: { lastBreakEndedAt: now },
    });

    return updated;
  }

  /** Get the currently active session for the user with full break & cooldown status. */
  async getActive(userId: string) {
    const session = await this.findActiveSession(userId);
    if (!session) return null;

    const now = Date.now();

    let activeBreak = null;
    let cooldownRemainingSeconds = 0;

    try {
      // Check if there is an open break
      activeBreak = await this.prisma.workBreak.findFirst({
        where: { workSessionId: session.id, endedAt: null },
        orderBy: { startedAt: "desc" },
      });

      // Auto-expire 1-hour break if time has elapsed
      if (activeBreak) {
        const elapsedBreakMs = now - activeBreak.startedAt.getTime();
        if (elapsedBreakMs >= BREAK_MAX_MS) {
          const endedAt = new Date(activeBreak.startedAt.getTime() + BREAK_MAX_MS);
          activeBreak = await this.prisma.workBreak.update({
            where: { id: activeBreak.id },
            data: { endedAt, durationMin: 60, autoEnded: true },
          });
          await this.prisma.workSession.update({
            where: { id: session.id },
            data: { lastBreakEndedAt: endedAt },
          });
          activeBreak = null;
        }
      }

      // Check latest completed break for 5-hour cooldown calculation
      const lastCompletedBreak = await this.prisma.workBreak.findFirst({
        where: { workSession: { userId }, endedAt: { not: null } },
        orderBy: { endedAt: "desc" },
      });

      if (lastCompletedBreak?.endedAt) {
        const elapsedSinceBreakMs = now - lastCompletedBreak.endedAt.getTime();
        if (elapsedSinceBreakMs < BREAK_COOLDOWN_MS) {
          cooldownRemainingSeconds = Math.round((BREAK_COOLDOWN_MS - elapsedSinceBreakMs) / 1000);
        }
      }
    } catch (err) {
      // Safe fallback if table is not yet created
    }

    const shift = await this.getShift(userId);
    const workingToday = await this.calendar.isWorkingDay(userId, new Date(now));
    const rules = await this.policy.forUser(userId);

    // If the desktop agent is running it reports the OS-level idle time, which is a
    // truer "is this person at the keyboard" signal than activity in the CRM tab
    // (someone working in another app, or on a call, is active but never touches the tab).
    let agentIdleSeconds: number | null = null;
    let agentSeenAt: Date | null = null;
    try {
      const ping = await this.prisma.activityPing.findFirst({
        where: { userId, capturedAt: { gte: new Date(now - 3 * 60 * 1000) } },
        orderBy: { capturedAt: "desc" },
        select: { idleSeconds: true, capturedAt: true },
      });
      if (ping) {
        agentIdleSeconds = ping.idleSeconds;
        agentSeenAt = ping.capturedAt;
      }
    } catch {
      // no agent signal -- the browser's own activity tracking is used instead
    }
    const isOnBreak = !!activeBreak;
    const breakRemainingSeconds = activeBreak
      ? Math.max(0, Math.round((BREAK_MAX_MS - (now - activeBreak.startedAt.getTime())) / 1000))
      : 0;

    return {
      ...session,
      isOnBreak,
      breakStartedAt: activeBreak?.startedAt ?? null,
      breakRemainingSeconds,
      cooldownRemainingSeconds,
      idlePromptMinutes: rules.idlePromptMin,
      agentIdleSeconds,
      agentSeenAt,
      minWorkMinutes: rules.minWorkMinutes,
      shiftStart: shift.shiftStart,
      shiftEnd: shift.shiftEnd,
      clockOutIsEarly:
        workingToday &&
        computeEarlyByMin(session.clockInAt, new Date(now), shift.shiftStart, shift.shiftEnd, rules.earlyGraceMin) != null,
    };
  }

  /**
   * List sessions for a user.
   * Admins and HR can query any userId; managers can query their dept users; employees only see their own.
   */
  async list(userId: string, requestingUser: RequestUser, range?: DateRange) {
    const isFullAccess = requestingUser.role.name === RoleName.ADMIN || isHrUser(requestingUser);
    let targetId = requestingUser.id;

    if (isFullAccess) {
      targetId = userId;
    } else if (requestingUser.role.name === RoleName.MANAGER && requestingUser.department?.id) {
      const targetUser = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true },
      });
      if (targetUser?.departmentId === requestingUser.department?.id) {
        targetId = userId;
      }
    }

    return this.prisma.workSession.findMany({
      where: { userId: targetId, ...clockInFilter(range) },
      orderBy: { clockInAt: "desc" },
      take: range ? 1000 : 100,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            shiftStart: true,
            shiftEnd: true,
          },
        },
        breaks: { orderBy: { startedAt: "desc" } },
        idleEvents: { orderBy: { idleStartedAt: "desc" } },
      },
    });
  }

  /** List all sessions across users (Admin/HR see company-wide; Managers see their department; employees only own). */
  listAll(requestingUser: RequestUser, range?: DateRange) {
    const isFullAccess = requestingUser.role.name === RoleName.ADMIN || isHrUser(requestingUser);
    const isDeptManager = requestingUser.role.name === RoleName.MANAGER && !!requestingUser.department?.id;

    if (!isFullAccess && !isDeptManager) {
      return this.list(requestingUser.id, requestingUser, range);
    }

    const where = {
      ...(isFullAccess ? {} : { user: { departmentId: requestingUser.department?.id } }),
      ...clockInFilter(range),
    };

    return this.prisma.workSession.findMany({
      where,
      orderBy: { clockInAt: "desc" },
      take: range ? 1000 : 200,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            shiftStart: true,
            shiftEnd: true,
          },
        },
        breaks: { orderBy: { startedAt: "desc" } },
        idleEvents: { orderBy: { idleStartedAt: "desc" } },
      },
    });
  }

  private findActiveSession(userId: string) {
    return this.prisma.workSession.findFirst({
      where: { userId, clockOutAt: null },
      orderBy: { clockInAt: "desc" },
    });
  }
}
