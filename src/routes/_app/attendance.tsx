import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlarmClock,
  CalendarDays,
  CalendarOff,
  ClipboardCheck,
  Clock,
  Layers,
  Loader2,
  LogOut,
  Settings2,
  Timer,
  TimerOff,
  UserX,
  Users,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { HolidayManagerDialog } from "@/components/holiday-manager-dialog";
import { ShiftTemplatesDialog } from "@/components/shift-templates-dialog";
import { AttendanceRulesSheet } from "@/components/attendance-rules-sheet";
import { AttendanceMySummary } from "@/components/attendance-my-summary";
import { AttendanceLiveBoard } from "@/components/attendance-live-board";
import { AttendanceMonthlyReport } from "@/components/attendance-monthly-report";
import { ReasonReviewPanel, ReviewBadge } from "@/components/reason-review-panel";
import { useAttendanceCalendar, useDayStatuses, useWorkSessions } from "@/hooks/use-work-session";
import { useAuthStore } from "@/stores/auth-store";
import { isDepartmentMatch } from "@/hooks/use-department-guard";
import { getInitials } from "@/lib/utils";
import type { DayStatus, PersonRef, WorkSession } from "@/lib/api/types";
import {
  ALL,
  awaitingCorrection,
  buildDailySummary,
  buildReportRows,
  computeStats,
  filterDayStatuses,
  filterSessions,
  fmtDate,
  fmtDayKey,
  fmtTime,
  formatDuration,
  isAutoClosed,
  isoDay,
  leaveLabel,
  mergeSessionRows,
  idleTotal,
  personName,
  type ReportKind,
  type StatusFilter,
} from "@/lib/attendance-view";

export const Route = createFileRoute("/_app/attendance")({
  component: AttendancePage,
});

// ─── small pieces ───────────────────────────────────────────────────────────

