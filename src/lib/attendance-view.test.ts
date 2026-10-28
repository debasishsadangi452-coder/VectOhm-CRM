import { describe, expect, it } from "vitest";
import type { AttendanceCalendar, DayStatus, WorkSession } from "./api/types";
import {
  ALL,
  awaitingCorrection,
  earlyCounts,
  earlyNeedsReview,
  lateCounts,
  lateNeedsReview,
  needsReview,
  reviewLabel,
  addMonths,
  buildDailySummary,
  buildReportRows,
  currentMonthKey,
  monthLabel,
  monthRange,
  sortReportRows,
  computeStats,
  dayKeyOf,
  filterDayStatuses,
  filterSessions,
  fmtDayKey,
  formatDuration,
  isoDay,
  leaveLabel,
  mergeSessionRows,
} from "./attendance-view";

const person = (id: string) => ({ id, firstName: id.toUpperCase(), lastName: "Person" });

function session(over: Partial<WorkSession> = {}): WorkSession {
  return {
    id: "s1",
    userId: "e1",
    user: person("e1"),
    clockInAt: "2026-10-05T04:30:00Z", // 10:00 IST Monday
    clockOutAt: "2026-10-05T13:30:00Z", // 19:00 IST
    durationMin: 540,
    date: "2026-10-05T00:00:00Z",
    createdAt: "2026-10-05T04:30:00Z",
    updatedAt: "2026-10-05T13:30:00Z",
    ...over,
  } as WorkSession;
}

const day = (userId: string, date: string, status: DayStatus["status"], note?: string): DayStatus => ({
  userId,
  user: person(userId),
  date,
  status,
  note,
});

const calendar: AttendanceCalendar = {
  weeklyOffDays: [0, 6],
  holidays: [{ id: "h1", date: "2026-10-08", name: "Dussehra" }],
};

const ANY = { employeeId: ALL, status: "all" as const };

describe("formatting", () => {
  it("formatDuration", () => {
    expect(formatDuration(0)).toBe("0m");
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(120)).toBe("2h");
    expect(formatDuration(125)).toBe("2h 5m");
  });

  it("dayKeyOf is the company-timezone day", () => {
    expect(dayKeyOf("2026-10-05T04:30:00Z")).toBe("2026-10-05");
    expect(dayKeyOf("2026-10-05T19:00:00Z")).toBe("2026-10-06"); // 00:30 IST next day
  });

  it("isoDay offsets from a base day", () => {
    expect(isoDay(0, new Date("2026-10-05T06:00:00Z"))).toBe("2026-10-05");
    expect(isoDay(-6, new Date("2026-10-05T06:00:00Z"))).toBe("2026-09-29");
  });

  it("fmtDayKey shows a calendar day in IST without drifting a day", () => {
    // (Some ICU versions put a comma before the year, some don't.)
    expect(fmtDayKey("2026-10-05")).toMatch(/Mon.*5 Oct,? 2026/);
    expect(fmtDayKey("2026-10-05", false)).toMatch(/^5 Oct,? 2026$/);
  });

  it("leaveLabel names the leave type, with a safe fallback", () => {
    expect(leaveLabel("SICK")).toBe("Sick leave");
    expect(leaveLabel("MATERNITY_PATERNITY")).toBe("Parental leave");
    expect(leaveLabel("WHATEVER")).toBe("On leave");
    expect(leaveLabel(undefined)).toBe("On leave");
  });
});

