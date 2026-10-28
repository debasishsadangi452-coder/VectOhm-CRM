import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { inWorkDay, workDayKeyOf, workDayWindow } from "@/lib/work-day";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Coffee,
  Keyboard,
  Loader2,
  LogIn,
  Monitor,
  MousePointerClick,
  Play,
  Timer,
  Video,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RecordingViewerDialog } from "@/components/recording-viewer-dialog";
import { useUsers } from "@/hooks/use-users";
import { useAuthStore } from "@/stores/auth-store";
import { useLoginEvents } from "@/hooks/use-login-events";
import { useWorkSessions } from "@/hooks/use-work-session";
import { useActivityDaily } from "@/hooks/use-activity-monitoring";
import type { ActivityDailyRow } from "@/lib/api/activity-monitoring";
import { useScreenRecordings } from "@/hooks/use-screen-recordings";
import type { ScreenRecording } from "@/lib/api/screen-recordings";
import type { LoginEvent } from "@/lib/api/types";

export const Route = createFileRoute("/_app/employee-daily-log")({
  component: EmployeeDailyLogPage,
});

function formatMinutes(min: number): string {
  min = Math.max(0, Math.round(min));
  return min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`;
}

const t = (d: Date) => format(d, "h:mm a");

function EmployeeDailyLogPage() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);

  // Same visibility rule and "component-level effect" guard pattern as
  // screen-monitoring.tsx (Admin, HR, or any department Manager).
  useEffect(() => {
    if (!currentUser) return;
    const isAdmin = currentUser.role.name === "ADMIN";
    const isHR = currentUser.department?.name === "HR";
    const isManager = currentUser.role.name === "MANAGER";
    if (!isAdmin && !isHR && !isManager) {
      navigate({ to: "/" });
    }
  }, [currentUser, navigate]);

  const isAdmin = currentUser?.role.name === "ADMIN";
  const isHR = currentUser?.department?.name === "HR";
  const isAdminOrHR = isAdmin || isHR;

  const { data: users } = useUsers();
  const selectableUsers = useMemo(
    () =>
      isAdminOrHR
        ? (users ?? [])
        : (users ?? []).filter((u) => u.department?.id === currentUser?.department?.id),
    [users, isAdminOrHR, currentUser],
  );

  const [userId, setUserId] = useState<string>("");
  useEffect(() => {
    if (!userId && selectableUsers.length > 0) setUserId(selectableUsers[0].id);
  }, [userId, selectableUsers]);

  // A day here is a work day (08:00 to 08:00), so a night shift is not split at midnight.
  const todayKey = workDayKeyOf(new Date());
  const [date, setDate] = useState<string>(todayKey);
  const isToday = date === todayKey;

  const dayStart = useMemo(() => workDayWindow(date).start, [date]);
  const dayEnd = useMemo(() => workDayWindow(date).end, [date]);
  const dayStartIso = dayStart.toISOString();
  const dayEndIso = dayEnd.toISOString();
  const shiftDay = (n: number) => setDate(format(addDays(dayStart, n), "yyyy-MM-dd"));

  // Login/logout is a stricter audience than the rest of this page --
  // Admin + HR only, mirroring the backend's canManageDirectory gate on
  // GET /login-events (see login-events.controller.ts). A department
  // Manager sees every other section here but not this one.
  const { data: loginEvents, isLoading: loginEventsLoading } = useLoginEvents(
    { userId, limit: 500 },
    { enabled: isAdminOrHR && !!userId },
  );
  const signIns = useMemo(
    () => buildSessions((loginEvents ?? []).filter((e) => inWorkDay(e.createdAt, date))),
    [loginEvents, date],
  );

  const { data: workSessions, isLoading: workSessionsLoading } = useWorkSessions(
    userId || undefined,
  );
  const daySessions = (workSessions ?? [])
    .filter((s) => inWorkDay(s.clockInAt, date))
    .sort((a, b) => Date.parse(a.clockInAt) - Date.parse(b.clockInAt));
  const dayBreaks = daySessions.flatMap((s) => s.breaks ?? []);
  const dayIdleEvents = daySessions
    .flatMap((s) => s.idleEvents ?? [])
    .sort((a, b) => Date.parse(a.idleStartedAt) - Date.parse(b.idleStartedAt));

  const now = Date.now();
  // An open session counts up to now (today) -- otherwise it has no end to measure.
  const sessionEnd = (s: (typeof daySessions)[number]) =>
    s.clockOutAt ? Date.parse(s.clockOutAt) : isToday ? now : null;
  const clockedMin = daySessions.reduce((sum, s) => {
    const end = sessionEnd(s);
    return sum + (end ? (end - Date.parse(s.clockInAt)) / 60_000 : 0);
  }, 0);
  const breakMin = dayBreaks.reduce(
    (sum, b) =>
      sum +
      (b.durationMin ?? (b.endedAt ? 0 : isToday ? (now - Date.parse(b.startedAt)) / 60_000 : 0)),
    0,
  );
  const idleMin = dayIdleEvents.reduce((sum, e) => sum + e.idleMinutes, 0);

  const { data: activityRows, isLoading: activityLoading } = useActivityDaily(
    userId || "",
    dayStartIso,
    dayEndIso,
  );
  // The work day spans two calendar dates, so the daily rows inside it are added together.
  const activityRow = useMemo(() => {
    if (!activityRows || activityRows.length === 0) return undefined;
    const sum = (f: (r: ActivityDailyRow) => number) => activityRows.reduce((a, r) => a + f(r), 0);
    const clocked = sum((r) => r.clockedInMinutes);
    const active = sum((r) => r.activeMinutes);
    return {
      date,
      clockedInMinutes: clocked,
      activeMinutes: active,
      idleMinutes: sum((r) => r.idleMinutes),
      activePercent: clocked > 0 ? Math.round((active / clocked) * 100) : 0,
      keystrokeCount: sum((r) => r.keystrokeCount),
      clickCount: sum((r) => r.clickCount),
    };
  }, [activityRows, date]);

  const { data: recordings, isLoading: recordingsLoading } = useScreenRecordings(
    userId ? { userId, from: dayStartIso, to: dayEndIso } : {},
  );
  const dayRecordings = [...(recordings ?? [])].sort(
    (a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt),
  );
  const recordedMin = dayRecordings.reduce((sum, r) => sum + r.durationSec / 60, 0);
  const [viewing, setViewing] = useState<ScreenRecording | undefined>(undefined);

  const selectedUser = selectableUsers.find((u) => u.id === userId);
  const firstSignIn = signIns.find((s) => s.start)?.start ?? null;
  const firstClockIn = daySessions[0] ? new Date(daySessions[0].clockInAt) : null;
  const lastSession = daySessions[daySessions.length - 1];
  const stillClockedIn = isToday && !!lastSession && !lastSession.clockOutAt;

  return (
    <div className="p-4 sm:p-6 max-w-[1200px] mx-auto space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center text-primary shrink-0">
            <ClipboardList className="size-5" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Employee Daily Log</h1>
            <p className="text-sm text-text-dim">
              Sign-ins, clock in/out, breaks, activity and recordings for one person, one day.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className="w-56 h-9" aria-label="Employee">
              <SelectValue placeholder="Select employee" />
            </SelectTrigger>
            <SelectContent>
              {selectableUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.firstName} {u.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center rounded-md border border-border-subtle bg-panel">
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-r-none"
              aria-label="Previous day"
              onClick={() => shiftDay(-1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Input
              type="date"
              aria-label="Date"
              className="h-9 w-40 border-0 rounded-none shadow-none focus-visible:ring-0"
              value={date}
              max={todayKey}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-l-none"
              aria-label="Next day"
              disabled={isToday}
              onClick={() => shiftDay(1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          {!isToday && (
            <Button variant="outline" size="sm" className="h-9" onClick={() => setDate(todayKey)}>
              Today
            </Button>
          )}
        </div>
      </div>

      {!userId && (
        <p className="text-sm text-text-dim py-16 text-center">
          {selectableUsers.length === 0 ? "No employees available." : "Select an employee."}
        </p>
      )}

      {userId && selectedUser && (
        <>
          <div className="bg-panel border border-border-subtle rounded-xl p-4 sm:p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar className="size-10">
                  <AvatarFallback className="text-sm">{getInitials(selectedUser)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold leading-tight">
                    {selectedUser.firstName} {selectedUser.lastName}
                  </div>
                  <div className="text-xs text-text-dim">
                    {selectedUser.department?.name ?? "No department"} ·{" "}
                    {format(dayStart, "EEEE, MMM d, yyyy")}
                  </div>
                </div>
              </div>
              {workSessionsLoading ? null : stillClockedIn ? (
                <StatusPill tone="success" label="Clocked in now" />
              ) : daySessions.length === 0 ? (
                <StatusPill tone="muted" label="No clock-in this day" />
              ) : (
                <StatusPill tone="muted" label="Clocked out" />
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <Kpi
                icon={LogIn}
                label={isAdminOrHR ? "First sign-in" : "First clock-in"}
                value={
                  isAdminOrHR
                    ? firstSignIn
                      ? t(firstSignIn)
                      : "—"
                    : firstClockIn
                      ? t(firstClockIn)
                      : "—"
                }
              />
              <Kpi icon={Clock} label="Clocked in" value={formatMinutes(clockedMin)} />
              <Kpi icon={Coffee} label="Breaks" value={formatMinutes(breakMin)} />
              <Kpi
                icon={Activity}
                label="Active"
                value={activityRow ? `${activityRow.activePercent}%` : "—"}
              />
              <Kpi icon={Timer} label="Idle" value={formatMinutes(idleMin)} />
              <Kpi icon={Video} label="Recorded" value={formatMinutes(recordedMin)} />
            </div>

            <DayTimeline
              dayStart={dayStart}
              dayEnd={dayEnd}
              now={isToday ? now : dayEnd.getTime()}
              work={daySessions.map((s) => ({
                start: Date.parse(s.clockInAt),
                end: sessionEnd(s),
              }))}
              breaks={dayBreaks.map((b) => ({
                start: Date.parse(b.startedAt),
                end: b.endedAt ? Date.parse(b.endedAt) : isToday ? now : null,
              }))}
              idle={dayIdleEvents.map((e) => ({
                start: Date.parse(e.idleStartedAt),
                end: Date.parse(e.idleStartedAt) + e.idleMinutes * 60_000,
              }))}
              signIns={
                isAdminOrHR
                  ? signIns.map((s) => ({
                      start: s.start?.getTime() ?? dayStart.getTime(),
                      end: s.end?.getTime() ?? null,
                    }))
                  : []
              }
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2 items-start">
            <Section icon={Clock} title="Clock in / out & breaks">
              {workSessionsLoading && <LoadingRow />}
              {!workSessionsLoading && daySessions.length === 0 && (
                <EmptyRow text="No clock-in on this date." />
              )}
              {!workSessionsLoading && daySessions.length > 0 && (
                <ol className="p-4 space-y-4">
                  {daySessions.map((s) => {
                    const start = new Date(s.clockInAt);
                    const end = s.clockOutAt ? new Date(s.clockOutAt) : null;
                    const endMs = sessionEnd(s);
                    return (
                      <li key={s.id} className="relative pl-6">
                        <span className="absolute left-0 top-1.5 size-2.5 rounded-full bg-success ring-4 ring-success/15" />
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <span className="font-medium tabular-nums">
                            {t(start)} →{" "}
                            {end ? (
                              <>
                                {t(end)}
                                {end.getTime() > dayEnd.getTime() && (
                                  <span className="text-xs text-text-dim"> (next day)</span>
                                )}
                              </>
                            ) : isToday ? (
                              <span className="text-success">now</span>
                            ) : (
                              <span className="text-text-dim">no clock-out</span>
                            )}
                          </span>
                          {endMs && (
                            <span className="text-xs text-text-dim tabular-nums">
                              {formatMinutes((endMs - start.getTime()) / 60_000)}
                            </span>
                          )}
                          {!!s.lateByMin && <Tag tone="warn">Late {s.lateByMin}m</Tag>}
                          {!!s.earlyByMin && <Tag tone="warn">Left {s.earlyByMin}m early</Tag>}
                          {s.autoClosed && <Tag tone="muted">Auto clock-out</Tag>}
                        </div>
                        {s.lateReason && (
                          <p className="mt-1 text-xs text-text-dim">Late reason: {s.lateReason}</p>
                        )}
                        {s.earlyReason && (
                          <p className="mt-1 text-xs text-text-dim">
                            Early reason: {s.earlyReason}
                          </p>
                        )}
                        {(s.breaks ?? []).length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {s.breaks!.map((b) => (
                              <li
                                key={b.id}
                                className="flex items-center gap-2 text-xs text-text-dim tabular-nums"
                              >
                                <Coffee className="size-3.5 text-amber-500" />
                                Break {t(new Date(b.startedAt))} –{" "}
                                {b.endedAt ? t(new Date(b.endedAt)) : "ongoing"}
                                {b.durationMin != null && ` · ${formatMinutes(b.durationMin)}`}
                                {b.autoEnded && " · auto-ended"}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </Section>

            <Section
              icon={LogIn}
              title="Sign-ins"
              note={!isAdminOrHR ? "Visible to Admin and HR only" : undefined}
            >
              {isAdminOrHR && loginEventsLoading && <LoadingRow />}
              {isAdminOrHR && !loginEventsLoading && signIns.length === 0 && (
                <EmptyRow text="No sign-ins on this date." />
              )}
              {isAdminOrHR && !loginEventsLoading && signIns.length > 0 && (
                <ul className="divide-y divide-border-subtle">
                  {signIns.map((s, i) => {
                    const isLatest = i === signIns.length - 1;
                    const live = isLatest && isToday && !s.end;
                    return (
                      <li key={s.key} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                        <Monitor className="size-4 text-text-dim shrink-0" />
                        <span className="tabular-nums font-medium">
                          {s.start ? t(s.start) : "Before this day"}
                        </span>
                        <span className="text-text-dim">→</span>
                        <span className="tabular-nums">
                          {s.end ? (
                            t(s.end)
                          ) : live ? (
                            <span className="inline-flex items-center gap-1.5 text-success">
                              <span className="size-1.5 rounded-full bg-success" /> signed in
                            </span>
                          ) : (
                            <span
                              className="text-text-dim"
                              title="The tab or app was closed without signing out"
                            >
                              —
                            </span>
                          )}
                        </span>
                        <span className="ml-auto flex items-center gap-2">
                          {s.start && (s.end || live) && (
                            <span className="text-xs text-text-dim tabular-nums">
                              {formatMinutes(
                                ((s.end?.getTime() ?? now) - s.start.getTime()) / 60_000,
                              )}
                            </span>
                          )}
                          <Tag tone="muted">{s.source}</Tag>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {isAdminOrHR && signIns.some((s) => !s.end) && (
                <p className="px-4 py-2 text-[11px] text-text-dim border-t border-border-subtle">
                  “—” means the tab or app was closed without signing out.
                </p>
              )}
            </Section>

            <Section icon={Activity} title="Activity">
              {activityLoading && <LoadingRow />}
              {!activityLoading && !activityRow && (
                <EmptyRow text="No activity data (desktop app not running this day)." />
              )}
              {!activityLoading && activityRow && (
                <div className="p-4 space-y-4">
                  <div>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-text-dim">Active while clocked in</span>
                      <span className="font-semibold tabular-nums">
                        {activityRow.activePercent}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-canvas overflow-hidden">
                      <div
                        className="h-full rounded-full bg-success"
                        style={{ width: `${activityRow.activePercent}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <MiniStat
                      icon={Keyboard}
                      label="Keystrokes"
                      value={activityRow.keystrokeCount.toLocaleString()}
                    />
                    <MiniStat
                      icon={MousePointerClick}
                      label="Mouse clicks"
                      value={activityRow.clickCount.toLocaleString()}
                    />
                  </div>
                  <p className="text-[11px] text-text-dim">
                    From mouse & keyboard input only. Counts are plain numbers, never what was typed
                    or clicked.
                  </p>
                </div>
              )}
            </Section>

            <Section icon={Timer} title="Idle stretches">
              {workSessionsLoading && <LoadingRow />}
              {!workSessionsLoading && dayIdleEvents.length === 0 && (
                <EmptyRow text="No idle stretches on this date." />
              )}
              {!workSessionsLoading && dayIdleEvents.length > 0 && (
                <ul className="divide-y divide-border-subtle">
                  {dayIdleEvents.map((e) => {
                    const start = new Date(e.idleStartedAt);
                    const end = new Date(start.getTime() + e.idleMinutes * 60_000);
                    return (
                      <li key={e.id} className="px-4 py-2.5 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums font-medium">
                            {t(start)} – {t(end)}
                          </span>
                          <Tag tone="danger">{formatMinutes(e.idleMinutes)}</Tag>
                        </div>
                        <p className="text-xs text-text-dim mt-0.5">{e.reason}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>
          </div>

          <Section
            icon={Video}
            title="Screen recordings"
            note={dayRecordings.length > 0 ? `${dayRecordings.length} clips` : undefined}
          >
            {recordingsLoading && <LoadingRow />}
            {!recordingsLoading && dayRecordings.length === 0 && (
              <EmptyRow text="No recordings on this date (needs the desktop app)." />
            )}
            {!recordingsLoading && dayRecordings.length > 0 && (
              <div className="p-4 flex flex-wrap gap-2 max-h-72 overflow-y-auto">
                {dayRecordings.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setViewing(r)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-canvas/50 px-2.5 py-1.5 text-xs tabular-nums hover:border-primary/60 hover:bg-primary/5 transition"
                  >
                    <Play className="size-3 fill-current" />
                    {t(new Date(r.startedAt))}
                    <span className="text-text-dim">{Math.round(r.durationSec / 60)}m</span>
                  </button>
                ))}
              </div>
            )}
          </Section>
        </>
      )}

      <RecordingViewerDialog
        recording={viewing}
        onOpenChange={(open) => !open && setViewing(undefined)}
      />
    </div>
  );
}

