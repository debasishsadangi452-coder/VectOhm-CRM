// CSV export of the monthly attendance report -- what payroll / HR asks for.
import type { AttendanceReport, AttendanceReportRow, AttendanceReportTotals } from "./api/types";

/** Minutes as decimal hours to two places ("8.50"), the form spreadsheets and payroll want. */
export function hours(minutes: number): string {
  return (minutes / 60).toFixed(2);
}

/**
 * One CSV cell. Quotes anything with a comma, quote or newline. Also defuses
 * "formula injection": a spreadsheet treats a cell starting with = + - @ (or a
 * tab/CR) as a formula, and employee names are typed by users, so such cells get
 * a leading apostrophe and are shown as plain text.
 */
export function csvCell(value: string | number | null | undefined): string {
  let text = value == null ? "" : String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const REPORT_COLUMNS: Array<{ header: string; value: (r: AttendanceReportRow) => string | number }> = [
  { header: "Employee", value: (r) => r.name },
  { header: "Department", value: (r) => r.department ?? "" },
  { header: "Working days", value: (r) => r.expectedDays },
  { header: "Days worked", value: (r) => r.daysWorked },
  { header: "Days absent", value: (r) => r.daysAbsent },
  { header: "Days on leave", value: (r) => r.daysOnLeave },
  { header: "Late arrivals", value: (r) => r.lateCount },
  { header: "Late arrivals excused", value: (r) => r.lateExcused },
  { header: "Avg minutes late", value: (r) => r.avgLateMin },
  { header: "Early leaves", value: (r) => r.earlyCount },
  { header: "Early leaves excused", value: (r) => r.earlyExcused },
  { header: "Idle events", value: (r) => r.idleEvents },
  { header: "Idle hours", value: (r) => hours(r.idleMin) },
  { header: "Forgot to clock out", value: (r) => r.noClockOut },
  { header: "Total hours", value: (r) => hours(r.totalWorkedMin) },
  { header: "Avg hours per day worked", value: (r) => hours(r.avgWorkedMin) },
  { header: "Minimum hours per day", value: (r) => hours(r.minWorkMinutes) },
  { header: "Short days", value: (r) => r.shortDays },
  { header: "Shortfall hours", value: (r) => hours(r.shortfallMin) },
  { header: "Overtime hours", value: (r) => hours(r.overtimeMin) },
];

/** The totals line, laid out in the same columns as a person's row. */
export function totalsAsRow(t: AttendanceReportTotals): AttendanceReportRow {
  return {
    userId: "total",
    name: `Total (${t.people} ${t.people === 1 ? "person" : "people"})`,
    department: null,
    expectedDays: t.expectedDays,
    daysWorked: t.daysWorked,
    daysAbsent: t.daysAbsent,
    daysOnLeave: t.daysOnLeave,
    lateCount: t.lateCount,
    lateExcused: t.lateExcused,
    avgLateMin: t.avgLateMin,
    earlyCount: t.earlyCount,
    earlyExcused: t.earlyExcused,
    idleEvents: t.idleEvents,
    idleMin: t.idleMin,
    noClockOut: t.noClockOut,
    totalWorkedMin: t.totalWorkedMin,
    avgWorkedMin: t.avgWorkedMin,
    minWorkMinutes: 0,
    shortDays: t.shortDays,
    shortfallMin: t.shortfallMin,
    overtimeMin: t.overtimeMin,
  };
}

/** The whole report as CSV text: a period line, headers, one row per person, then totals. */
export function reportToCsv(report: AttendanceReport): string {
  const line = (cells: Array<string | number | null | undefined>) => cells.map(csvCell).join(",");
  const lines = [
    line([`Attendance report ${report.from} to ${report.to}`]),
    line(REPORT_COLUMNS.map((c) => c.header)),
    ...report.rows.map((r) => line(REPORT_COLUMNS.map((c) => c.value(r)))),
  ];
  if (report.rows.length > 0) {
    const total = totalsAsRow(report.totals);
    // The totals row has no single "minimum hours" figure, so that cell is left blank.
    lines.push(line(REPORT_COLUMNS.map((c) => (c.header === "Minimum hours per day" ? "" : c.value(total)))));
  }
  return lines.join("\r\n");
}

export function reportFilename(report: Pick<AttendanceReport, "from" | "to">): string {
  return `attendance-${report.from}_to_${report.to}.csv`;
}

/** Saves CSV text as a file. A UTF-8 byte-order mark makes Excel read accented names correctly. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
