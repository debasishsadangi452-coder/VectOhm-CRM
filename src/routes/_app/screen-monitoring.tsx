import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, isSameDay, startOfDay, subDays } from "date-fns";
import { workDayKeyOf, workDayWindow } from "@/lib/work-day";
import {
  Activity,
  ArrowLeft,
  Calendar as CalendarIcon,
  ChevronRight,
  Clock,
  Download,
  Keyboard,
  Monitor,
  MousePointerClick,
  Play,
  Search,
  Timer,
  Trash2,
  Users,
  Video,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RecordingViewerDialog } from "@/components/recording-viewer-dialog";
import { useScreenRecordings, useScreenRecordingThumbnail } from "@/hooks/use-screen-recordings";
import { useActivitySummary, useActivityTimeline } from "@/hooks/use-activity-monitoring";
import { useWorkSessions } from "@/hooks/use-work-session";
import type { ActivitySummaryRow } from "@/lib/api/activity-monitoring";
import { groupClipsByHour, type ClipStats } from "@/lib/recording-hours";
import type { IdleEvent, WorkSession } from "@/lib/api/types";
import {
  deleteScreenRecording,
  downloadScreenRecording,
  recordingFilename,
  type ScreenRecording,
} from "@/lib/api/screen-recordings";
import { getInitials } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

export const Route = createFileRoute("/_app/screen-monitoring")({
  component: ScreenMonitoringPage,
});

type Period = "today" | "yesterday" | "7d";

const PERIOD_LABEL: Record<Period, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7d": "Last 7 days",
};

// "Today" is the current work day (08:00 to 08:00), so a night shift is not split at midnight.
function periodRange(period: Period): { from: Date; to: Date } {
  const todayKey = workDayKeyOf(new Date());
  const keyBack = (back: number) => workDayKeyOf(subDays(workDayWindow(todayKey).start, back));
  if (period === "yesterday") {
    const w = workDayWindow(keyBack(1));
    return { from: w.start, to: w.end };
  }
  if (period === "7d") return { from: workDayWindow(keyBack(6)).start, to: workDayWindow(todayKey).end };
  const w = workDayWindow(todayKey);
  return { from: w.start, to: w.end };
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h === 0 ? `${m}m` : `${h}h ${m}m`;
}

function formatCount(n: number): string {
  return n.toLocaleString();
}

function activityTone(percent: number) {
  if (percent >= 60) return { bar: "bg-success", text: "text-success" };
  if (percent >= 30) return { bar: "bg-amber-500", text: "text-amber-600" };
  return { bar: "bg-destructive", text: "text-destructive" };
}

// How long recordings are kept before the server's retention sweep deletes
// them (see SCREEN_RECORDING_RETENTION_DAYS, server/screen-recordings/retention.ts)
// -- mirrored here so the calendar picker below doesn't offer dates that have
// already been swept. Keep this in sync if that env var is ever changed.
const RECORDING_RETENTION_DAYS = 90;

type SortKey = "name" | "active" | "keystrokes" | "clicks" | "recorded";

type IdleEntry = IdleEvent & { person: string };

/** Idle stretches (with the reason the employee gave) that began inside the range, newest first. */
function idleEntries(
  sessions: WorkSession[] | undefined,
  range: { from: Date; to: Date },
): IdleEntry[] {
  const from = range.from.getTime();
  const to = range.to.getTime();
  return (sessions ?? [])
    .flatMap((s) =>
      (s.idleEvents ?? []).map((e) => ({
        ...e,
        person: s.user ? `${s.user.firstName} ${s.user.lastName}` : "",
      })),
    )
    .filter((e) => {
      const t = Date.parse(e.idleStartedAt);
      return t >= from && t <= to;
    })
    .sort((a, b) => Date.parse(b.idleStartedAt) - Date.parse(a.idleStartedAt));
}

function idleSpan(e: IdleEvent): string {
  const start = new Date(e.idleStartedAt);
  const end = new Date(start.getTime() + e.idleMinutes * 60_000);
  return `${format(start, "h:mm a")} – ${format(end, "h:mm a")}`;
}