// ---- day timeline ----

type Span = { start: number; end: number | null };

function DayTimeline({
  dayStart,
  dayEnd,
  now,
  work,
  breaks,
  idle,
  signIns,
}: {
  dayStart: Date;
  dayEnd: Date;
  now: number;
  work: Span[];
  breaks: Span[];
  idle: Span[];
  signIns: Span[];
}) {
  const all = [...work, ...signIns];
  if (all.length === 0) return null;

  // Zoom to the part of the day that has something in it, in whole hours.
  const HOUR = 3_600_000;
  const lo = Math.max(dayStart.getTime(), Math.min(...all.map((s) => s.start)));
  const hi = Math.min(dayEnd.getTime(), Math.max(...all.map((s) => s.end ?? s.start), lo + HOUR));
  const from = Math.floor((lo - dayStart.getTime()) / HOUR) * HOUR + dayStart.getTime();
  const to = Math.min(
    dayEnd.getTime() + 1,
    Math.ceil((hi - dayStart.getTime()) / HOUR) * HOUR + dayStart.getTime(),
  );
  const span = to - from;
  const pos = (ms: number) => `${((Math.min(Math.max(ms, from), to) - from) / span) * 100}%`;
  const width = (s: Span, fallbackEnd: number) => {
    const a = Math.max(s.start, from);
    const b = Math.min(s.end ?? fallbackEnd, to);
    return `${(Math.max(0, b - a) / span) * 100}%`;
  };

  const hours = Math.round(span / HOUR);
  const step = hours > 12 ? 3 : hours > 6 ? 2 : 1;
  const ticks: number[] = [];
  for (let h = 0; h <= hours; h += step) ticks.push(from + h * HOUR);

  const Bar = ({
    s,
    className,
    fallbackEnd,
  }: {
    s: Span;
    className: string;
    fallbackEnd: number;
  }) => (
    <div
      className={`absolute inset-y-0 rounded-sm ${className}`}
      style={{ left: pos(s.start), width: width(s, fallbackEnd) }}
      title={`${t(new Date(s.start))} – ${s.end ? t(new Date(s.end)) : "…"}`}
    />
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-dim">
        <Legend className="bg-success" label="Clocked in" />
        <Legend className="bg-amber-400" label="Break" />
        <Legend className="bg-destructive" label="Idle" />
        {signIns.length > 0 && <Legend className="bg-primary/50" label="Signed in" />}
      </div>
      <div className="space-y-1.5">
        <div className="relative h-7 rounded-md bg-canvas overflow-hidden">
          {work.map((s, i) => (
            <Bar key={`w${i}`} s={s} className="bg-success/80" fallbackEnd={now} />
          ))}
          {breaks.map((s, i) => (
            <Bar key={`b${i}`} s={s} className="bg-amber-400" fallbackEnd={now} />
          ))}
          {idle.map((s, i) => (
            <Bar key={`i${i}`} s={s} className="bg-destructive/80" fallbackEnd={now} />
          ))}
        </div>
        {signIns.length > 0 && (
          <div className="relative h-2.5 rounded-sm bg-canvas overflow-hidden">
            {signIns.map((s, i) =>
              s.end ? (
                <Bar key={`s${i}`} s={s} className="bg-primary/50" fallbackEnd={s.start} />
              ) : (
                // No sign-out seen: mark the sign-in moment only.
                <div
                  key={`s${i}`}
                  className="absolute inset-y-0 w-1 rounded-sm bg-primary"
                  style={{ left: pos(s.start) }}
                  title={`Signed in ${t(new Date(s.start))}`}
                />
              ),
            )}
          </div>
        )}
        <div className="relative h-4 text-[10px] text-text-dim tabular-nums">
          {ticks.map((ms, i) => (
            <span
              key={ms}
              className={`absolute top-0 ${i === 0 ? "" : i === ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
              style={{ left: pos(ms) }}
            >
              {format(new Date(Math.min(ms, dayEnd.getTime())), "h a")}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-2.5 rounded-sm ${className}`} />
      {label}
    </span>
  );
}

// ---- small pieces ----

function Section({
  icon: Icon,
  title,
  note,
  children,
}: {
  icon: typeof Clock;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-2">
        <Icon className="size-4 text-text-dim" />
        <h2 className="text-sm font-semibold">{title}</h2>
        {note && <span className="ml-auto text-xs text-text-dim">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-canvas/40 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs text-text-dim">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-canvas/50 px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs text-text-dim">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Tag({ tone, children }: { tone: "muted" | "warn" | "danger"; children: React.ReactNode }) {
  const cls = {
    muted: "border-border-subtle text-text-dim",
    warn: "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
    danger: "border-destructive/30 bg-destructive/5 text-destructive",
  }[tone];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${cls}`}>
      {children}
    </span>
  );
}

function StatusPill({ tone, label }: { tone: "success" | "muted"; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        tone === "success" ? "bg-success/10 text-success" : "bg-canvas text-text-dim"
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${tone === "success" ? "bg-success" : "bg-text-dim/50"}`}
      />
      {label}
    </span>
  );
}

function LoadingRow() {
  return (
    <div className="flex items-center gap-2 text-sm text-text-dim py-8 justify-center">
      <Loader2 className="size-4 animate-spin" /> Loading…
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="text-sm text-text-dim py-8 text-center">{text}</p>;
}

// ---- sign-in pairing ----

interface SignInSession {
  key: string;
  start: Date | null; // null: signed in before this day (only a sign-out seen)
  end: Date | null; // null: no sign-out seen yet
  source: "Desktop app" | "Browser";
}

// Sign-outs this close to the previous one are the same sign-out recorded twice.
const DUPLICATE_SIGN_OUT_MS = 10_000;

function sourceOf(userAgent: string | null): SignInSession["source"] {
  return userAgent && /electron/i.test(userAgent) ? "Desktop app" : "Browser";
}

/** Pairs each sign-in with the next sign-out, oldest first. */
function buildSessions(events: LoginEvent[]): SignInSession[] {
  const sorted = [...events].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const sessions: SignInSession[] = [];
  let open: SignInSession | null = null;
  let lastSignOut = 0;
  for (const e of sorted) {
    const at = new Date(e.createdAt);
    if (e.type === "LOGIN") {
      if (open) sessions.push(open); // signed in again without signing out
      open = { key: e.id, start: at, end: null, source: sourceOf(e.userAgent) };
    } else {
      if (at.getTime() - lastSignOut < DUPLICATE_SIGN_OUT_MS) continue;
      lastSignOut = at.getTime();
      if (open) {
        sessions.push({ ...open, end: at });
        open = null;
      } else {
        sessions.push({ key: e.id, start: null, end: at, source: sourceOf(e.userAgent) });
      }
    }
  }
  if (open) sessions.push(open);
  return sessions;
}
