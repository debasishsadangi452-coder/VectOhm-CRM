import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AttendanceReportRow, MyAttendanceSummary } from "@/lib/api/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  data: undefined as unknown,
  isLoading: false,
  isError: false,
}));

vi.mock("@/hooks/use-work-session", () => ({
  useMyAttendanceSummary: () => ({ data: mocks.data, isLoading: mocks.isLoading, isError: mocks.isError }),
}));

import { AttendanceMySummary } from "./attendance-my-summary";

const row = (over: Partial<AttendanceReportRow> = {}): AttendanceReportRow => ({
  userId: "e1", name: "Eve", department: "Recruitment",
  expectedDays: 5, daysWorked: 4, daysAbsent: 0, daysOnLeave: 1,
  lateCount: 1, lateExcused: 1, avgLateMin: 20, earlyCount: 0, earlyExcused: 0,
  idleEvents: 0, idleMin: 0, noClockOut: 0,
  totalWorkedMin: 2100, avgWorkedMin: 525, minWorkMinutes: 510,
  shortDays: 0, shortfallMin: 0, overtimeMin: 60, ...over,
});

const summary = (over: Partial<MyAttendanceSummary> = {}): MyAttendanceSummary => ({
  from: "2026-10-01",
  to: "2026-10-07",
  minWorkMinutes: 510,
  row: row(),
  presentStreak: 6,
  onTimeStreak: 4,
  recentDays: [
    { date: "2026-10-07", state: "PENDING", workedMin: 0, lateByMin: null, lateExcused: false },
    { date: "2026-10-06", state: "WORKED", workedMin: 540, lateByMin: 25, lateExcused: false },
    { date: "2026-10-05", state: "WORKED", workedMin: 520, lateByMin: 15, lateExcused: true },
    { date: "2026-10-04", state: "WEEKEND", workedMin: 0, lateByMin: null, lateExcused: false },
    { date: "2026-10-02", state: "LEAVE", workedMin: 0, lateByMin: null, lateExcused: false },
    { date: "2026-10-01", state: "ABSENT", workedMin: 0, lateByMin: null, lateExcused: false },
  ],
  ...over,
});

let container: HTMLDivElement;
let root: Root;
const text = () => container.textContent ?? "";
const render = () => act(() => root.render(<AttendanceMySummary />));

beforeEach(() => {
  mocks.data = summary();
  mocks.isLoading = false;
  mocks.isError = false;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("AttendanceMySummary", () => {
  it("shows both streaks", () => {
    render();
    expect(text()).toContain("On-time streak");
    expect(text()).toContain("4 days");
    expect(text()).toContain("Attendance streak");
    expect(text()).toContain("6 days");
  });

  it("uses the singular for a streak of one day", () => {
    mocks.data = summary({ onTimeStreak: 1 });
    render();
    expect(text()).toContain("1 day");
    expect(text()).not.toContain("1 days");
  });

  it("shows this month's figures", () => {
    render();
    expect(text()).toContain("October 2026: days worked");
    expect(text()).toContain("4 / 5");
    expect(text()).toContain("1 day on leave");
    expect(text()).toContain("minimum 8h 30m a day");
    expect(text()).toContain("8h 45m"); // average per day
  });

  it("counts late arrivals net of excused ones, and says how many were excused", () => {
    render();
    expect(text()).toContain("Late arrivals");
    expect(text()).toContain("1 excused");
  });

  it("flags short days with how far under the minimum, or praises a clean month", () => {
    mocks.data = summary({ row: row({ shortDays: 2, shortfallMin: 90 }) });
    render();
    expect(text()).toContain("1h 30m under the minimum");
    mocks.data = summary({ row: row({ shortDays: 0 }) });
    render();
    expect(text()).toContain("all days met the minimum");
  });

  it("shows overtime", () => {
    render();
    expect(text()).toContain("Overtime");
    expect(text()).toContain("1h");
  });

  describe("the last two weeks", () => {
    it("shows each day's state", () => {
      render();
      expect(text()).toContain("Not in yet"); // today
      expect(text()).toContain("Day off");
      expect(text()).toContain("On leave");
      expect(text()).toContain("Absent");
      expect(text()).toContain("9h"); // a worked day shows its hours
    });

    it("shows how late, and strikes through an excused late arrival", () => {
      render();
      const late = Array.from(container.querySelectorAll("div")).filter((d) => d.textContent === "Late 25m");
      expect(late.length).toBeGreaterThan(0);
      const excused = Array.from(container.querySelectorAll("div")).find((d) => d.textContent === "Late 15m")!;
      expect(excused.className).toContain("line-through");
    });

    it("hovering explains a day in words", () => {
      render();
      const titles = Array.from(container.querySelectorAll("[title]")).map((e) => e.getAttribute("title"));
      expect(titles.some((t) => t?.includes("25m late"))).toBe(true);
      expect(titles.some((t) => t?.includes("(excused)"))).toBe(true);
    });
  });

  it("copes with no figures yet (e.g. a new account)", () => {
    mocks.data = summary({ row: undefined });
    render();
    expect(text()).toContain("—");
    expect(text()).toContain("Last two weeks");
  });

  it("shows a spinner while loading, and a message if it fails", () => {
    mocks.isLoading = true;
    mocks.data = undefined;
    render();
    expect(container.querySelector("svg.animate-spin")).not.toBeNull();

    mocks.isLoading = false;
    mocks.isError = true;
    render();
    expect(text()).toContain("Couldn't load your attendance");
  });
});