function ScreenMonitoringPage() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);

  // Visible to Admin, HR, or any department Manager (the server enforces the
  // same rule and scopes Managers to their own department).
  useEffect(() => {
    if (!currentUser) return;
    const isAdmin = currentUser.role.name === "ADMIN";
    const isHR = currentUser.department?.name === "HR";
    const isManager = currentUser.role.name === "MANAGER";
    if (!isAdmin && !isHR && !isManager) navigate({ to: "/" });
  }, [currentUser, navigate]);

  const [period, setPeriod] = useState<Period>("today");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("active");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");

  // Recomputed when the date changes, so a page left open overnight moves on
  // to the new "Today" (the 30s refresh re-renders it).
  const todayKey = workDayKeyOf(new Date());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const range = useMemo(() => periodRange(period), [period, todayKey]);
  const {
    data: rows,
    isLoading,
    dataUpdatedAt,
  } = useActivitySummary({
    from: range.from.toISOString(),
    to: range.to.toISOString(),
  });

  // Everyone in scope is listed (the server returns people with no activity
  // too), so the filters are built from the rows themselves.
  const departmentOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const r of rows ?? []) {
      if (r.user.department) byId.set(r.user.department.id, r.user.department.name);
    }
    return [...byId].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);
  const hasNoDepartment = (rows ?? []).some((r) => !r.user.department);
  const employeeOptions = useMemo(
    () =>
      (rows ?? [])
        .filter(
          (r) =>
            deptFilter === "all" ||
            (deptFilter === "none" ? !r.user.department : r.user.department?.id === deptFilter),
        )
        .map((r) => ({ id: r.user.id, name: `${r.user.firstName} ${r.user.lastName}`.trim() }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [rows, deptFilter],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (rows ?? []).filter((r) => {
      if (
        deptFilter === "none"
          ? r.user.department
          : deptFilter !== "all" && r.user.department?.id !== deptFilter
      ) {
        return false;
      }
      if (userFilter !== "all" && r.user.id !== userFilter) return false;
      if (!q) return true;
      const name = `${r.user.firstName} ${r.user.lastName}`.toLowerCase();
      return name.includes(q) || (r.user.department?.name ?? "").toLowerCase().includes(q);
    });
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case "name":
          return `${a.user.firstName} ${a.user.lastName}`.localeCompare(
            `${b.user.firstName} ${b.user.lastName}`,
          );
        case "keystrokes":
          return b.keystrokeCount - a.keystrokeCount;
        case "clicks":
          return b.clickCount - a.clickCount;
        case "recorded":
          return b.recordedSeconds - a.recordedSeconds;
        default:
          return b.activePercent - a.activePercent;
      }
    });
    return sorted;
  }, [rows, search, sortKey, deptFilter, userFilter]);

  const totals = useMemo(() => {
    const t = { keystrokes: 0, clicks: 0, recordedSec: 0, activePct: 0 };
    for (const r of filtered) {
      t.keystrokes += r.keystrokeCount;
      t.clicks += r.clickCount;
      t.recordedSec += r.recordedSeconds;
      t.activePct += r.activePercent;
    }
    return { ...t, avgActive: filtered.length ? Math.round(t.activePct / filtered.length) : 0 };
  }, [filtered]);

  // Idle reasons come from the work sessions (the server scopes Managers to
  // their department, same as the activity summary).
  const { data: sessions, isLoading: idleLoading } = useWorkSessions(
    undefined,
    { from: format(range.from, "yyyy-MM-dd"), to: format(range.to, "yyyy-MM-dd") },
    30_000,
  );
  const idle = useMemo(() => idleEntries(sessions, range), [sessions, range]);
  const shownIds = useMemo(() => new Set(filtered.map((r) => r.user.id)), [filtered]);
  const shownIdle = idle.filter((e) => shownIds.has(e.userId));

  const selected = (rows ?? []).find((r) => r.user.id === selectedId) ?? null;

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">
      <div className="flex items-start gap-4">
        <div className="size-11 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center text-primary shrink-0">
          <Monitor className="size-5" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Screen Monitoring</h1>
          <p className="text-sm text-text-dim mt-1">
            Activity and screen recordings captured during clocked-in hours, per company policy.
            Keystrokes and clicks are counts only, never what was typed or clicked.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="size-4 text-text-dim absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee or department"
            className="pl-9"
            aria-label="Search employees"
          />
        </div>
        <Select
          value={deptFilter}
          onValueChange={(v) => {
            setDeptFilter(v);
            setUserFilter("all");
          }}
        >
          <SelectTrigger className="w-44" aria-label="Filter by department">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departmentOptions.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
            {hasNoDepartment && <SelectItem value="none">No department</SelectItem>}
          </SelectContent>
        </Select>
        <Select value={userFilter} onValueChange={setUserFilter}>
          <SelectTrigger className="w-52" aria-label="Filter by employee">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All employees</SelectItem>
            {employeeOptions.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList>
            {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
              <TabsTrigger key={p} value={p}>
                {PERIOD_LABEL[p]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <span className="flex items-center gap-1.5 text-xs text-text-dim">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/60" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          Live
          {dataUpdatedAt > 0 && <> · updated {format(new Date(dataUpdatedAt), "h:mm:ss a")}</>}
        </span>
      </div>

      {selected ? (
        <EmployeeDetail
          row={selected}
          period={period}
          idle={idle.filter((e) => e.userId === selected.user.id)}
          onBack={() => setSelectedId(null)}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Kpi
              icon={Users}
              label="Employees"
              value={isLoading ? null : String(filtered.length)}
            />
            <Kpi
              icon={Activity}
              label="Avg. active"
              value={isLoading ? null : `${totals.avgActive}%`}
            />
            <Kpi
              icon={Keyboard}
              label="Keystrokes"
              value={isLoading ? null : formatCount(totals.keystrokes)}
            />
            <Kpi
              icon={MousePointerClick}
              label="Mouse clicks"
              value={isLoading ? null : formatCount(totals.clicks)}
            />
            <Kpi
              icon={Video}
              label="Recorded"
              value={isLoading ? null : formatMinutes(totals.recordedSec / 60)}
            />
          </div>

          <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between gap-3 flex-wrap">
              <span className="text-sm font-semibold">Employees · {PERIOD_LABEL[period]}</span>
              <div className="flex items-center gap-2 text-xs text-text-dim">
                Sort by
                <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                  <SelectTrigger className="h-8 w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active %</SelectItem>
                    <SelectItem value="keystrokes">Keystrokes</SelectItem>
                    <SelectItem value="clicks">Mouse clicks</SelectItem>
                    <SelectItem value="recorded">Recorded time</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="w-56">Active</TableHead>
                    <TableHead className="text-right">Active time</TableHead>
                    <TableHead className="text-right">Idle time</TableHead>
                    <TableHead className="text-right">Keystrokes</TableHead>
                    <TableHead className="text-right">Mouse clicks</TableHead>
                    <TableHead className="text-right">Recorded</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading &&
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={8}>
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      </TableRow>
                    ))}
                  {!isLoading && filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-text-dim py-10">
                        {search || deptFilter !== "all" || userFilter !== "all"
                          ? "No employees match the current filters."
                          : "No employees to show."}
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading &&
                    filtered.map((r) => (
                      <EmployeeRow
                        key={r.user.id}
                        row={r}
                        onOpen={() => setSelectedId(r.user.id)}
                      />
                    ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-2">
              <Timer className="size-4 text-text-dim" />
              <span className="text-sm font-semibold">Idle reasons · {PERIOD_LABEL[period]}</span>
              {shownIdle.length > 0 && (
                <span className="text-xs text-text-dim">({shownIdle.length})</span>
              )}
            </div>
            {idleLoading ? (
              <div className="p-4">
                <Skeleton className="h-6 w-full" />
              </div>
            ) : shownIdle.length === 0 ? (
              <p className="text-sm text-text-dim py-8 text-center">
                No idle stretches reported {period === "7d" ? "in the last 7 days" : period}.
              </p>
            ) : (
              <div className="max-h-[420px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-48">Employee</TableHead>
                      <TableHead className="w-52">Idle</TableHead>
                      <TableHead className="w-20">Length</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shownIdle.map((e) => (
                      <TableRow
                        key={e.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedId(e.userId)}
                        tabIndex={0}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter" || ev.key === " ") {
                            ev.preventDefault();
                            setSelectedId(e.userId);
                          }
                        }}
                      >
                        <TableCell className="font-medium">{e.person}</TableCell>
                        <TableCell className="tabular-nums text-text-dim">
                          {period === "7d" && (
                            <>{format(new Date(e.idleStartedAt), "EEE, MMM d")} · </>
                          )}
                          {idleSpan(e)}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatMinutes(e.idleMinutes)}
                        </TableCell>
                        <TableCell>{e.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string | null;
}) {
  return (
    <div className="bg-panel border border-border-subtle rounded-xl px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-text-dim">
        <Icon className="size-3.5" />
        {label}
      </div>
      {value === null ? (
        <Skeleton className="h-7 w-20 mt-1.5" />
      ) : (
        <div className="text-2xl font-semibold tracking-tight mt-1 tabular-nums">{value}</div>
      )}
    </div>
  );
}

function PersonCell({ row }: { row: ActivitySummaryRow }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <Avatar className="size-8">
        <AvatarFallback className="text-[11px]">{getInitials(row.user)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="font-medium truncate">
          {row.user.firstName} {row.user.lastName}
        </div>
        <div className="text-xs text-text-dim truncate">
          {row.user.department?.name ?? "No department"}
        </div>
      </div>
    </div>
  );
}

function ActiveBar({ percent }: { percent: number }) {
  const tone = activityTone(percent);
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 h-2 rounded-full bg-canvas overflow-hidden">
        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${percent}%` }} />
      </div>
      <span className={`text-sm font-medium tabular-nums w-10 text-right ${tone.text}`}>
        {percent}%
      </span>
    </div>
  );
}

function EmployeeRow({ row, onOpen }: { row: ActivitySummaryRow; onOpen: () => void }) {
  return (
    <TableRow
      className="cursor-pointer"
      onClick={onOpen}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <TableCell>
        <PersonCell row={row} />
      </TableCell>
      <TableCell>
        <ActiveBar percent={row.activePercent} />
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatMinutes(row.activeMinutes)}</TableCell>
      <TableCell className="text-right tabular-nums text-text-dim">
        {formatMinutes(row.idleMinutes)}
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatCount(row.keystrokeCount)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatCount(row.clickCount)}</TableCell>
      <TableCell className="text-right tabular-nums text-text-dim">
        {formatMinutes(row.recordedSeconds / 60)}
      </TableCell>
      <TableCell>
        <ChevronRight className="size-4 text-text-dim" />
      </TableCell>
    </TableRow>
  );
}

// ---- one employee ----

function ClipCard({
  clip: { clip, keystrokes, clicks },
  maxKeys,
  maxClicks,
  selected,
  onSelectedChange,
  onPlay,
}: {
  clip: ClipStats;
  maxKeys: number;
  maxClicks: number;
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
  onPlay: () => void;
}) {
  const time = format(new Date(clip.startedAt), "h:mm a");

  // Fetch the thumbnail only once the card scrolls into view.
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setInView(true), {
      rootMargin: "200px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);
  const thumbUrl = useScreenRecordingThumbnail(inView && clip.thumbnailPath ? clip.id : undefined);

  return (
    <div
      ref={ref}
      className={`group relative rounded-lg border bg-panel overflow-hidden shadow-sm hover:shadow-md transition ${
        selected
          ? "border-primary ring-1 ring-primary"
          : "border-border-subtle hover:border-primary/60"
      }`}
    >
      <button
        type="button"
        onClick={onPlay}
        aria-label={`Play recording from ${time}`}
        className="relative block w-full aspect-video bg-canvas"
      >
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt=""
            className="absolute inset-0 size-full object-cover object-top"
          />
        ) : (
          <Monitor
            className="absolute inset-0 m-auto size-10 text-text-dim/20"
            strokeWidth={1.25}
          />
        )}
        <span className="absolute inset-0 m-auto size-10 rounded-full bg-white/90 text-black grid place-items-center shadow group-hover:scale-110 transition-transform">
          <Play className="size-4 fill-current ml-0.5" />
        </span>
      </button>
      <Checkbox
        checked={selected}
        onCheckedChange={(v) => onSelectedChange(v === true)}
        aria-label={`Select recording from ${time}`}
        className="absolute top-1.5 right-1.5 size-4 bg-white border-border shadow-sm"
      />
      <div className="px-2.5 py-2 space-y-1.5">
        <div className="text-xs font-semibold tabular-nums">{time}</div>
        <div className="flex items-center gap-2">
          <MiniBar icon={Keyboard} value={keystrokes} max={maxKeys} label="keystrokes" />
          <MiniBar icon={MousePointerClick} value={clicks} max={maxClicks} label="mouse clicks" />
        </div>
      </div>
    </div>
  );
}

function MiniBar({
  icon: Icon,
  value,
  max,
  label,
}: {
  icon: typeof Users;
  value: number;
  max: number;
  label: string;
}) {
  return (
    <span className="flex flex-1 items-center gap-1" title={`${formatCount(value)} ${label}`}>
      <Icon className="size-3 text-text-dim shrink-0" />
      <span className="flex-1 h-1 rounded-full bg-canvas overflow-hidden">
        <span
          className="block h-full rounded-full bg-success"
          style={{ width: `${Math.round((value / max) * 100)}%` }}
        />
      </span>
    </span>
  );
}

function EmployeeDetail({
  row,
  period,
  idle,
  onBack,
}: {
  row: ActivitySummaryRow;
  period: Period;
  idle: IdleEntry[];
  onBack: () => void;
}) {
  // Recordings are viewed one day at a time (up to ~2,200 clips a day).
  // Deliberately independent of the page's `period` filter above (which only
  // ever covers up to 7 days) -- recordings are kept for RECORDING_RETENTION_DAYS,
  // so the picker lets a reviewer jump to any day within that window, not just
  // whichever day the KPI totals happen to be summarizing.
  const today = useMemo(() => startOfDay(new Date(`${workDayKeyOf(new Date())}T00:00`)), []);
  const earliestRecordingDay = useMemo(() => subDays(today, RECORDING_RETENTION_DAYS - 1), [today]);
  const [day, setDay] = useState(today);
  const [dayPickerOpen, setDayPickerOpen] = useState(false);

  // Today's list keeps refreshing so new clips (and new hours) appear on
  // their own; past days don't change.
  const isToday = format(day, "yyyy-MM-dd") === workDayKeyOf(new Date());
  // A day here is a work day (08:00 to 08:00), so a night shift stays on one date.
  const dayWindow = useMemo(() => workDayWindow(format(day, "yyyy-MM-dd")), [day]);
  const { data: recordings, isLoading } = useScreenRecordings(
    {
      userId: row.user.id,
      from: dayWindow.start.toISOString(),
      to: dayWindow.end.toISOString(),
    },
    true,
    isToday ? 30_000 : false,
  );

  const { data: pings } = useActivityTimeline(
    row.user.id,
    dayWindow.start.toISOString(),
    dayWindow.end.toISOString(),
    isToday ? 30_000 : false,
  );

  const hours = useMemo(() => groupClipsByHour(recordings ?? [], pings ?? []), [recordings, pings]);
  // Bars are relative to the busiest clip of the day.
  const maxKeys = Math.max(1, ...hours.flatMap((h) => h.clips.map((c) => c.keystrokes)));
  const maxClicks = Math.max(1, ...hours.flatMap((h) => h.clips.map((c) => c.clicks)));
  const scrollToHour = (h: number) =>
    document
      .getElementById(`rec-hour-${h}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });

  const [viewing, setViewing] = useState<ScreenRecording | undefined>(undefined);

  const currentUser = useAuthStore((s) => s.user);
  // Mirrors the server: only Admin or HR may delete recordings.
  const canDelete = currentUser?.role.name === "ADMIN" || currentUser?.department?.name === "HR";
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  useEffect(() => setSelected(new Set()), [day]);
  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const selectedClips = (recordings ?? []).filter((r) => selected.has(r.id));

  // shortcut: one browser download per clip (Chrome asks once to allow multiple); zip server-side if people select dozens.
  const downloadSelected = async () => {
    setBusy(true);
    let failed = 0;
    for (const r of selectedClips) {
      try {
        await downloadScreenRecording(r.id, recordingFilename(r));
      } catch {
        failed++;
      }
    }
    setBusy(false);
    if (failed) toast.error(`${failed} of ${selectedClips.length} downloads failed`);
    else toast.success(`Downloading ${selectedClips.length} recording(s)`);
  };

  const deleteSelected = async () => {
    if (
      !window.confirm(
        `Permanently delete ${selectedClips.length} recording(s)? This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    let failed = 0;
    for (const r of selectedClips) {
      try {
        await deleteScreenRecording(r.id);
      } catch {
        failed++;
      }
    }
    setBusy(false);
    setSelected(new Set());
    await queryClient.invalidateQueries({ queryKey: ["screen-recordings"] });
    if (failed) toast.error(`${failed} of ${selectedClips.length} deletions failed`);
    else toast.success(`Deleted ${selectedClips.length} recording(s)`);
  };

  const dayIdle = idle
    .filter((e) => format(new Date(e.idleStartedAt), "yyyy-MM-dd") === format(day, "yyyy-MM-dd"))
    .reverse();
  const recordedHours = new Set(hours.map((h) => h.hour));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onBack}>
          <ArrowLeft className="size-4" /> All employees
        </Button>
        <PersonCell row={row} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi
          icon={Activity}
          label={`Active · ${PERIOD_LABEL[period]}`}
          value={`${row.activePercent}%`}
        />
        <Kpi
          icon={Clock}
          label="Active / idle"
          value={`${formatMinutes(row.activeMinutes)} / ${formatMinutes(row.idleMinutes)}`}
        />
        <Kpi icon={Keyboard} label="Keystrokes" value={formatCount(row.keystrokeCount)} />
        <Kpi icon={MousePointerClick} label="Mouse clicks" value={formatCount(row.clickCount)} />
        <Kpi icon={Video} label="Recorded" value={formatMinutes(row.recordedSeconds / 60)} />
      </div>

      <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-2">
          <Timer className="size-4 text-text-dim" />
          <span className="text-sm font-semibold">Idle reasons · {format(day, "EEE, MMM d")}</span>
        </div>
        {dayIdle.length === 0 ? (
          <p className="text-sm text-text-dim py-6 text-center">
            No idle stretches reported on {format(day, "EEE, MMM d")}.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-52">Idle</TableHead>
                <TableHead className="w-20">Length</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {dayIdle.map((e) => {
                const h = new Date(e.idleStartedAt).getHours();
                return (
                  <TableRow key={e.id}>
                    <TableCell className="tabular-nums text-text-dim">{idleSpan(e)}</TableCell>
                    <TableCell className="tabular-nums">{formatMinutes(e.idleMinutes)}</TableCell>
                    <TableCell>{e.reason}</TableCell>
                    <TableCell className="text-right">
                      {recordedHours.has(h) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5"
                          onClick={() => scrollToHour(h)}
                          title="Show this hour's recordings"
                        >
                          <Play className="size-3.5" /> Watch
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between gap-3 flex-wrap">
          <span className="text-sm font-semibold flex items-center gap-2">
            <Video className="size-4 text-text-dim" /> Screen recordings
          </span>
          {selected.size > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-text-dim tabular-nums">{selected.size} selected</span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                disabled={busy}
                onClick={downloadSelected}
              >
                <Download className="size-3.5" /> Download
              </Button>
              {canDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-destructive hover:text-destructive"
                  disabled={busy}
                  onClick={deleteSelected}
                >
                  <Trash2 className="size-3.5" /> Delete
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Clear selection"
                disabled={busy}
                onClick={() => setSelected(new Set())}
              >
                <X className="size-4" />
              </Button>
            </div>
          )}
          <Popover open={dayPickerOpen} onOpenChange={setDayPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 font-normal">
                <CalendarIcon className="size-3.5 text-text-dim" />
                {isSameDay(day, today) ? "Today" : format(day, "EEE, MMM d, yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={day}
                defaultMonth={day}
                onSelect={(d) => {
                  if (!d) return;
                  setDay(startOfDay(d));
                  setDayPickerOpen(false);
                }}
                disabled={{ before: earliestRecordingDay, after: today }}
                initialFocus
              />
              <p className="px-3 pb-1 text-[11px] text-text-dim">
                A day runs 8:00 AM to 8:00 AM, so night shifts stay on one date.
              </p>
              <p className="px-3 pb-3 text-[11px] text-text-dim">
                Recordings are kept {RECORDING_RETENTION_DAYS} days, back to{" "}
                {format(earliestRecordingDay, "MMM d, yyyy")}.
              </p>
            </PopoverContent>
          </Popover>
        </div>

        {isLoading && (
          <div className="p-4 space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}

        {!isLoading && hours.length === 0 && (
          <p className="text-sm text-text-dim py-10 text-center">
            No recordings on {format(day, "EEE, MMM d")}.
          </p>
        )}

        {!isLoading && hours.length > 0 && (
          <div className="max-h-[900px] overflow-y-auto bg-canvas/40">
            {hours.map((h) => (
              <div
                key={h.hour}
                id={`rec-hour-${h.hour}`}
                className="flex flex-col md:flex-row gap-3 md:gap-5 px-4 py-4 scroll-mt-2"
              >
                <div className="md:w-20 shrink-0">
                  <div className="text-lg font-semibold leading-tight">
                    {format(new Date(2000, 0, 1, h.hour), "h a")}
                  </div>
                  <div className="text-[11px] text-text-dim">{format(day, "MMM d, yyyy")}</div>
                </div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {h.clips.map((c) => (
                    <ClipCard
                      key={c.clip.id}
                      clip={c}
                      maxKeys={maxKeys}
                      maxClicks={maxClicks}
                      selected={selected.has(c.clip.id)}
                      onSelectedChange={(on) => toggle(c.clip.id, on)}
                      onPlay={() => setViewing(c.clip)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <RecordingViewerDialog
        recording={viewing}
        onOpenChange={(open) => !open && setViewing(undefined)}
      />
    </div>
  );
}
