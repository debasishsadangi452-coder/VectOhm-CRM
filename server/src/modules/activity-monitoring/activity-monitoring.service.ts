import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { NotificationType, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkSessionsService } from "../work-sessions/work-sessions.service";
import { AttendancePolicyService } from "../work-sessions/attendance-policy.service";
import { NotificationsService } from "../notifications/notifications.service";
import { canViewMonitoringData, isHrDepartment } from "../../common/utils/monitoring-access";
import type { RequestUser } from "../../common/types/request-user.type";

// Same 30-day window + opportunistic-sweep-on-write pattern as ScreenCapture.
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

// Below the single idle limit (IDLE_LIMIT_SEC in work-policy.ts) of
// OS-reported idle time, a ping counts as "active" -- a short away-from-keyboard
// moment (reading something on screen) shouldn't register as idle. idleSeconds
// itself comes from Electron's powerMonitor.getSystemIdleTime() on the desktop
// agent -- an OS-level "seconds since last input" signal, never individual
// key/click events.

// A second "agent stopped" report (quit or sign-out) for the same person
// inside this window is dropped, so a double-click or a retry can't spam HR
// and Admin.
const AGENT_QUIT_DEDUPE_MS = 2 * 60 * 1000;

const summaryUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  department: { select: { id: true, name: true } },
} as const;

type SummaryUser = { id: string } & Record<string, unknown>;