describe("filterSessions", () => {
  const sessions = [
    session({ id: "plain" }),
    session({ id: "late", lateByMin: 20 }),
    session({ id: "early", earlyByMin: 30 }),
    session({ id: "idle", idleEvents: [{ id: "i1", idleMinutes: 40 } as never] }),
    session({ id: "auto", autoClosed: true }),
    session({ id: "active", clockOutAt: null }),
    session({ id: "other-user", userId: "e2", lateByMin: 5 }),
  ];
  const ids = (status: Parameters<typeof filterSessions>[1]["status"], employeeId = ALL) =>
    filterSessions(sessions, { employeeId, status }).map((s) => s.id);

  it("all shows everything", () => expect(ids("all")).toHaveLength(7));
  it("late / early / idle / active", () => {
    expect(ids("late")).toEqual(["late", "other-user"]);
    expect(ids("early")).toEqual(["early"]);
    expect(ids("idle")).toEqual(["idle"]);
    expect(ids("active")).toEqual(["active"]);
  });
  it("flagged includes late, early, idle AND forgotten clock-outs", () => {
    expect(ids("flagged")).toEqual(["late", "early", "idle", "auto", "other-user"]);
  });
  it("the absent filter is about days without a session, so it shows no sessions", () => {
    expect(ids("absent")).toEqual([]);
  });
  it("narrows to one employee", () => {
    expect(ids("late", "e2")).toEqual(["other-user"]);
  });
});

describe("filterDayStatuses", () => {
  const rows = [day("e1", "2026-10-05", "ABSENT"), day("e1", "2026-10-06", "LEAVE", "SICK"), day("e2", "2026-10-05", "ABSENT")];
  const run = (status: Parameters<typeof filterSessions>[1]["status"], employeeId = ALL) =>
    filterDayStatuses(rows, { employeeId, status });

  it("all and absent show absent AND on-leave days (so 'On leave' isn't a blank)", () => {
    expect(run("all")).toHaveLength(3);
    expect(run("absent")).toHaveLength(3);
  });
  it("flagged shows only absences -- being on approved leave isn't a problem", () => {
    expect(run("flagged").map((r) => r.status)).toEqual(["ABSENT", "ABSENT"]);
  });
  it.each(["late", "early", "idle", "active"] as const)("%s shows no day rows", (status) => {
    expect(run(status)).toEqual([]);
  });
  it("narrows to one employee", () => {
    expect(run("all", "e2")).toHaveLength(1);
  });
});

describe("computeStats", () => {
  const sessions = [
    session({ id: "a", lateByMin: 20 }),
    session({ id: "b", lateByMin: 40, earlyByMin: 15, idleEvents: [{ id: "i", idleMinutes: 35 } as never] }),
    session({ id: "c", autoClosed: true }),
    session({ id: "d", userId: "e2", lateByMin: 60 }),
  ];
  const days = [
    day("e1", "2026-10-05", "ABSENT"),
    day("e1", "2026-10-06", "LEAVE", "SICK"),
    day("e1", "2026-10-07", "LEAVE", "SICK"),
    day("e2", "2026-10-05", "ABSENT"),
  ];

  it("counts everything across all employees", () => {
    expect(computeStats(sessions, days, ALL)).toEqual({
      total: 4,
      late: 3,
      avgLate: 40,
      early: 1,
      idleEvents: 1,
      idleMin: 35,
      absent: 2,
      onLeave: 2,
      noClockOut: 1,
      lateExcused: 0,
      earlyExcused: 0,
      toReview: 0,
    });
  });

  it("scopes sessions and days to one employee", () => {
    const stats = computeStats(sessions, days, "e1");
    expect(stats).toMatchObject({ total: 3, late: 2, avgLate: 30, absent: 1, onLeave: 2 });
  });

  it("is all zeros with no data (and avgLate doesn't divide by zero)", () => {
    expect(computeStats([], [], ALL)).toEqual({
      total: 0, late: 0, avgLate: 0, early: 0, idleEvents: 0, idleMin: 0, absent: 0, onLeave: 0, noClockOut: 0,
      lateExcused: 0, earlyExcused: 0, toReview: 0,
    });
  });
});

describe("mergeSessionRows", () => {
  it("interleaves sessions with absent/on-leave days, newest first", () => {
    const rows = mergeSessionRows(
      [session({ id: "mon", clockInAt: "2026-10-05T04:30:00Z" }), session({ id: "wed", clockInAt: "2026-10-07T04:30:00Z" })],
      [day("e1", "2026-10-06", "LEAVE", "SICK")],
    );
    expect(rows.map((r) => (r.kind === "session" ? r.session.id : r.day.date))).toEqual(["wed", "2026-10-06", "mon"]);
  });
});