const KIND_BADGE: Record<ReportKind, { label: string; className: string }> = {
  late: { label: "Late", className: "bg-amber-500/10 text-amber-500" },
  early: { label: "Early leave", className: "bg-rose-500/10 text-rose-500" },
  idle: { label: "Idle", className: "bg-sky-500/10 text-sky-500" },
  absent: { label: "Absent", className: "bg-red-500/10 text-red-500" },
  noclockout: { label: "No clock-out", className: "bg-orange-500/10 text-orange-500" },
};

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${className}`}>{children}</span>;
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "warn";
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-panel p-4">
      <div className="flex items-center gap-2 text-xs text-text-dim">
        <span className={tone === "warn" ? "text-amber-500" : "text-primary"}>{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-text-dim">{hint}</div>}
    </div>
  );
}

/** "Late 25m"; struck through once HR has excused it. */
function LateBadge({ minutes, excused }: { minutes: number; excused?: boolean }) {
  return excused ? (
    <Badge className="bg-muted text-text-dim line-through">Late {formatDuration(minutes)}</Badge>
  ) : (
    <Badge className="bg-amber-500/10 text-amber-500">Late {formatDuration(minutes)}</Badge>
  );
}

function EmployeeCell({ person }: { person?: PersonRef | null }) {
  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-6">
        <AvatarFallback className="text-[10px]">{getInitials(person)}</AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium">{personName(person)}</span>
    </div>
  );
}

function DayBadge({ day }: { day: DayStatus }) {
  return day.status === "ABSENT" ? (
    <Badge className={KIND_BADGE.absent.className}>Absent</Badge>
  ) : (
    <Badge className="bg-indigo-500/10 text-indigo-500">{leaveLabel(day.note)}</Badge>
  );
}

// ─── page ───────────────────────────────────────────────────────────────────

const FILTERED_TABS = new Set(["report", "sessions", "daily"]);

function AttendancePage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role.name === "ADMIN";
  const isManager = user?.role.name === "MANAGER";
  const isHr = isDepartmentMatch(user?.department?.name, "HR");
  const canSeeAll = isAdmin || isManager || user?.department?.name === "HR";
  // Admin and HR run the calendar, the rules and the shift templates.
  const canManageSetup = isAdmin || isHr;
  // Admin, HR and managers decide on late / early reasons (the server also checks it's their person).
  const canReview = isAdmin || isHr || isManager;

  const [tab, setTab] = useState(canSeeAll ? "live" : "my");
  const [from, setFrom] = useState(() => isoDay(-29));
  const [to, setTo] = useState(() => isoDay(0));
  const [employeeId, setEmployeeId] = useState(ALL);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<WorkSession | null>(null);
  const [holidaysOpen, setHolidaysOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  const range = { from, to };
  const { data: sessions, isLoading } = useWorkSessions(undefined, range);
  const { data: dayStatuses } = useDayStatuses(undefined, range);
  const { data: calendar } = useAttendanceCalendar(range);

  const allSessions = sessions ?? [];
  const allDays = dayStatuses ?? [];

  // Keep the open drawer in step with fresh data (e.g. right after a review decision).
  const openSession = selected ? (allSessions.find((s) => s.id === selected.id) ?? selected) : null;

  const employees = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of allSessions) if (s.user) map.set(s.userId, personName(s.user));
    for (const d of allDays) map.set(d.userId, personName(d.user));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [allSessions, allDays]);

  const filter = { employeeId, status };
  const filteredSessions = useMemo(() => filterSessions(allSessions, filter), [allSessions, employeeId, status]);
  const filteredDays = useMemo(() => filterDayStatuses(allDays, filter), [allDays, employeeId, status]);

  const stats = useMemo(() => computeStats(allSessions, allDays, employeeId), [allSessions, allDays, employeeId]);
  const reportRows = useMemo(
    () => buildReportRows(filteredSessions, filteredDays, status),
    [filteredSessions, filteredDays, status],
  );
  const sessionRows = useMemo(
    () => mergeSessionRows(filteredSessions, filteredDays),
    [filteredSessions, filteredDays],
  );
  const dailyRows = useMemo(
    () => buildDailySummary(filteredSessions, filteredDays, calendar),
    [filteredSessions, filteredDays, calendar],
  );

  const presets: { label: string; apply: () => void }[] = [
    { label: "Today", apply: () => (setFrom(isoDay(0)), setTo(isoDay(0))) },
    { label: "Yesterday", apply: () => (setFrom(isoDay(-1)), setTo(isoDay(-1))) },
    { label: "Last 7 days", apply: () => (setFrom(isoDay(-6)), setTo(isoDay(0))) },
    { label: "Last 30 days", apply: () => (setFrom(isoDay(-29)), setTo(isoDay(0))) },
    {
      label: "This month",
      apply: () => (setFrom(`${isoDay(0).slice(0, 7)}-01`), setTo(isoDay(0))),
    },
  ];

  const cols = canSeeAll ? 6 : 5;
  const loadingRow = (
    <TableRow>
      <TableCell colSpan={cols} className="py-8 text-center text-text-dim">
        <Loader2 className="mx-auto size-4 animate-spin" />
      </TableCell>
    </TableRow>
  );

  return (
    <div className="mx-auto max-w-[1280px] space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="grid size-11 shrink-0 place-items-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
            <Clock className="size-5" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Attendance & Work Sessions</h1>
            <p className="mt-1 text-sm text-text-dim">
              {canSeeAll
                ? "Who is in right now, who was late or absent, and where time was lost — with the reasons they gave."
                : "Track your work hours, late arrivals, leave and idle time."}
            </p>
          </div>
        </div>
        {canManageSetup && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setHolidaysOpen(true)}>
              <CalendarDays className="size-4" />
              Holidays
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setTemplatesOpen(true)}>
              <Layers className="size-4" />
              Shift templates
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRulesOpen(true)}>
              <Settings2 className="size-4" />
              Rules
            </Button>
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          {canSeeAll && <TabsTrigger value="live">Live board</TabsTrigger>}
          <TabsTrigger value="my">My attendance</TabsTrigger>
          <TabsTrigger value="report">Late, Absent & Idle</TabsTrigger>
          <TabsTrigger value="sessions">All Sessions</TabsTrigger>
          <TabsTrigger value="daily">Daily Summary</TabsTrigger>
          {canSeeAll && <TabsTrigger value="monthly">Monthly Report</TabsTrigger>}
        </TabsList>

        {canSeeAll && (
          <TabsContent value="live" className="mt-4">
            <AttendanceLiveBoard />
          </TabsContent>
        )}

        <TabsContent value="my" className="mt-4">
          <AttendanceMySummary />
        </TabsContent>

        {canSeeAll && (
          <TabsContent value="monthly" className="mt-4">
            <AttendanceMonthlyReport />
          </TabsContent>
        )}

        {/* Filters + numbers, shared by the three list tabs */}
        {FILTERED_TABS.has(tab) && (
          <div className="mt-4 space-y-6">
            <div className="space-y-3 rounded-xl border border-border-subtle bg-panel p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="att-from" className="text-xs">From</Label>
                  <Input
                    id="att-from"
                    type="date"
                    value={from}
                    max={to}
                    onChange={(e) => e.target.value && setFrom(e.target.value)}
                    className="h-9 w-[150px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="att-to" className="text-xs">To</Label>
                  <Input
                    id="att-to"
                    type="date"
                    value={to}
                    min={from}
                    onChange={(e) => e.target.value && setTo(e.target.value)}
                    className="h-9 w-[150px]"
                  />
                </div>
                {canSeeAll && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Employee</Label>
                    <Select value={employeeId} onValueChange={setEmployeeId}>
                      <SelectTrigger className="h-9 w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>All employees</SelectItem>
                        {employees.map(([id, name]) => (
                          <SelectItem key={id} value={id}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs">Show</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
                    <SelectTrigger className="h-9 w-[230px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sessions</SelectItem>
                      {canReview && <SelectItem value="review">Reasons to review ({stats.toReview})</SelectItem>}
                      <SelectItem value="absent">Absent / on leave</SelectItem>
                      <SelectItem value="late">Late arrivals only</SelectItem>
                      <SelectItem value="early">Early leaves only</SelectItem>
                      <SelectItem value="idle">With idle time only</SelectItem>
                      <SelectItem value="flagged">Anything flagged</SelectItem>
                      <SelectItem value="active">Active now</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {presets.map((p) => (
                  <Button key={p.label} type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={p.apply}>
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard icon={<Users className="size-4" />} label="Sessions" value={stats.total} />
              <StatCard
                tone="warn"
                icon={<AlarmClock className="size-4" />}
                label="Late arrivals"
                value={stats.late}
                hint={
                  stats.total
                    ? `${Math.round((stats.late / stats.total) * 100)}% of sessions${stats.late ? ` · avg ${formatDuration(stats.avgLate)} late` : ""}${stats.lateExcused ? ` · ${stats.lateExcused} excused` : ""}`
                    : undefined
                }
              />
              <StatCard
                tone="warn"
                icon={<LogOut className="size-4" />}
                label="Early leaves"
                value={stats.early}
                hint={stats.earlyExcused ? `${stats.earlyExcused} excused` : undefined}
              />
              <StatCard tone="warn" icon={<UserX className="size-4" />} label="Absent days" value={stats.absent} />
              <StatCard icon={<CalendarOff className="size-4" />} label="Days on leave" value={stats.onLeave} />
              <StatCard tone="warn" icon={<TimerOff className="size-4" />} label="Forgot to clock out" value={stats.noClockOut} />
              <StatCard
                tone="warn"
                icon={<Timer className="size-4" />}
                label="Idle time"
                value={formatDuration(stats.idleMin)}
                hint={`${stats.idleEvents} event${stats.idleEvents === 1 ? "" : "s"}`}
              />
              <StatCard
                tone={stats.toReview ? "warn" : "default"}
                icon={<ClipboardCheck className="size-4" />}
                label="Reasons to review"
                value={stats.toReview}
                hint={stats.toReview ? "late / early reasons nobody has decided on" : "all reasons reviewed"}
              />
            </div>
          </div>
        )}

        {/* Report */}
        <TabsContent value="report" className="mt-4">
          <div className="overflow-hidden rounded-xl border border-border-subtle bg-panel">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {canSeeAll && <TableHead>Employee</TableHead>}
                  <TableHead>Type</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Reason / note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && loadingRow}
                {!isLoading && reportRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={cols} className="py-8 text-center text-text-dim">
                      {status === "review" ? "Every reason has been reviewed." : "Nothing to flag in this period."}
                    </TableCell>
                  </TableRow>
                )}
                {reportRows.map((r) => (
                  <TableRow
                    key={r.key}
                    className={r.session ? "cursor-pointer" : undefined}
                    onClick={() => r.session && setSelected(r.session)}
                  >
                    <TableCell className="whitespace-nowrap text-sm">
                      {fmtDate(new Date(r.at).toISOString(), true)}
                    </TableCell>
                    {canSeeAll && (
                      <TableCell>
                        <EmployeeCell person={r.person} />
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge className={KIND_BADGE[r.kind].className}>{KIND_BADGE[r.kind].label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-text-dim">{r.detail}</TableCell>
                    <TableCell className="max-w-[320px] text-sm">
                      {r.reason ?? (
                        <span className="italic text-text-dim">
                          {r.kind === "absent"
                            ? "—"
                            : r.kind === "noclockout"
                              ? "Waiting for the employee to say when they finished"
                              : "No reason given yet"}
                        </span>
                      )}
                      {r.review?.status && (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <ReviewBadge status={r.review.status} />
                          {r.review.note && <span className="text-xs text-text-dim">{r.review.note}</span>}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* All sessions (+ absent / on-leave days) */}
        <TabsContent value="sessions" className="mt-4">
          <div className="overflow-hidden rounded-xl border border-border-subtle bg-panel">
            <Table>
              <TableHeader>
                <TableRow>
                  {canSeeAll && <TableHead>Employee</TableHead>}
                  <TableHead>Date</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && loadingRow}
                {!isLoading && sessionRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={cols} className="py-8 text-center text-text-dim">
                      No work sessions match these filters.
                    </TableCell>
                  </TableRow>
                )}
                {sessionRows.map((row) =>
                  row.kind === "day" ? (
                    <TableRow key={`${row.day.userId}-${row.day.date}`}>
                      {canSeeAll && (
                        <TableCell>
                          <EmployeeCell person={row.day.user} />
                        </TableCell>
                      )}
                      <TableCell className="whitespace-nowrap text-sm">{fmtDayKey(row.day.date)}</TableCell>
                      <TableCell className="text-sm text-text-dim">—</TableCell>
                      <TableCell className="text-sm text-text-dim">—</TableCell>
                      <TableCell>
                        <DayBadge day={row.day} />
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-text-dim">—</TableCell>
                    </TableRow>
                  ) : (
                    <TableRow key={row.session.id} className="cursor-pointer" onClick={() => setSelected(row.session)}>
                      {canSeeAll && (
                        <TableCell>
                          <EmployeeCell person={row.session.user} />
                        </TableCell>
                      )}
                      <TableCell className="whitespace-nowrap text-sm">{fmtDate(row.session.clockInAt, true)}</TableCell>
                      <TableCell className="text-sm text-text-dim">{fmtTime(row.session.clockInAt)}</TableCell>
                      <TableCell className="text-sm text-text-dim">
                        {row.session.clockOutAt ? (
                          <>
                            {fmtTime(row.session.clockOutAt)}
                            {isAutoClosed(row.session) && !row.session.correctionSubmittedAt && (
                              <span className="ml-1 text-xs text-orange-500">(auto)</span>
                            )}
                          </>
                        ) : (
                          <Badge className="bg-emerald-500/10 text-emerald-500">Active now</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {row.session.approvedLateStartId && (
                            <Badge className="bg-sky-500/10 text-sky-500">Approved late start (owner)</Badge>
                          )}
                          {row.session.adjustmentRequestId && (
                            <Badge className="bg-sky-500/10 text-sky-500">Admin-approved adjustment</Badge>
                          )}
                          {row.session.lateByMin != null && (
                            <LateBadge minutes={row.session.lateByMin} excused={row.session.lateReviewStatus === "EXCUSED"} />
                          )}
                          {row.session.earlyByMin != null && (
                            <Badge
                              className={
                                row.session.earlyReviewStatus === "EXCUSED"
                                  ? "bg-muted text-text-dim line-through"
                                  : KIND_BADGE.early.className
                              }
                            >
                              Left {formatDuration(row.session.earlyByMin)} early
                            </Badge>
                          )}
                          {isAutoClosed(row.session) && (
                            <Badge className={KIND_BADGE.noclockout.className}>
                              {awaitingCorrection(row.session) ? "Forgot to clock out" : "Clock-out corrected"}
                            </Badge>
                          )}
                          {(row.session.idleEvents?.length ?? 0) > 0 && (
                            <Badge className={KIND_BADGE.idle.className}>
                              Idle {formatDuration(idleTotal(row.session))} ({row.session.idleEvents?.length}×)
                            </Badge>
                          )}
                          {row.session.lateByMin == null &&
                            row.session.earlyByMin == null &&
                            !isAutoClosed(row.session) &&
                            !row.session.idleEvents?.length && <span className="text-text-dim">—</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {row.session.durationMin != null ? formatDuration(row.session.durationMin) : "—"}
                      </TableCell>
                    </TableRow>
                  ),
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Daily summary */}
        <TabsContent value="daily" className="mt-4">
          <div className="overflow-hidden rounded-xl border border-border-subtle bg-panel">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Late</TableHead>
                  <TableHead>Absent</TableHead>
                  <TableHead>On leave</TableHead>
                  <TableHead>Idle events</TableHead>
                  <TableHead className="text-right">Total worked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-text-dim">
                      Not enough data for daily summaries.
                    </TableCell>
                  </TableRow>
                )}
                {dailyRows.map((g) => (
                  <TableRow key={g.key} className={g.note ? "bg-muted/30" : undefined}>
                    <TableCell className="text-sm font-medium">
                      {fmtDayKey(g.key)}
                      {g.note && <span className="ml-2 text-xs font-normal text-text-dim">{g.note}</span>}
                    </TableCell>
                    <TableCell className="text-sm">{g.sessions || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {g.late ? <span className="font-medium text-amber-500">{g.late}</span> : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {g.absent ? <span className="font-medium text-red-500">{g.absent}</span> : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {g.onLeave ? <span className="font-medium text-indigo-500">{g.onLeave}</span> : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {g.idle ? <span className="font-medium text-sky-500">{g.idle}</span> : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {g.totalMin ? formatDuration(g.totalMin) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {canManageSetup && (
        <>
          <HolidayManagerDialog open={holidaysOpen} onOpenChange={setHolidaysOpen} />
          <ShiftTemplatesDialog open={templatesOpen} onOpenChange={setTemplatesOpen} />
          <AttendanceRulesSheet open={rulesOpen} onOpenChange={setRulesOpen} />
        </>
      )}

      {/* Detail drawer */}
      <Sheet open={!!openSession} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {openSession && (
            <>
              <SheetHeader>
                <SheetTitle>{personName(openSession.user)}</SheetTitle>
                <SheetDescription>
                  {fmtDate(openSession.clockInAt, true)}
                  {openSession.user?.shiftStart && openSession.user?.shiftEnd
                    ? ` · Shift ${openSession.user.shiftStart}–${openSession.user.shiftEnd}`
                    : ""}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-5 px-4 pb-6">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-text-dim">Clock in</div>
                    {fmtTime(openSession.clockInAt)}
                  </div>
                  <div>
                    <div className="text-xs text-text-dim">Clock out</div>
                    {openSession.clockOutAt ? fmtTime(openSession.clockOutAt) : "Active"}
                  </div>
                  <div>
                    <div className="text-xs text-text-dim">Worked</div>
                    {openSession.durationMin != null ? formatDuration(openSession.durationMin) : "—"}
                  </div>
                </div>

                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-text-dim">Arrival</h3>
                  {openSession.lateByMin != null ? (
                    <div className="space-y-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                      <LateBadge minutes={openSession.lateByMin} excused={openSession.lateReviewStatus === "EXCUSED"} />
                      <p className="text-sm">{openSession.lateReason ?? <i className="text-text-dim">No reason given yet</i>}</p>
                      {openSession.lateReasonAt && (
                        <p className="text-xs text-text-dim">Answered at {fmtTime(openSession.lateReasonAt)}</p>
                      )}
                      <ReasonReviewPanel
                        sessionId={openSession.id}
                        kind="LATE"
                        status={openSession.lateReviewStatus}
                        note={openSession.lateReviewNote}
                        reviewedAt={openSession.lateReviewedAt}
                        canReview={canReview && openSession.userId !== user?.id}
                        hasReason={!!openSession.lateReason}
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-text-dim">On time.</p>
                  )}
                </section>

                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-text-dim">Departure</h3>
                  {isAutoClosed(openSession) ? (
                    <div className="space-y-1.5 rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
                      <Badge className={KIND_BADGE.noclockout.className}>Forgot to clock out</Badge>
                      <p className="text-sm">
                        The session was still open, so it was closed automatically
                        {openSession.autoClosedAt ? ` at ${fmtTime(openSession.autoClosedAt)}` : ""} using the end of their shift.
                      </p>
                      {openSession.correctionSubmittedAt ? (
                        <p className="text-sm">
                          <strong>Employee says they finished at{" "}
                          {openSession.correctedClockOutAt ? fmtTime(openSession.correctedClockOutAt) : "—"}:</strong>{" "}
                          {openSession.correctionNote}
                        </p>
                      ) : (
                        <p className="text-sm italic text-text-dim">Waiting for the employee to say when they finished.</p>
                      )}
                    </div>
                  ) : openSession.earlyByMin != null ? (
                    <div className="space-y-1.5 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3">
                      <Badge
                        className={
                          openSession.earlyReviewStatus === "EXCUSED" ? "bg-muted text-text-dim line-through" : KIND_BADGE.early.className
                        }
                      >
                        Left {formatDuration(openSession.earlyByMin)} before shift end
                      </Badge>
                      <p className="text-sm">{openSession.earlyReason ?? <i className="text-text-dim">No reason given</i>}</p>
                      <ReasonReviewPanel
                        sessionId={openSession.id}
                        kind="EARLY"
                        status={openSession.earlyReviewStatus}
                        note={openSession.earlyReviewNote}
                        reviewedAt={openSession.earlyReviewedAt}
                        canReview={canReview && openSession.userId !== user?.id}
                        hasReason={!!openSession.earlyReason}
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-text-dim">{openSession.clockOutAt ? "Left on time." : "Still working."}</p>
                  )}
                </section>

                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-text-dim">
                    Idle periods & reasons
                  </h3>
                  {openSession.idleEvents?.length ? (
                    openSession.idleEvents.map((e) => (
                      <div key={e.id} className="space-y-1 rounded-lg border border-sky-500/30 bg-sky-500/5 p-3">
                        <div className="text-xs font-medium text-sky-500">
                          {formatDuration(e.idleMinutes)} idle from {fmtTime(e.idleStartedAt)}
                        </div>
                        <p className="text-sm">{e.reason}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-text-dim">No idle periods recorded.</p>
                  )}
                </section>

                {!!openSession.breaks?.length && (
                  <section className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-text-dim">Breaks</h3>
                    {openSession.breaks.map((b) => (
                      <div key={b.id} className="flex justify-between text-sm">
                        <span className="text-text-dim">{fmtTime(b.startedAt)}</span>
                        <span>{b.durationMin != null ? formatDuration(b.durationMin) : "On break"}</span>
                      </div>
                    ))}
                  </section>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
