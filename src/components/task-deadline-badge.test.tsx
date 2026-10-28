import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TaskDeadlineBadge } from "./task-deadline-badge";
import { useNow } from "@/hooks/use-now";
import { vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = new Date("2026-10-05T06:00:00Z");
const MIN = 60_000;
const HOUR = 60 * MIN;
const iso = (offset: number) => new Date(NOW.getTime() + offset).toISOString();

let container: HTMLDivElement;
let root: Root;

const text = () => container.textContent ?? "";
const render = (el: React.ReactElement) => act(() => root.render(el));

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("TaskDeadlineBadge", () => {
  it("says so when there is no deadline", () => {
    render(<TaskDeadlineBadge task={{ dueDate: null, status: "TODO" }} now={NOW} />);
    expect(text()).toBe("No deadline");
  });

  it("shows a red overdue flag with how late the task is", () => {
    render(<TaskDeadlineBadge task={{ dueDate: iso(-(2 * HOUR + 5 * MIN)), status: "IN_PROGRESS" }} now={NOW} />);
    expect(text()).toContain("Overdue by 2 h 5 min");
    expect(container.innerHTML).toContain("text-destructive");
  });

  it("shows an amber due-soon flag inside the last hour", () => {
    render(<TaskDeadlineBadge task={{ dueDate: iso(30 * MIN), status: "TODO" }} now={NOW} />);
    expect(text()).toContain("Due in 30 min");
    expect(container.innerHTML).toContain("text-amber-500");
  });

  it("shows just the date for a comfortable deadline (no flag)", () => {
    render(<TaskDeadlineBadge task={{ dueDate: iso(5 * HOUR), status: "TODO" }} now={NOW} />);
    expect(text()).not.toMatch(/Overdue|Due in/);
    expect(text()).toMatch(/Oct/);
  });

  it("shows Completed, never Overdue, for a finished task", () => {
    render(<TaskDeadlineBadge task={{ dueDate: iso(-10 * HOUR), status: "DONE" }} now={NOW} />);
    expect(text()).toContain("Completed");
    expect(text()).not.toContain("Overdue");
  });

  it("formats the due date in IST", () => {
    // 04:30Z is 10:00 IST.
    render(<TaskDeadlineBadge task={{ dueDate: "2026-10-05T04:30:00Z", status: "TODO" }} now={NOW} />);
    expect(text()).toMatch(/5 Oct.*10:00/i);
  });
});

describe("useNow", () => {
  function Clock() {
    return <span>{useNow(60_000).toISOString()}</span>;
  }

  it("advances on its interval so deadlines flip on screen without a reload", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    render(<Clock />);
    expect(text()).toBe("2026-10-05T06:00:00.000Z");

    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(text()).toBe("2026-10-05T06:01:00.000Z"); // the tick at 60s
  });

  it("a task crosses from due-soon to overdue as the clock ticks", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const due = iso(30_000); // 30s from now

    function Row() {
      const now = useNow(10_000);
      return <TaskDeadlineBadge task={{ dueDate: due, status: "TODO" }} now={now} />;
    }
    render(<Row />);
    expect(text()).toContain("Due in");

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(text()).toContain("Overdue by");
  });
});