describe("buildReportRows", () => {
  const rowsFor = (status: Parameters<typeof buildReportRows>[2], sessions: WorkSession[], days: DayStatus[] = []) =>
    buildReportRows(sessions, days, status);

  it("describes a late arrival with the reason given, or null while none", () => {
    const [row] = rowsFor("all", [session({ lateByMin: 25, lateReason: "Traffic" })]);
    expect(row).toMatchObject({ kind: "late", reason: "Traffic" });
    expect(row.detail).toContain("25m late");
    expect(rowsFor("all", [session({ lateByMin: 25 })])[0].reason).toBeNull();
  });

  it("includes absences (no session, no reason) as their own rows", () => {
    const rows = rowsFor("all", [], [day("e1", "2026-10-05", "ABSENT"), day("e1", "2026-10-06", "LEAVE", "SICK")]);
    expect(rows).toHaveLength(1); // leave is not a problem, so it is not a report row
    expect(rows[0]).toMatchObject({ kind: "absent", userId: "e1", detail: "Did not clock in", reason: null });
    expect(rows[0].session).toBeUndefined();
  });

  it("flags a forgotten clock-out as awaiting correction until the employee answers", () => {
    const [row] = rowsFor("all", [session({ autoClosed: true })]);
    expect(row).toMatchObject({ kind: "noclockout", reason: null });
    expect(row.detail).toContain("closed automatically at 7:00 pm");
  });

  it("shows the employee's correction and note once submitted", () => {
    const [row] = rowsFor("all", [
      session({
        autoClosed: true,
        correctionSubmittedAt: "2026-10-06T04:00:00Z",
        correctedClockOutAt: "2026-10-05T12:00:00Z", // 17:30 IST
        correctionNote: "Left at 5:30, forgot to clock out",
      }),
    ]);
    expect(row.detail).toContain("employee corrected it to 5:30 pm");
    expect(row.reason).toBe("Left at 5:30, forgot to clock out");
  });

  it("each filter shows only its own kind", () => {
    const s = session({ lateByMin: 20, earlyByMin: 10, autoClosed: true, idleEvents: [{ id: "i", idleStartedAt: "2026-10-05T06:00:00Z", idleMinutes: 35, reason: "Call" } as never] });
    const d = [day("e1", "2026-10-06", "ABSENT")];
    const kinds = (f: Parameters<typeof buildReportRows>[2]) => buildReportRows([s], d, f).map((r) => r.kind).sort();
    expect(kinds("all")).toEqual(["absent", "early", "idle", "late", "noclockout"]);
    expect(kinds("late")).toEqual(["late"]);
    expect(kinds("early")).toEqual(["early"]);
    expect(kinds("idle")).toEqual(["idle"]);
    expect(kinds("absent")).toEqual(["absent"]);
  });

  it("is sorted newest first across kinds", () => {
    const rows = buildReportRows(
      [session({ id: "mon", lateByMin: 20, clockInAt: "2026-10-05T04:30:00Z" })],
      [day("e1", "2026-10-07", "ABSENT")],
      "all",
    );
    expect(rows.map((r) => r.kind)).toEqual(["absent", "late"]);
  });
});

describe("awaitingCorrection", () => {
  it("is true only for an auto-closed session not yet corrected", () => {
    expect(awaitingCorrection(session({ autoClosed: true }))).toBe(true);
    expect(awaitingCorrection(session({ autoClosed: true, correctionSubmittedAt: "2026-10-06T00:00:00Z" }))).toBe(false);
    expect(awaitingCorrection(session())).toBe(false);
  });
});

