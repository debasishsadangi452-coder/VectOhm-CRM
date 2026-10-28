import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AttendanceReport, AttendanceReportRow } from "@/lib/api/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  report: undefined as unknown,
  isLoading: false,
  lastOpts: undefined as unknown,
  download: vi.fn(),
}));

vi.mock("@/hooks/use-work-session", () => ({
  useAttendanceReport: (opts: unknown) => {
    mocks.lastOpts = opts;
    return { data: mocks.report, isLoading: mocks.isLoading };
  },
}));
vi.mock("@/hooks/use-departments", () => ({ useDepartments: () => ({ data: [{ id: "d1", name: "Recruitment" }] }) }));
vi.mock("@/lib/attendance-csv", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/attendance-csv")>()),
  downloadCsv: (...a: unknown[]) => mocks.download(...a),
}));

import { AttendanceMonthlyReport } from "./attendance-monthly-report";
import { currentMonthKey } from "@/lib/attendance-view";

const row = (id: string, over: Partial<AttendanceReportRow> = {}): AttendanceReportRow => ({
  userId: id, name: `${id} Person`, department: "Recruitment",
  expectedDays: 20, daysWorked: 18, daysAbsent: 0, daysOnLeave: 0,
  lateCount: 0, lateExcused: 0, avgLateMin: 0, earlyCount: 0, earlyExcused: 0,
  idleEvents: 0, idleMin: 0, noClockOut: 0,
  totalWorkedMin: 9000, avgWorkedMin: 500, minWorkMinutes: 510,
  shortDays: 0, shortfallMin: 0, overtimeMin: 0, ...over,
});

const reportOf = (rows: AttendanceReportRow[]): AttendanceReport => ({
  from: "2026-10-01",
  to: "2026-10-31",
  rows,
  totals: {
    people: rows.length, expectedDays: 40, daysWorked: 36, daysAbsent: 3, daysOnLeave: 0, lateCount: 5, lateExcused: 1,
    avgLateMin: 20, earlyCount: 1, earlyExcused: 0, idleEvents: 2, idleMin: 90, noClockOut: 0,
    totalWorkedMin: 18000, avgWorkedMin: 500, shortDays: 2, shortfallMin: 60, overtimeMin: 120,
  },
});

let container: HTMLDivElement;
let root: Root;
const text = () => container.textContent ?? "";
const render = () => act(() => root.render(<AttendanceMonthlyReport />));
const button = (label: string) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent?.trim().startsWith(label) || b.getAttribute("aria-label") === label)!;
const names = () => Array.from(container.querySelectorAll("tbody tr td:first-child .text-sm")).map((n) => n.textContent);

beforeEach(() => {
  mocks.report = reportOf([
    row("Bea", { lateCount: 2, daysAbsent: 1, overtimeMin: 30 }),
    row("Al", { lateCount: 5, lateExcused: 2, shortDays: 1, shortfallMin: 90 }),
    row("Cy", { lateCount: 1, noClockOut: 2, daysOnLeave: 3 }),
  ]);
  mocks.isLoading = false;
  mocks.download.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("AttendanceMonthlyReport", () => {
  it("asks for the current month, up to the last day of it", () => {
    render();
    const month = currentMonthKey();
    expect(mocks.lastOpts).toMatchObject({ from: `${month}-01` });
    expect((mocks.lastOpts as { to: string }).to.startsWith(month)).toBe(true);
  });

  it("lists one row per person, sorted by name to begin with", () => {
    render();
    expect(names()).toEqual(["Al Person", "Bea Person", "Cy Person"]);
  });

  it("clicking a column sorts by it (highest first), and again reverses it", () => {
    render();
    const late = Array.from(container.querySelectorAll<HTMLButtonElement>("thead button")).find((b) => b.textContent?.startsWith("Late"))!;
    act(() => late.click());
    expect(names()).toEqual(["Al Person", "Bea Person", "Cy Person"]); // 5, 2, 1
    act(() => late.click());
    expect(names()).toEqual(["Cy Person", "Bea Person", "Al Person"]); // 1, 2, 5
  });

  it("shows excused late arrivals beside the count, and the person's extra detail", () => {
    render();
    expect(text()).toContain("(2 excused)");
    expect(text()).toContain("2 forgot to clock out");
    expect(text()).toContain("3 on leave");
    expect(text()).toContain("18/20 days");
  });

  it("has a totals row", () => {
    render();
    expect(text()).toContain("Total · 3 people");
  });

  it("explains how the numbers are worked out", () => {
    render();
    expect(text()).toMatch(/Excused late arrivals and early leaves are not counted/);
  });

  describe("export", () => {
    it("downloads the report as CSV, named after the period", () => {
      render();
      act(() => button("Export CSV").click());
      expect(mocks.download).toHaveBeenCalledTimes(1);
      const [filename, csv] = mocks.download.mock.calls[0];
      expect(filename).toBe("attendance-2026-10-01_to_2026-10-31.csv");
      expect(csv).toContain("Attendance report 2026-10-01 to 2026-10-31");
      expect(csv).toContain("Al Person");
      expect(csv).toContain("Total (3 people)");
    });

    it("is disabled with nothing to export", () => {
      mocks.report = reportOf([]);
      render();
      expect(button("Export CSV").disabled).toBe(true);
      expect(text()).toContain("No attendance data for this month");
    });
  });

  describe("month navigation", () => {
    it("steps back a month, and can't go past the current one", () => {
      render();
      expect(button("Next month").disabled).toBe(true);
      const before = (mocks.lastOpts as { from: string }).from;
      act(() => button("Previous month").click());
      const after = (mocks.lastOpts as { from: string }).from;
      expect(after < before).toBe(true);
      expect(button("Next month").disabled).toBe(false);
      expect(text()).toContain("This month");
    });

    it("'This month' jumps back", () => {
      render();
      const start = (mocks.lastOpts as { from: string }).from;
      act(() => button("Previous month").click());
      act(() => button("This month").click());
      expect((mocks.lastOpts as { from: string }).from).toBe(start);
    });
  });

  it("shows a spinner while loading", () => {
    mocks.isLoading = true;
    mocks.report = undefined;
    render();
    expect(container.querySelector("svg.animate-spin")).not.toBeNull();
  });
});
