import { useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLiveBoard } from "@/hooks/use-work-session";
import { useDepartments } from "@/hooks/use-departments";
import { ALL, fmtTime, formatDuration } from "@/lib/attendance-view";
import { getInitials } from "@/lib/utils";
import type { LivePerson, LiveStatus } from "@/lib/api/types";

const STATUS: Record<LiveStatus, { label: string; chip: string; dot: string }> = {
  NOT_IN: { label: "Not in", chip: "border-red-500/40 bg-red-500/10 text-red-500", dot: "bg-red-500" },
  IDLE: { label: "Idle", chip: "border-sky-500/40 bg-sky-500/10 text-sky-500", dot: "bg-sky-500" },
  ON_BREAK: { label: "On break", chip: "border-amber-500/40 bg-amber-500/10 text-amber-500", dot: "bg-amber-500" },
  WORKING: { label: "Working", chip: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500", dot: "bg-emerald-500" },
  NOT_YET: { label: "Not due yet", chip: "border-border-subtle text-text-dim", dot: "bg-slate-400" },
  CLOCKED_OUT: { label: "Clocked out", chip: "border-border-subtle text-text-dim", dot: "bg-slate-400" },
  ON_LEAVE: { label: "On leave", chip: "border-indigo-500/40 bg-indigo-500/10 text-indigo-500", dot: "bg-indigo-500" },
  OFF: { label: "Day off", chip: "border-border-subtle text-text-dim", dot: "bg-slate-300" },
};

const ORDER: LiveStatus[] = ["NOT_IN", "IDLE", "ON_BREAK", "WORKING", "NOT_YET", "CLOCKED_OUT", "ON_LEAVE", "OFF"];

/** The one-line explanation shown beside a person's status. */
export function liveDetail(p: LivePerson): string {
  const since = p.since ? fmtTime(p.since) : null;
  switch (p.status) {
    case "WORKING":
      return `Clocked in ${since}${p.lateByMin != null ? ` · ${formatDuration(p.lateByMin)} late` : ""}`;
    case "ON_BREAK":
      return `On break since ${since}`;
    case "IDLE":
      return `No keyboard or mouse for ${formatDuration(p.idleMin ?? 0)} (desktop app)`;
    case "NOT_IN":
      return `Shift started ${p.shiftStart} · ${formatDuration(p.lateByMin ?? 0)} ago${p.markedAbsent ? " · marked absent" : ""}`;
    case "NOT_YET":
      return `Shift starts ${p.shiftStart}`;
    case "CLOCKED_OUT":
      return `Left at ${since}`;
    case "ON_LEAVE":
      return "Approved leave today";
    case "OFF":
      return "Not a working day";
  }
}

/** Who is working, on a break, idle, or not in -- right now. Refreshes itself every 30 seconds. */
export function AttendanceLiveBoard() {
  const [departmentId, setDepartmentId] = useState(ALL);
  const [only, setOnly] = useState<LiveStatus | null>(null);
  const { data: departments } = useDepartments();
  const { data, isLoading, isFetching, refetch } = useLiveBoard(departmentId === ALL ? undefined : departmentId);

  const people = useMemo(() => (data?.people ?? []).filter((p) => !only || p.status === only), [data, only]);

  if (isLoading) {
    return (
      <div className="grid place-items-center rounded-xl border border-border-subtle bg-panel py-12 text-text-dim">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  const counts = data?.counts;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {ORDER.filter((s) => (counts?.[s] ?? 0) > 0).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setOnly(only === s ? null : s)}
              aria-pressed={only === s}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${STATUS[s].chip} ${only === s ? "ring-2 ring-primary/40" : "opacity-90 hover:opacity-100"}`}
            >
              {STATUS[s].label} · {counts![s]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All departments</SelectItem>
              {(departments ?? []).map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border-subtle bg-panel">
        {people.length === 0 ? (
          <p className="py-10 text-center text-sm text-text-dim">Nobody matches.</p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {people.map((p) => (
              <li key={p.userId} className="flex items-center gap-3 px-4 py-2.5">
                <span className={`size-2 shrink-0 rounded-full ${STATUS[p.status].dot}`} aria-hidden />
                <Avatar className="size-7">
                  <AvatarFallback className="text-[10px]">{getInitials({ firstName: p.name.split(" ")[0], lastName: p.name.split(" ").slice(1).join(" ") })}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="truncate text-xs text-text-dim">
                    {p.department ? `${p.department} · ` : ""}
                    {liveDetail(p)}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS[p.status].chip}`}>
                  {STATUS[p.status].label}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-text-dim">
        {data ? `Updated ${fmtTime(data.generatedAt)} · refreshes every 30 seconds. ` : ""}
        "Idle" comes from the desktop app's keyboard and mouse timer, so it only appears for people running it.
      </p>
    </div>
  );
}