describe("buildDailySummary", () => {
  it("counts sessions, hours, lates, idle, absences and leave per day", () => {
    const rows = buildDailySummary(
      [
        session({ id: "a", durationMin: 480, lateByMin: 15 }),
        session({ id: "b", userId: "e2", user: person("e2"), durationMin: 300, idleEvents: [{ id: "i" } as never, { id: "j" } as never] }),
      ],
      [day("e3", "2026-10-05", "ABSENT"), day("e4", "2026-10-05", "LEAVE", "SICK")],
      calendar,
    );
    expect(rows.find((r) => r.key === "2026-10-05")).toMatchObject({
      sessions: 2, totalMin: 780, late: 1, idle: 2, absent: 1, onLeave: 1, note: null,
    });
  });

  it("explains days off: holidays by name (even with no activity) and weekends", () => {
    const rows = buildDailySummary(
      [session({ clockInAt: "2026-10-04T05:00:00Z" })], // someone worked on a Sunday
      [],
      calendar,
    );
    expect(rows.find((r) => r.key === "2026-10-08")).toMatchObject({ note: "Holiday: Dussehra", sessions: 0 });
    expect(rows.find((r) => r.key === "2026-10-04")).toMatchObject({ note: "Weekend", sessions: 1 });
  });

  it("is newest first, and copes with no calendar loaded yet", () => {
    const rows = buildDailySummary(
      [session({ clockInAt: "2026-10-05T04:30:00Z" }), session({ id: "s2", clockInAt: "2026-10-07T04:30:00Z" })],
      [],
    );
    expect(rows.map((r) => r.key)).toEqual(["2026-10-07", "2026-10-05"]);
    expect(rows.every((r) => r.note === null)).toBe(true);
  });
});

describe("HR review of reasons", () => {
  it("an EXCUSED late arrival or early leave stops counting; a REJECTED or unreviewed one still does", () => {
    expect(lateCounts(session({ lateByMin: 20 }))).toBe(true);
    expect(lateCounts(session({ lateByMin: 20, lateReviewStatus: "REJECTED" }))).toBe(true);
    expect(lateCounts(session({ lateByMin: 20, lateReviewStatus: "EXCUSED" }))).toBe(false);
    expect(lateCounts(session())).toBe(false); // not late at all
    expect(earlyCounts(session({ earlyByMin: 10, earlyReviewStatus: "EXCUSED" }))).toBe(false);
    expect(earlyCounts(session({ earlyByMin: 10 }))).toBe(true);
  });

  it("needs review = a reason was given and nobody has decided yet", () => {
    expect(lateNeedsReview(session({ lateByMin: 20, lateReason: "Traffic" }))).toBe(true);
    expect(lateNeedsReview(session({ lateByMin: 20 }))).toBe(false); // no reason given yet
    expect(lateNeedsReview(session({ lateByMin: 20, lateReason: "Traffic", lateReviewStatus: "EXCUSED" }))).toBe(false);
    expect(earlyNeedsReview(session({ earlyByMin: 10, earlyReason: "Doctor" }))).toBe(true);
    expect(needsReview(session({ earlyByMin: 10, earlyReason: "Doctor" }))).toBe(true);
    expect(needsReview(session())).toBe(false);
  });

  it("labels decisions in plain words", () => {
    expect(reviewLabel("EXCUSED")).toBe("Excused");
    expect(reviewLabel("REJECTED")).toBe("Not accepted");
    expect(reviewLabel(null)).toBeNull();
    expect(reviewLabel(undefined)).toBeNull();
  });

  describe("in the numbers", () => {
    const sessions = [
      session({ id: "a", lateByMin: 20, lateReason: "Traffic" }),
      session({ id: "b", lateByMin: 40, lateReason: "Bus strike", lateReviewStatus: "EXCUSED" }),
      session({ id: "c", earlyByMin: 15, earlyReason: "Doctor", earlyReviewStatus: "EXCUSED" }),
      session({ id: "d", earlyByMin: 25, earlyReason: "Errand" }),
    ];

    it("excused ones are left out of the counts and averages, and counted separately", () => {
      expect(computeStats(sessions, [], ALL)).toMatchObject({
        late: 1,
        avgLate: 20,
        early: 1,
        lateExcused: 1,
        earlyExcused: 1,
        toReview: 2, // "a" and "d" still need a decision
      });
    });

    it("the daily summary doesn't count an excused late arrival", () => {
      const rows = buildDailySummary(sessions, [], calendar);
      expect(rows.find((r) => r.key === "2026-10-05")!.late).toBe(1);
    });
  });

  describe("the 'Needs review' filter", () => {
    const sessions = [
      session({ id: "todo", lateByMin: 20, lateReason: "Traffic" }),
      session({ id: "done", lateByMin: 20, lateReason: "Traffic", lateReviewStatus: "REJECTED" }),
      session({ id: "noreason", lateByMin: 20 }),
      session({ id: "plain" }),
    ];

    it("keeps only sessions with an unreviewed reason", () => {
      expect(filterSessions(sessions, { employeeId: ALL, status: "review" }).map((s) => s.id)).toEqual(["todo"]);
    });

    it("shows no absent/leave day rows", () => {
      expect(filterDayStatuses([day("e1", "2026-10-05", "ABSENT")], { employeeId: ALL, status: "review" })).toEqual([]);
    });

    it("the report lists only the reasons still waiting for a decision, with the decision for others", () => {
      const rows = buildReportRows(sessions, [], "review");
      expect(rows.map((r) => r.key)).toEqual(["todo-late"]);
      expect(rows[0].review).toEqual({ status: null, note: null });
    });

    it("the normal report shows each decision and its note", () => {
      const rows = buildReportRows(
        [session({ id: "x", lateByMin: 20, lateReason: "Traffic", lateReviewStatus: "REJECTED", lateReviewNote: "Not a valid reason" })],
        [],
        "all",
      );
      expect(rows[0].review).toEqual({ status: "REJECTED", note: "Not a valid reason" });
    });
  });
});