@Injectable()
export class ActivityMonitoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workSessions: WorkSessionsService,
    private readonly notifications: NotificationsService,
    private readonly policy: AttendancePolicyService,
  ) {}

  // The employee chose to Quit the desktop agent -- which stops screen
  // recording (always on while signed in) and activity reporting until they
  // relaunch it. The agent warned them (in its confirmation dialog) that HR and
  // Admin will be told; this is that notification, sent whether or not they
  // are clocked in.
  async reportAgentQuit(user: RequestUser): Promise<{ notified: boolean }> {
    const active = await this.workSessions.getActive(user.id);
    return this.notifyAgentStopped(user, {
      title: "🛑 Desktop agent quit",
      action: `quit the Venus CRM desktop agent${active ? " while clocked in" : ""}${active?.isOnBreak ? " (on break)" : ""}`,
      consequence: "Screen recording is stopped until they relaunch it.",
    });
  }

  // The employee chose Sign out from the tray menu -- same effect on
  // monitoring as quitting (screen recording and activity reporting both stop,
  // since recording only runs while signed in), so it gets the same
  // before-the-fact warning in the agent's confirmation dialog and the same
  // after-the-fact notification here. A forced/automatic sign-out (the server
  // rejected a stale token, declining the monitoring notice, an account
  // switch) never calls this -- only a deliberate, confirmed Sign out click
  // does, mirroring reportAgentQuit above.
  async reportAgentSignOut(user: RequestUser): Promise<{ notified: boolean }> {
    return this.notifyAgentStopped(user, {
      title: "🔓 Desktop agent signed out",
      action: "signed out of the Venus CRM desktop agent",
      consequence: "Screen recording is stopped until they sign in again.",
    });
  }

  private async notifyAgentStopped(
    user: RequestUser,
    { title, action, consequence }: { title: string; action: string; consequence: string },
  ): Promise<{ notified: boolean }> {
    const link = `/screen-monitoring?userId=${user.id}`;
    const recent = await this.prisma.notification.findFirst({
      where: {
        type: NotificationType.AGENT_QUIT,
        link,
        createdAt: { gte: new Date(Date.now() - AGENT_QUIT_DEDUPE_MS) },
      },
      select: { id: true },
    });
    if (recent) return { notified: false };

    // Admins, plus HR. HR is matched by department name in code (isHrDepartment)
    // after a broad query, so a department that merely contains "hr" in a longer
    // word isn't swept in.
    const candidates = await this.prisma.user.findMany({
      where: {
        isActive: true,
        id: { not: user.id },
        OR: [
          { role: { name: RoleName.ADMIN } },
          { department: { name: { contains: "hr", mode: "insensitive" } } },
          { department: { name: { contains: "human resource", mode: "insensitive" } } },
        ],
      },
      select: { id: true, role: { select: { name: true } }, department: { select: { name: true } } },
    });
    const recipients = candidates.filter(
      (c) => c.role.name === RoleName.ADMIN || isHrDepartment(c.department?.name),
    );

    const who = `${user.firstName} ${user.lastName}`;
    let delivered = 0;
    for (const r of recipients) {
      try {
        await this.notifications.create({
          userId: r.id,
          type: NotificationType.AGENT_QUIT,
          title,
          message: `${who} ${action}. ${consequence}`,
          link,
        });
        delivered++;
      } catch {
        // One failed delivery must not stop the rest.
      }
    }
    return { notified: delivered > 0 };
  }

  // Called by the desktop agent, authenticated as the employee being
  // measured -- same "must be clocked in" gate as screen captures.
  // keystrokeCount/clickCount are plain counts since the previous ping
  // (never key content or click coordinates) -- optional, defaulting to 0,
  // so an un-upgraded desktop agent build keeps working.
  async create(user: RequestUser, idleSeconds: number, keystrokeCount = 0, clickCount = 0) {
    const activeSession = await this.workSessions.getActive(user.id);
    if (!activeSession) {
      throw new ConflictException("You must be clocked in to send an activity ping");
    }

    // Admins are not idle-tracked: their pings always count as active.
    const active = user.role.name === RoleName.ADMIN || idleSeconds < (await this.policy.getActiveGapSec());
    const ping = await this.prisma.activityPing.create({
      data: {
        userId: user.id,
        workSessionId: activeSession.id,
        idleSeconds,
        active,
        keystrokeCount,
        clickCount,
      },
    });

    if (Math.random() < 0.05) {
      await this.sweepExpired();
    }

    return { id: ping.id, active, capturedAt: ping.capturedAt };
  }

  async summary(viewer: RequestUser, filters: { userId?: string; from?: string; to?: string }) {
    const capturedAt = this.dateFilter(filters);

    if (filters.userId) {
      const target = await this.getTargetOrThrow(filters.userId);
      if (!canViewMonitoringData(viewer, target)) {
        throw new ForbiddenException("You do not have permission to view this user's activity");
      }
      return this.aggregateFor([filters.userId], capturedAt);
    }

    // No specific user requested -- same broad-visibility rule as
    // ScreenMonitoringService.list: Admin/HR see the company, a Manager
    // sees their own department, anyone else gets nothing.
    const isAdmin = viewer.role.name === RoleName.ADMIN;
    const isHR = isHrDepartment(viewer.department?.name);
    const isManager = viewer.role.name === RoleName.MANAGER;
    if (!isAdmin && !isHR && !isManager) {
      throw new ForbiddenException("You do not have permission to view activity data");
    }

    const scope = {
      isActive: true,
      ...(isAdmin || isHR ? {} : { departmentId: viewer.department?.id }),
    };
    const users = await this.prisma.user.findMany({ where: scope, select: summaryUserSelect });
    // includeEmpty: monitoring is always on while the agent is signed in, whether
    // or not the person pressed "online" (pings need a clock-in, recordings do
    // not) -- so list everyone in scope, with zeros, instead of hiding them.
    return this.aggregateFor(
      users.map((u) => u.id),
      capturedAt,
      users,
      true,
    );
  }

  private async aggregateFor(
    userIds: string[],
    capturedAt: { gte?: Date; lte?: Date } | undefined,
    knownUsers?: SummaryUser[],
    includeEmpty = false,
  ) {
    if (userIds.length === 0) return [];

    const [grouped, recordings] = await Promise.all([
      this.prisma.activityPing.groupBy({
        by: ["userId", "active"],
        where: { userId: { in: userIds }, ...(capturedAt ? { capturedAt } : {}) },
        _count: true,
        _sum: { keystrokeCount: true, clickCount: true },
      }),
      // Same window, by the clip's start -- so the Screen Monitoring page can
      // show recorded time per person without downloading every clip row.
      this.prisma.screenRecording.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds }, ...(capturedAt ? { startedAt: capturedAt } : {}) },
        _count: true,
        _sum: { durationSec: true },
      }),
    ]);

    const users =
      knownUsers ?? (await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: summaryUserSelect }));
    const usersById = new Map(users.map((u) => [u.id, u]));
    const recordingsByUser = new Map(recordings.map((r) => [r.userId, r]));

    const countsByUser = new Map<string, { active: number; total: number; keystrokes: number; clicks: number }>();
    for (const row of grouped) {
      const existing = countsByUser.get(row.userId) ?? { active: 0, total: 0, keystrokes: 0, clicks: 0 };
      existing.total += row._count;
      if (row.active) existing.active += row._count;
      existing.keystrokes += row._sum.keystrokeCount ?? 0;
      existing.clicks += row._sum.clickCount ?? 0;
      countsByUser.set(row.userId, existing);
    }

    return userIds
      .map((id) => {
        const counts = countsByUser.get(id);
        const user = usersById.get(id);
        const rec = recordingsByUser.get(id);
        if (!user || (!counts && !rec && !includeEmpty)) return null;
        const c = counts ?? { active: 0, total: 0, keystrokes: 0, clicks: 0 };
        return {
          user,
          totalPings: c.total,
          activePings: c.active,
          activePercent: c.total ? Math.round((c.active / c.total) * 100) : 0,
          // Pings fire about once a minute, so ping counts approximate minutes
          // (same approximation dailyBreakdown uses).
          activeMinutes: c.active,
          idleMinutes: c.total - c.active,
          // Plain counts only -- never which key or where a click landed.
          keystrokeCount: c.keystrokes,
          clickCount: c.clicks,
          recordingCount: rec?._count ?? 0,
          recordedSeconds: rec?._sum.durationSec ?? 0,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => b.activePercent - a.activePercent);
  }

  // Per-day active/idle minutes for one employee over a date range -- the
  // detail view behind summary()'s single aggregate percentage. Same
  // "ping count as a proxy for elapsed minutes" approximation summary()
  // already relies on (pings fire ~once/minute from the desktop agent, see
  // ACTIVITY_PING_MS) -- not wall-clock-exact, but no less precise than the
  // percentage already shipped.
  async dailyBreakdown(viewer: RequestUser, userId: string, from: string, to: string) {
    const target = await this.getTargetOrThrow(userId);
    if (!canViewMonitoringData(viewer, target)) {
      throw new ForbiddenException("You do not have permission to view this user's activity");
    }

    const range = { gte: new Date(from), lte: new Date(to) };

    const [pings, sessions] = await Promise.all([
      this.prisma.activityPing.findMany({
        where: { userId, capturedAt: range },
        select: { capturedAt: true, active: true, keystrokeCount: true, clickCount: true },
      }),
      this.prisma.workSession.findMany({
        where: { userId, date: range },
        select: { date: true, durationMin: true },
      }),
    ]);

    const pingCounts = new Map<
      string,
      { active: number; idle: number; keystrokeCount: number; clickCount: number }
    >();
    for (const ping of pings) {
      const key = ping.capturedAt.toISOString().slice(0, 10);
      const existing = pingCounts.get(key) ?? { active: 0, idle: 0, keystrokeCount: 0, clickCount: 0 };
      if (ping.active) existing.active += 1;
      else existing.idle += 1;
      existing.keystrokeCount += ping.keystrokeCount;
      existing.clickCount += ping.clickCount;
      pingCounts.set(key, existing);
    }

    const clockedInByDay = new Map<string, number>();
    for (const session of sessions) {
      const key = session.date.toISOString().slice(0, 10);
      clockedInByDay.set(key, (clockedInByDay.get(key) ?? 0) + (session.durationMin ?? 0));
    }

    // One row per calendar day in the range, including zero-activity days --
    // a chart/table with gaps for "nothing happened" days is more confusing
    // than a row of zeros.
    const rows: Array<{
      date: string;
      clockedInMinutes: number;
      activeMinutes: number;
      idleMinutes: number;
      activePercent: number;
      keystrokeCount: number;
      clickCount: number;
    }> = [];
    const cursor = new Date(Date.UTC(range.gte.getUTCFullYear(), range.gte.getUTCMonth(), range.gte.getUTCDate()));
    const end = new Date(Date.UTC(range.lte.getUTCFullYear(), range.lte.getUTCMonth(), range.lte.getUTCDate()));
    while (cursor <= end) {
      const key = cursor.toISOString().slice(0, 10);
      const counts = pingCounts.get(key) ?? { active: 0, idle: 0, keystrokeCount: 0, clickCount: 0 };
      const total = counts.active + counts.idle;
      rows.push({
        date: key,
        clockedInMinutes: clockedInByDay.get(key) ?? 0,
        activeMinutes: counts.active,
        idleMinutes: counts.idle,
        activePercent: total > 0 ? Math.round((counts.active / total) * 100) : 0,
        keystrokeCount: counts.keystrokeCount,
        clickCount: counts.clickCount,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return rows;
  }

  // Raw per-ping counts for one employee, so the screen-recordings grid can
  // bucket them by the viewer's local hour and line them up with clips.
  async timeline(viewer: RequestUser, userId: string, from: string, to: string) {
    const target = await this.getTargetOrThrow(userId);
    if (!canViewMonitoringData(viewer, target)) {
      throw new ForbiddenException("You do not have permission to view this user's activity");
    }
    return this.prisma.activityPing.findMany({
      where: { userId, capturedAt: { gte: new Date(from), lte: new Date(to) } },
      orderBy: { capturedAt: "asc" },
      // ~1 ping a minute, so a day is ~1,440 at most; cap guards a wide range.
      take: 3000,
      select: { capturedAt: true, active: true, keystrokeCount: true, clickCount: true },
    });
  }

  private dateFilter(filters: { from?: string; to?: string }) {
    if (!filters.from && !filters.to) return undefined;
    return {
      ...(filters.from ? { gte: new Date(filters.from) } : {}),
      ...(filters.to ? { lte: new Date(filters.to) } : {}),
    };
  }

  private async getTargetOrThrow(userId: string) {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { department: { select: { id: true } } },
    });
    if (!target) {
      throw new NotFoundException("User not found");
    }
    return target;
  }

  private async sweepExpired() {
    await this.prisma.activityPing.deleteMany({
      where: { capturedAt: { lt: new Date(Date.now() - RETENTION_MS) } },
    });
  }
}
