import { CalendarCheck, Flame, Loader2, Timer, TrendingUp, UserX } from "lucide-react";
import { useMyAttendanceSummary } from "@/hooks/use-work-session";
import { fmtDayKey, formatDuration } from "@/lib/attendance-view";
import type { MyDayState } from "@/lib/api/types";

const DAY_STYLE: Record<MyDayState, { label: string; className: string }> = {
  WORKED: { label: "Worked", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  ABSENT: { label: "Absent", className: "bg-red-500/15 text-red-500 border-red-500/30" },
  LEAVE: { label: "On leave", className: "bg-indigo-500/15 text-indigo-500 border-indigo-500/30" },
  HOLIDAY: { label: "Holiday", className: "bg-muted text-text-dim border-border-subtle" },
  WEEKEND: { label: "Day off", className: "bg-muted text-text-dim border-border-subtle" },
  PENDING: { label: "Not in yet", className: "border-dashed text-text-dim border-border-subtle" },
  NA: { label: "—", className: "text-text-dim/50 border-transparent" },
};

function Stat({
  icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "good" | "warn";
}) {
  const color = tone === "good" ? "text-emerald-500" : tone === "warn" ? "text-amber-500" : "text-primary";
  return (
    <div className="rounded-xl border border-border-subtle bg-panel p-4">
      <div className="flex items-center gap-2 text-xs text-text-dim">
        <span className={color}>{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-text-dim">{hint}</div>}
    </div>
  );
}

const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

/** The signed-in person's own attendance: this month, streaks, and the last two weeks. */
export function AttendanceMySummary() {
  const { data, isLoading, isError } = useMyAttendanceSummary();

  if (isLoading) {
    return (
      <div className="grid place-items-center rounded-xl border border-border-subtle bg-panel py-12 text-text-dim">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  if (isError || !data) {
    return <p className="rounded-xl border border-border-subtle bg-panel p-6 text-sm text-text-dim">Couldn't load your attendance.</p>;
  }

  const row = data.row;
  const monthName = new Date(`${data.from}T12:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={<Flame className="size-4" />}
          tone={data.onTimeStreak >= 3 ? "good" : "default"}
          label="On-time streak"
          value={days(data.onTimeStreak)}
          hint="working days in a row, no late arrival"
        />
        <Stat
          icon={<CalendarCheck className="size-4" />}
          tone={data.presentStreak >= 3 ? "good" : "default"}
          label="Attendance streak"
          value={days(data.presentStreak)}
          hint="working days in a row you clocked in"
        />
        <Stat
          icon={<TrendingUp className="size-4" />}
          label={`${monthName}: days worked`}
          value={row ? `${row.daysWorked} / ${row.expectedDays}` : "—"}
          hint={row?.daysOnLeave ? `${days(row.daysOnLeave)} on leave` : undefined}
        />
        <Stat
          icon={<Timer className="size-4" />}
          label="Average per day"
          value={row ? formatDuration(row.avgWorkedMin) : "—"}
          hint={`minimum ${formatDuration(data.minWorkMinutes)} a day`}
        />
      </div>

      {row && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            icon={<Timer className="size-4" />}
            tone={row.lateCount ? "warn" : "good"}
            label="Late arrivals"
            value={row.lateCount}
            hint={row.lateExcused ? `${row.lateExcused} excused` : undefined}
          />
          <Stat
            icon={<UserX className="size-4" />}
            tone={row.daysAbsent ? "warn" : "good"}
            label="Days absent"
            value={row.daysAbsent}
          />
          <Stat
            icon={<Timer className="size-4" />}
            tone={row.shortDays ? "warn" : "good"}
            label="Short days"
            value={row.shortDays}
            hint={row.shortDays ? `${formatDuration(row.shortfallMin)} under the minimum` : "all days met the minimum"}
          />
          <Stat
            icon={<TrendingUp className="size-4" />}
            label="Overtime"
            value={formatDuration(row.overtimeMin)}
            hint="beyond the minimum, plus days off worked"
          />
        </div>
      )}

      <div className="rounded-xl border border-border-subtle bg-panel p-4">
        <h3 className="mb-3 text-sm font-semibold">Last two weeks</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {data.recentDays.map((d) => {
            const style = DAY_STYLE[d.state];
            const late = d.lateByMin != null;
            return (
              <div
                key={d.date}
                title={`${fmtDayKey(d.date)} — ${style.label}${late ? `, ${formatDuration(d.lateByMin!)} late${d.lateExcused ? " (excused)" : ""}` : ""}`}
                className={`rounded-lg border px-2.5 py-2 text-xs ${style.className}`}
              >
                <div className="font-medium">{fmtDayKey(d.date).replace(/,? \d{4}$/, "")}</div>
                <div className="mt-0.5">
                  {d.state === "WORKED" ? formatDuration(d.workedMin) : style.label}
                </div>
                {late && (
                  <div className={`mt-0.5 ${d.lateExcused ? "text-text-dim line-through" : "text-amber-500"}`}>
                    Late {formatDuration(d.lateByMin!)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