describe("month helpers", () => {
  it("currentMonthKey is the company-timezone month", () => {
    expect(currentMonthKey(new Date("2026-10-31T20:00:00Z"))).toBe("2026-11"); // already 1 Nov in IST
    expect(currentMonthKey(new Date("2026-10-05T06:00:00Z"))).toBe("2026-10");
  });

  it.each([
    ["2026-10", "2026-10-01", "2026-10-31"],
    ["2026-02", "2026-02-01", "2026-02-28"],
    ["2028-02", "2028-02-01", "2028-02-29"], // leap year
    ["2026-12", "2026-12-01", "2026-12-31"],
    ["2026-04", "2026-04-01", "2026-04-30"],
  ])("monthRange(%s)", (month, from, to) => {
    expect(monthRange(month)).toEqual({ from, to });
  });

  it("addMonths crosses year boundaries", () => {
    expect(addMonths("2026-10", 1)).toBe("2026-11");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-10", -12)).toBe("2025-10");
  });

  it("monthLabel is readable", () => {
    expect(monthLabel("2026-10")).toBe("October 2026");
  });
});

describe("sortReportRows", () => {
  const rows = [
    { name: "Bea", lateCount: 2, daysAbsent: 0, earlyCount: 0, idleMin: 0, totalWorkedMin: 0, avgWorkedMin: 0, shortDays: 0, overtimeMin: 0 },
    { name: "Al", lateCount: 5, daysAbsent: 1, earlyCount: 0, idleMin: 0, totalWorkedMin: 0, avgWorkedMin: 0, shortDays: 0, overtimeMin: 0 },
    { name: "Cy", lateCount: 5, daysAbsent: 0, earlyCount: 0, idleMin: 0, totalWorkedMin: 0, avgWorkedMin: 0, shortDays: 0, overtimeMin: 0 },
  ];

  it("numbers sort highest first by default, ties broken by name", () => {
    expect(sortReportRows(rows, "lateCount").map((r) => r.name)).toEqual(["Al", "Cy", "Bea"]);
  });
  it("names sort A-Z by default", () => {
    expect(sortReportRows(rows, "name").map((r) => r.name)).toEqual(["Al", "Bea", "Cy"]);
  });
  it("can be flipped", () => {
    expect(sortReportRows(rows, "lateCount", "asc").map((r) => r.name)).toEqual(["Bea", "Al", "Cy"]);
    expect(sortReportRows(rows, "name", "desc").map((r) => r.name)).toEqual(["Cy", "Bea", "Al"]);
  });
  it("does not change the original array", () => {
    const copy = [...rows];
    sortReportRows(rows, "lateCount");
    expect(rows).toEqual(copy);
  });
});
