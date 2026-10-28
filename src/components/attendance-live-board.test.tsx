import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveBoard, LivePerson, LiveStatus } from "@/lib/api/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  board: undefined as unknown,
  isLoading: false,
  refetch: vi.fn(),
  lastDepartmentArg: undefined as unknown,
}));

vi.mock("@/hooks/use-work-session", () => ({
  useLiveBoard: (departmentId?: string) => {
    mocks.lastDepartmentArg = departmentId;
    return { data: mocks.board, isLoading: mocks.isLoading, isFetching: false, refetch: mocks.refetch };
  },
}));
vi.mock("@/hooks/use-departments", () => ({
  useDepartments: () => ({ data: [{ id: "d1", name: "Recruitment" }] }),
}));

import { AttendanceLiveBoard, liveDetail } from "./attendance-live-board";

const person = (id: string, status: LiveStatus, over: Partial<LivePerson> = {}): LivePerson => ({
  userId: id,
  name: `${id[0].toUpperCase()}${id.slice(1)} Person`,
  department: "Recruitment",
  avatarUrl: null,
  status,
  since: "2026-10-07T04:35:00Z", // 10:05 IST
  lateByMin: null,
  idleMin: null,
  shiftStart: "10:00",
  shiftEnd: "19:00",
  markedAbsent: false,
  ...over,
});

const emptyCounts = (): Record<LiveStatus, number> => ({
  WORKING: 0, ON_BREAK: 0, IDLE: 0, NOT_IN: 0, NOT_YET: 0, CLOCKED_OUT: 0, ON_LEAVE: 0, OFF: 0,
});

const boardOf = (people: LivePerson[]): LiveBoard => {
  const counts = emptyCounts();
  for (const p of people) counts[p.status]++;
  return { generatedAt: "2026-10-07T06:00:00Z", counts, people };
};

let container: HTMLDivElement;
let root: Root;
const text = () => container.textContent ?? "";
const render = () => act(() => root.render(<AttendanceLiveBoard />));
const chip = (label: string) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>("button[aria-pressed]")).find((b) => b.textContent?.startsWith(label))!;

beforeEach(() => {
  mocks.isLoading = false;
  mocks.refetch.mockReset();
  mocks.board = boardOf([
    person("anil", "NOT_IN", { lateByMin: 90, since: "2026-10-07T04:30:00Z", markedAbsent: true }),
    person("bea", "IDLE", { idleMin: 14 }),
    person("cy", "WORKING", { lateByMin: 20 }),
    person("dee", "WORKING"),
    person("eve", "ON_BREAK", { since: "2026-10-07T05:30:00Z" }),
    person("fay", "ON_LEAVE"),
  ]);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("liveDetail — what is said beside each status", () => {
  it("working: when they clocked in, and how late", () => {
    expect(liveDetail(person("a", "WORKING"))).toMatch(/^Clocked in 10:05 am$/i);
    expect(liveDetail(person("a", "WORKING", { lateByMin: 25 }))).toMatch(/Clocked in .* · 25m late/);
  });
  it("on break, idle, not in, not yet, left, leave, day off", () => {
    expect(liveDetail(person("a", "ON_BREAK"))).toMatch(/^On break since/);
    expect(liveDetail(person("a", "IDLE", { idleMin: 14 }))).toBe("No keyboard or mouse for 14m (desktop app)");
    expect(liveDetail(person("a", "NOT_IN", { lateByMin: 90 }))).toBe("Shift started 10:00 · 1h 30m ago");
    expect(liveDetail(person("a", "NOT_IN", { lateByMin: 90, markedAbsent: true }))).toContain("marked absent");
    expect(liveDetail(person("a", "NOT_YET"))).toBe("Shift starts 10:00");
    expect(liveDetail(person("a", "CLOCKED_OUT"))).toMatch(/^Left at/);
    expect(liveDetail(person("a", "ON_LEAVE"))).toBe("Approved leave today");
    expect(liveDetail(person("a", "OFF"))).toBe("Not a working day");
  });
});

describe("AttendanceLiveBoard", () => {
  it("lists everyone, in the order the server sent (needing attention first)", () => {
    render();
    const names = Array.from(container.querySelectorAll("li .truncate.text-sm")).map((n) => n.textContent);
    expect(names).toEqual(["Anil Person", "Bea Person", "Cy Person", "Dee Person", "Eve Person", "Fay Person"]);
  });

  it("shows a count chip for each status that has people", () => {
    render();
    expect(chip("Not in").textContent).toContain("1");
    expect(chip("Idle").textContent).toContain("1");
    expect(chip("Working").textContent).toContain("2");
    expect(chip("On break").textContent).toContain("1");
    expect(chip("On leave").textContent).toContain("1");
    expect(container.textContent).not.toContain("Day off ·"); // nobody is off, so no chip
  });

  it("clicking a chip shows only those people; clicking again clears it", () => {
    render();
    act(() => chip("Working").click());
    expect(Array.from(container.querySelectorAll("li .truncate.text-sm")).map((n) => n.textContent)).toEqual(["Cy Person", "Dee Person"]);
    expect(chip("Working").getAttribute("aria-pressed")).toBe("true");

    act(() => chip("Working").click());
    expect(container.querySelectorAll("li")).toHaveLength(6);
  });

  it("spells out who is not in and who is idle", () => {
    render();
    expect(text()).toContain("Shift started 10:00 · 1h 30m ago · marked absent");
    expect(text()).toContain("No keyboard or mouse for 14m (desktop app)");
  });

  it("explains that idle comes from the desktop app", () => {
    render();
    expect(text()).toMatch(/only appears for people running it/);
  });

  it("refreshes on demand", () => {
    render();
    const refresh = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("Refresh"))!;
    act(() => refresh.click());
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });

  it("asks for all departments by default", () => {
    render();
    expect(mocks.lastDepartmentArg).toBeUndefined();
  });

  it("says so when nobody matches", () => {
    mocks.board = boardOf([]);
    render();
    expect(text()).toContain("Nobody matches");
  });

  it("shows a spinner while loading", () => {
    mocks.isLoading = true;
    mocks.board = undefined;
    render();
    expect(container.querySelector("svg.animate-spin")).not.toBeNull();
  });
});
