import { describe, expect, it } from "vitest";
import { DUE_SOON_MS, formatSpan, getDeadlineInfo, isDueSoon, isOverdue } from "./task-deadline";

const NOW = new Date("2026-10-05T06:00:00Z"); // 11:30 IST
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;

describe("getDeadlineInfo", () => {
  it("has no state for a task without a deadline", () => {
    expect(getDeadlineInfo({ dueDate: null, status: "TODO" }, NOW)).toEqual({
      state: "none",
      dueAt: null,
      diffMs: 0,
      label: "",
    });
    expect(getDeadlineInfo({ status: "TODO" }, NOW).state).toBe("none");
  });

  it("treats an unparseable date as no deadline rather than crashing", () => {
    expect(getDeadlineInfo({ dueDate: "not-a-date", status: "TODO" }, NOW).state).toBe("none");
  });

  describe("overdue", () => {
    it("flags a passed deadline on an unfinished task and says by how much", () => {
      const info = getDeadlineInfo({ dueDate: at(-(2 * HOUR + 5 * MIN)), status: "IN_PROGRESS" }, NOW);
      expect(info.state).toBe("overdue");
      expect(info.label).toBe("Overdue by 2 h 5 min");
      expect(info.diffMs).toBeLessThan(0);
    });

    it("is overdue one millisecond after the deadline", () => {
      expect(getDeadlineInfo({ dueDate: at(-1), status: "TODO" }, NOW).state).toBe("overdue");
    });

    it("is NOT overdue exactly at the deadline", () => {
      expect(getDeadlineInfo({ dueDate: at(0), status: "TODO" }, NOW).state).toBe("due_soon");
    });

    it.each(["TODO", "IN_PROGRESS", "IN_REVIEW", "READY_FOR_TESTING", "CHANGES_REQUIRED"])(
      "applies to status %s",
      (status) => {
        expect(getDeadlineInfo({ dueDate: at(-HOUR), status }, NOW).state).toBe("overdue");
      },
    );

    it("never applies to a DONE task, however late", () => {
      const info = getDeadlineInfo({ dueDate: at(-30 * 24 * HOUR), status: "DONE" }, NOW);
      expect(info.state).toBe("done");
      expect(info.label).toBe("");
    });

    it("reads in days once it is more than a day late", () => {
      expect(getDeadlineInfo({ dueDate: at(-(3 * 24 + 4) * HOUR), status: "TODO" }, NOW).label).toBe(
        "Overdue by 3 d 4 h",
      );
    });
  });

  describe("due soon", () => {
    it("flags a deadline inside the next hour", () => {
      const info = getDeadlineInfo({ dueDate: at(45 * MIN), status: "TODO" }, NOW);
      expect(info.state).toBe("due_soon");
      expect(info.label).toBe("Due in 45 min");
    });

    it("includes exactly one hour out, excludes one millisecond past it", () => {
      expect(DUE_SOON_MS).toBe(HOUR);
      expect(getDeadlineInfo({ dueDate: at(HOUR), status: "TODO" }, NOW).state).toBe("due_soon");
      expect(getDeadlineInfo({ dueDate: at(HOUR + 1), status: "TODO" }, NOW).state).toBe("upcoming");
    });

    it("does not flag a DONE task", () => {
      expect(getDeadlineInfo({ dueDate: at(10 * MIN), status: "DONE" }, NOW).state).toBe("done");
    });
  });

  it("is merely upcoming with no label when the deadline is further out", () => {
    const info = getDeadlineInfo({ dueDate: at(3 * HOUR), status: "TODO" }, NOW);
    expect(info.state).toBe("upcoming");
    expect(info.label).toBe("");
    expect(info.dueAt).toEqual(new Date(at(3 * HOUR)));
  });

  it("uses the real clock when no time is given", () => {
    expect(getDeadlineInfo({ dueDate: new Date(Date.now() - HOUR).toISOString(), status: "TODO" }).state).toBe(
      "overdue",
    );
  });
});

describe("isOverdue / isDueSoon", () => {
  it("are thin wrappers over the state", () => {
    expect(isOverdue({ dueDate: at(-MIN), status: "TODO" }, NOW)).toBe(true);
    expect(isOverdue({ dueDate: at(MIN), status: "TODO" }, NOW)).toBe(false);
    expect(isDueSoon({ dueDate: at(MIN), status: "TODO" }, NOW)).toBe(true);
    expect(isDueSoon({ dueDate: at(-MIN), status: "TODO" }, NOW)).toBe(false);
    expect(isOverdue({ dueDate: at(-MIN), status: "DONE" }, NOW)).toBe(false);
  });
});

describe("formatSpan", () => {
  it.each([
    [0, "0 min"],
    [30_000, "1 min"], // rounds to the nearest minute
    [59 * MIN, "59 min"],
    [60 * MIN, "1 h"],
    [90 * MIN, "1 h 30 min"],
    [23 * HOUR + 59 * MIN, "23 h 59 min"],
    [24 * HOUR, "1 d"],
    [49 * HOUR, "2 d 1 h"],
    [-5 * MIN, "0 min"],
  ])("%d ms -> %s", (ms, expected) => {
    expect(formatSpan(ms)).toBe(expected);
  });
});
