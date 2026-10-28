import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAttendanceReport } from "@/hooks/use-work-session";
import { useDepartments } from "@/hooks/use-departments";
import { downloadCsv, reportFilename, reportToCsv } from "@/lib/attendance-csv";
import {
  addMonths,
  ALL,
  currentMonthKey,
  formatDuration,
  monthLabel,
  monthRange,
  sortReportRows,
  type ReportSortKey,
} from "@/lib/attendance-view";

const COLUMNS: Array<{ key: ReportSortKey; label: string; numeric: boolean; title?: string }> = [
  { key: "name", label: "Employee", numeric: false },
  { key: "daysAbsent", label: "Absent", numeric: true, title: "Working days with no clock-in and no leave" },
  { key: "lateCount", label: "Late", numeric: true, title: "Late arrivals that still count (excused ones are in brackets)" },
  { key: "earlyCount", label: "Early", numeric: true, title: "Early leaves that still count (excused ones are in brackets)" },
  { key: "idleMin", label: "Idle", numeric: true, title: "Time with no keyboard or mouse input, past the idle-prompt setting" },
  { key: "totalWorkedMin", label: "Total", numeric: true, title: "Total hours worked, clock-in to clock-out" },
  { key: "avgWorkedMin", label: "Avg / day", numeric: true },
  { key: "shortDays", label: "Short days", numeric: true, title: "Finished working days under the daily minimum" },
  { key: "overtimeMin", label: "Overtime", numeric: true, title: "Beyond the daily minimum, plus time worked on days off" },
];

const nonZero = (n: number, className: string) => (n ? <span className={className}>{n}</span> : <span className="text-text-dim">—</span>);

/**
 * A month (or part of one) per employee: absences, late and early, idle time,
 * hours, short days and overtime -- with a CSV export for payroll / HR.
 */
export function AttendanceMonthlyReport() {
  const [month, setMonth] = useState(() => currentMonthKey());
  const [departmentId, setDepartmentId] = useState(ALL);
  const [sort, setSort] = useState<{ key: ReportSortKey; direction: "asc" | "desc" }>({ key: "name", direction: "asc" });

  const { from, to } = monthRange(month);
  const { data: departments } = useDepartments();
  const { data: report, isLoading } = useAttendanceReport({
    from,
    to,
    departmentId: departmentId === ALL ? undefined : departmentId,
  });

  const rows = useMemo(
    () => (report ? sortReportRows(report.rows, sort.key, sort.direction) : []),
    [report, sort],
  );
  const thisMonth = currentMonthKey();

  function sortBy(key: ReportSortKey) {
    setSort((s) =>
      s.key === key
        ? { key, direction: s.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "name" ? "asc" : "desc" },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="size-8" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </Button>
          <div className="min-w-[140px] text-center text-sm font-semibold">{monthLabel(month)}</div>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => setMonth(addMonths(month, 1))}
            disabled={month >= thisMonth}
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </Button>
          {month !== thisMonth && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setMonth(thisMonth)}>
              This month
            </Button>
          )}
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
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={!report || report.rows.length === 0}
            onClick={() => report && downloadCsv(reportFilename(report), reportToCsv(report))}
          >
            <Download className="size-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border-subtle bg-panel">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((c) => (
                <TableHead key={c.key} className={c.numeric ? "text-right" : undefined} title={c.title}>
                  <button type="button" onClick={() => sortBy(c.key)} className="inline-flex items-center gap-1 hover:text-foreground">
                    {c.label}
                    {sort.key === c.key && <span aria-hidden>{sort.direction === "asc" ? "▲" : "▼"}</span>}
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={COLUMNS.length} className="py-8 text-center text-text-dim">
                  <Loader2 className="mx-auto size-4 animate-spin" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMNS.length} className="py-8 text-center text-text-dim">
                  No attendance data for this month.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.userId}>
                <TableCell>
                  <div className="text-sm font-medium">{r.name}</div>
                  <div className="text-xs text-text-dim">
                    {r.department ?? "No department"} · {r.daysWorked}/{r.expectedDays} days
                    {r.daysOnLeave ? ` · ${r.daysOnLeave} on leave` : ""}
                    {r.noClockOut ? ` · ${r.noClockOut} forgot to clock out` : ""}
                  </div>
                </TableCell>
                <TableCell className="text-right text-sm">{nonZero(r.daysAbsent, "font-medium text-red-500")}</TableCell>
                <TableCell className="text-right text-sm">
                  {nonZero(r.lateCount, "font-medium text-amber-500")}
                  {r.lateExcused > 0 && <span className="ml-1 text-xs text-text-dim">({r.lateExcused} excused)</span>}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {nonZero(r.earlyCount, "font-medium text-rose-500")}
                  {r.earlyExcused > 0 && <span className="ml-1 text-xs text-text-dim">({r.earlyExcused} excused)</span>}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {r.idleMin ? <span className="font-medium text-sky-500">{formatDuration(r.idleMin)}</span> : <span className="text-text-dim">—</span>}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{formatDuration(r.totalWorkedMin)}</TableCell>
                <TableCell className="text-right font-mono text-sm">{r.daysWorked ? formatDuration(r.avgWorkedMin) : "—"}</TableCell>
                <TableCell className="text-right text-sm">
                  {r.shortDays ? (
                    <span className="font-medium text-orange-500" title={`${formatDuration(r.shortfallMin)} under the ${formatDuration(r.minWorkMinutes)} minimum`}>
                      {r.shortDays}
                    </span>
                  ) : (
                    <span className="text-text-dim">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {r.overtimeMin ? <span className="text-emerald-500">{formatDuration(r.overtimeMin)}</span> : <span className="text-text-dim">—</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {report && report.rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell className="text-sm font-semibold">
                  Total · {report.totals.people} {report.totals.people === 1 ? "person" : "people"}
                </TableCell>
                <TableCell className="text-right text-sm font-semibold">{report.totals.daysAbsent}</TableCell>
                <TableCell className="text-right text-sm font-semibold">{report.totals.lateCount}</TableCell>
                <TableCell className="text-right text-sm font-semibold">{report.totals.earlyCount}</TableCell>
                <TableCell className="text-right text-sm font-semibold">{formatDuration(report.totals.idleMin)}</TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold">{formatDuration(report.totals.totalWorkedMin)}</TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold">{formatDuration(report.totals.avgWorkedMin)}</TableCell>
                <TableCell className="text-right text-sm font-semibold">{report.totals.shortDays}</TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold">{formatDuration(report.totals.overtimeMin)}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      <p className="text-xs text-text-dim">
        Counts days up to today. Excused late arrivals and early leaves are not counted against anyone. Hours run from clock-in to clock-out
        (breaks included). A "short day" is a finished working day under the daily minimum; overtime is time beyond it, plus all time
        worked on weekends and holidays.
      </p>
    </div>
  );
}
