import { BadRequestException } from "@nestjs/common";
import { ReasonReviewStatus } from "@prisma/client";
import { AttendanceReportService, LIVE_IDLE_SECONDS } from "./attendance-report.service";
import { DEFAULT_POLICY, type AttendancePolicy } from "./work-policy";
import type { RequestUser } from "../../common/types/request-user.type";

// Wednesday 2026-10-07, 12:00 IST (06:30Z). IST = UTC+05:30.
// Mon 5 Oct, Tue 6 Oct and Wed 7 Oct (today) are working days; Sat 3 / Sun 4 are the weekend.
const NOW = new Date("2026-10-07T06:30:00Z");
const requester = { id: "hr1", role: { id: "r", name: "EMPLOYEE" }, department: { id: "dHR", name: "HR" } } as unknown as RequestUser;

type Over = Record<string, unknown>;

const user = (id = "e1", over: Over = {}) => ({
  id,
  firstName: id.toUpperCase(),
  lastName: "Person",
  avatarUrl: null,
  shiftStart: "10:00",
  shiftEnd: "19:00",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  departmentId: "d1",
  department: { name: "Recruitment" },
  role: { name: "EMPLOYEE" },
  ...over,
});

/** A finished 10:00-IST session on `day` ("YYYY-MM-DD"). */
const sess = (day: string, over: Over = {}) => ({
  id: `s-${day}-${Math.random().toString(36).slice(2, 6)}`,
  userId: "e1",
  clockInAt: new Date(`${day}T04:30:00Z`),
  clockOutAt: new Date(`${day}T13:30:00Z`),
  durationMin: 540,
  lateByMin: null,
  lateReviewStatus: null,
  earlyByMin: null,
  earlyReviewStatus: null,
  autoClosed: false,
  idleEvents: [],
  breaks: [],
  ...over,
});

function makeReport(opts: { policy?: Partial<AttendancePolicy>; deptPolicy?: Record<string, Partial<AttendancePolicy>> } = {}) {
  const prisma = {
    user: {
      findMany: jest.fn().mockResolvedValue([user()]),
      findUnique: jest.fn().mockResolvedValue({ createdAt: new Date("2026-01-01T00:00:00Z") }),
    },
    workSession: { findMany: jest.fn().mockResolvedValue([]) },
    leaveRequest: { findMany: jest.fn().mockResolvedValue([]) },
    absenceRecord: { findMany: jest.fn().mockResolvedValue([]) },
    activityPing: { findMany: jest.fn().mockResolvedValue([]) },
    companyHoliday: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const calendar = {
    scopeUserWhere: jest.fn().mockReturnValue({}),
    listHolidays: jest.fn().mockResolvedValue([]),
  };
  const global = { ...DEFAULT_POLICY, absenceTrackingStart: null, ...opts.policy };
  const policy = {
    getGlobal: jest.fn().mockResolvedValue(global),
    forDepartment: jest.fn().mockImplementation((id: string | null) => Promise.resolve({ ...global, ...(id ? opts.deptPolicy?.[id] : {}) })),
    forUser: jest.fn().mockResolvedValue(global),
  };
  const service = new AttendanceReportService(prisma as never, calendar as never, policy as never);
  return { service, prisma, calendar, policy };
}

const report = async (made: ReturnType<typeof makeReport>, range = { from: "2026-10-05", to: "2026-10-07" }, extra: Over = {}) =>
  made.service.buildReport(requester, { ...range, ...extra }, NOW);
const firstRow = async (made: ReturnType<typeof makeReport>, range?: { from: string; to: string }) =>
  (await report(made, range)).rows[0];

// ───────────────────────── monthly report ─────────────────────────

describe("AttendanceReportService.buildReport", () => {
  it("counts a person who came in every working day as fully present", async () => {
    const made = makeReport();
    made.prisma.workSession.findMany.mockResolvedValue([sess("2026-10-05"), sess("2026-10-06")]);
    const row = await firstRow(made);
    expect(row).toMatchObject({
      name: "E1 Person",
      department: "Recruitment",
      expectedDays: 3, // Mon, Tue and today
      daysWorked: 2,
      daysAbsent: 0, // today isn't over, so not judged
      daysOnLeave: 0,
      totalWorkedMin: 1080,
      avgWorkedMin: 540,
      shortDays: 0,
      lateCount: 0,
    });
  });

  describe("absences", () => {
    it("a finished working day with no session and no leave is an absence", async () => {
      const made = makeReport();
      made.prisma.workSession.findMany.mockResolvedValue([sess("2026-10-05")]);
      const row = await firstRow(made);
      expect(row.daysAbsent).toBe(1); // Tuesday
    });

    it("not counted before absence tracking started", async () => {
      const made = makeReport({ policy: { absenceTrackingStart: "2026-10-07" } });
      made.prisma.workSession.findMany.mockResolvedValue([sess("2026-10-05")]);
      expect((await firstRow(made)).daysAbsent).toBe(0);
    });

    it("today counts only once the no-show check has marked the person", async () => {
      const made = makeReport();
      made.prisma.workSession.findMany.mockResolvedValue([sess("2026-10-05"), sess("2026-10-06")]);
      expect((await firstRow(made)).daysAbsent).toBe(0);
      made.prisma.absenceRecord.findMany.mockResolvedValue([{ userId: "e1", date: "2026-10-07" }]);
      expect((await firstRow(made)).daysAbsent).toBe(1);
    });
  });

  describe("leave, holidays and weekends", () => {
    it("approved leave isn't an absence and isn't an expected day", async () => {
      const made = makeReport();
      made.prisma.workSession.findMany.mockResolvedValue([sess("2026-10-05")]);
      made.prisma.leaveRequest.findMany.mockResolvedValue([
        { userId: "e1", startDate: new Date("2026-10-06T00:00:00Z"), endDate: new Date("2026-10-06T00:00:00Z") },
      ]);
      const row = await firstRow(made);
      expect(row).toMatchObject({ daysOnLeave: 1, daysAbsent: 0, expectedDays: 2 }); // Mon + today
    });

    it("a company holiday isn't an expected day, and working it is overtime in full", async () => {
      const made = makeReport();
      made.calendar.listHolidays.mockResolvedValue([{ date: "2026-10-05", name: "Dussehra" }]);
      made.prisma.workSession.findMany.mockResolvedValue([sess("2026-10-05", { durationMin: 300 }), sess("2026-10-06")]);
      const row = await firstRow(made);
      expect(row.expectedDays).toBe(2); // Tue + today
      expect(row.daysWorked).toBe(2); // the holiday shift still counts as a day worked
      expect(row.overtimeMin).toBe(300 + (540 - 510)); // the holiday in full + Tuesday's extra
      expect(row.shortDays).toBe(0); // a short holiday isn't a short day
    });

    it("weekends are skipped (never absent) and weekend work is overtime in full", async () => {
      const made = makeReport();
      made.prisma.workSession.findMany.mockResolvedValue([sess("2026-10-03", { durationMin: 200 })]); // a Saturday
      const row = await firstRow(made, { from: "2026-10-02", to: "2026-10-04" });
      expect(row).toMatchObject({ expectedDays: 1, daysAbsent: 1, overtimeMin: 200, shortDays: 0 }); // only Friday expected; Friday missed
      expect(row.daysWorked).toBe(1);
    });

    it("which weekdays are weekends follows the rules", async () => {
      const made = makeReport({ policy: { weeklyOffDays: [0] } }); // only Sunday off
      const row = await firstRow(made, { from: "2026-10-03", to: "2026-10-04" });
      expect(row.expectedDays).toBe(1); // Saturday is now a working day
      expect(row.daysAbsent).toBe(1);
    });
  });

  describe("late and early, and HR review", () => {
    it("counts late arrivals and their average", async () => {
      const made = makeReport();
      made.prisma.workSession.findMany.mockResolvedValue([sess("2026-10-05", { lateByMin: 20 }), sess("2026-10-06", { lateByMin: 40 })]);
      expect(await firstRow(made)).toMatchObject({ lateCount: 2, avgLateMin: 30, lateExcused: 0 });
    });

    it("an EXCUSED late arrival stops counting against the person", async () => {
      const made = makeReport();
      made.prisma.workSession.findMany.mockResolvedValue([
        sess("2026-10-05", { lateByMin: 20, lateReviewStatus: ReasonReviewStatus.EXCUSED }),
        sess("2026-10-06", { lateByMin: 40 }),
      ]);
      expect(await firstRow(made)).toMatchObject({ lateCount: 1, lateExcused: 1, avgLateMin: 40 });
    });

    it("a REJECTED one still counts", async () => {
      const made = makeReport();
      made.prisma.workSession.findMany.mockResolvedValue([sess("2026-10-05", { lateByMin: 20, lateReviewStatus: ReasonReviewStatus.REJECTED })]);
      expect(await firstRow(made)).toMatchObject({ lateCount: 1, lateExcused: 0 });
    });

    it("early leaves are counted and excused the same way", async () => {
      const made = makeReport();
      made.prisma.workSession.findMany.mockResolvedValue([
        sess("2026-10-05", { earlyByMin: 30 }),
        sess("2026-10-06", { earlyByMin: 45, earlyReviewStatus: ReasonReviewStatus.EXCUSED }),
      ]);
      expect(await firstRow(made)).toMatchObject({ earlyCount: 1, earlyExcused: 1 });
    });
  });

  describe("idle and forgotten clock-outs", () => {
    it("sums idle events and minutes", async () => {
      const made = makeReport();
      made.prisma.workSession.findMany.mockResolvedValue([
        sess("2026-10-05", { idleEvents: [{ idleMinutes: 35 }, { idleMinutes: 50 }] }),
        sess("2026-10-06", { idleEvents: [{ idleMinutes: 31 }] }),
      ]);
      expect(await firstRow(made)).toMatchObject({ idleEvents: 3, idleMin: 116 });
    });

    it("counts sessions the system had to close", async () => {
      const made = makeReport();
      made.prisma.workSession.findMany.mockResolvedValue([sess("2026-10-05", { autoClosed: true }), sess("2026-10-06")]);
      expect((await firstRow(made)).noClockOut).toBe(1);
    });
  });

  describe("hours worked, short days and overtime", () => {
    it("a finished day under the minimum is a short day, with the shortfall", async () => {
      const made = makeReport();
      made.prisma.workSession.findMany.mockResolvedValue([sess("2026-10-05", { durationMin: 400 }), sess("2026-10-06")]);
      expect(await firstRow(made)).toMatchObject({ shortDays: 1, shortfallMin: 110, overtimeMin: 30 });
    });

    it("exactly the minimum is not short and not overtime", async () => {
      const made = makeReport();
      made.prisma.workSession.findMany.mockResolvedValue([sess("2026-10-05", { durationMin: 510 })]);
      expect(await firstRow(made)).toMatchObject({ shortDays: 0, overtimeMin: 0 });
    });

    it("minutes from several sessions on the same day add up", async () => {
      const made = makeReport();
      made.prisma.workSession.findMany.mockResolvedValue([
        sess("2026-10-05", { durationMin: 240 }),
        sess("2026-10-05", { durationMin: 300 }),
      ]);
      const row = await firstRow(made);
      expect(row).toMatchObject({ daysWorked: 1, totalWorkedMin: 540, shortDays: 0, overtimeMin: 30 });
    });

    it("today is never judged short or overtime -- it isn't over", async () => {
      const made = makeReport();
      made.prisma.workSession.findMany.mockResolvedValue([sess("2026-10-07", { durationMin: 100 })]);
      expect(await firstRow(made)).toMatchObject({ daysWorked: 1, shortDays: 0, overtimeMin: 0 });
    });

    it("a session still open counts up to now", async () => {
      const made = makeReport();
      made.prisma.workSession.findMany.mockResolvedValue([
        sess("2026-10-07", { clockOutAt: null, durationMin: null, clockInAt: new Date("2026-10-07T04:30:00Z") }), // 10:00 IST, now 12:00
      ]);
      expect((await firstRow(made)).totalWorkedMin).toBe(120);
    });

    it("the minimum hours is a rule, and a department can have its own", async () => {
      const made = makeReport({ policy: { minWorkMinutes: 480 }, deptPolicy: { d1: { minWorkMinutes: 420 } } });
      made.prisma.workSession.findMany.mockResolvedValue([sess("2026-10-05", { durationMin: 430 })]);
      const row = await firstRow(made);
      expect(row).toMatchObject({ minWorkMinutes: 420, shortDays: 0, overtimeMin: 10 });
    });

    it("short days aren't judged before absence tracking started", async () => {
      const made = makeReport({ policy: { absenceTrackingStart: "2026-10-07" } });
      made.prisma.workSession.findMany.mockResolvedValue([sess("2026-10-05", { durationMin: 100 })]);
      expect((await firstRow(made)).shortDays).toBe(0);
    });
  });

  it("ignores days before the person joined, and their first day too (the account may be newer than the shift)", async () => {
    const made = makeReport();
    made.prisma.user.findMany.mockResolvedValue([user("e1", { createdAt: new Date("2026-10-06T08:00:00Z") })]); // joined Tue 13:30 IST
    const row = await firstRow(made);
    expect(row).toMatchObject({ expectedDays: 1, daysAbsent: 0 }); // only today: Mon is before they joined, Tue is their first day
  });

  it("a first-day session still counts as worked, but is not judged short", async () => {
    const made = makeReport();
    made.prisma.user.findMany.mockResolvedValue([user("e1", { createdAt: new Date("2026-10-06T08:00:00Z") })]);
    made.prisma.workSession.findMany.mockResolvedValue([sess("2026-10-06", { durationMin: 120 })]);
    expect(await firstRow(made)).toMatchObject({ daysWorked: 1, totalWorkedMin: 120, shortDays: 0, expectedDays: 1 });
  });

  describe("everyone, and the totals", () => {
    it("has one row per person plus totals", async () => {
      const made = makeReport();
      made.prisma.user.findMany.mockResolvedValue([user("a"), user("b")]);
      made.prisma.workSession.findMany.mockResolvedValue([
        sess("2026-10-05", { userId: "a", lateByMin: 20 }),
        sess("2026-10-05", { userId: "b", lateByMin: 40 }),
        sess("2026-10-06", { userId: "b", idleEvents: [{ idleMinutes: 40 }] }),
      ]);
      const { rows, totals } = await report(made);
      expect(rows.map((r) => r.userId)).toEqual(["a", "b"]);
      expect(totals).toMatchObject({
        people: 2, daysWorked: 3, lateCount: 2, avgLateMin: 30, idleEvents: 1, idleMin: 40, totalWorkedMin: 1620, avgWorkedMin: 540,
      });
    });

    it("is empty and zeroed when nobody is in scope", async () => {
      const made = makeReport();
      made.prisma.user.findMany.mockResolvedValue([]);
      const result = await report(made);
      expect(result.rows).toEqual([]);
      expect(result.totals).toMatchObject({ people: 0, lateCount: 0, avgWorkedMin: 0 });
    });
  });

  describe("who is included and the date range", () => {
    it("asks only for active people who are expected to clock in, within the requester's scope", async () => {
      const made = makeReport();
      await report(made, { from: "2026-10-05", to: "2026-10-07" }, { userId: "e9", departmentId: "d7" });
      expect(made.calendar.scopeUserWhere).toHaveBeenCalledWith(requester, "e9");
      const where = made.prisma.user.findMany.mock.calls[0][0].where;
      expect(where).toMatchObject({ isActive: true, departmentId: "d7" });
      expect(where.OR).toEqual([
        { role: { name: { notIn: ["ADMIN"] } } },
        { email: { in: ["jivan@venushiring.com"], mode: "insensitive" } },
      ]);
    });

    it("defaults to this month so far, and never goes past today", async () => {
      const made = makeReport();
      const result = await made.service.buildReport(requester, {}, NOW);
      expect([result.from, result.to]).toEqual(["2026-10-01", "2026-10-07"]);
      const future = await made.service.buildReport(requester, { from: "2026-10-01", to: "2026-12-31" }, NOW);
      expect(future.to).toBe("2026-10-07");
    });

    it("quietly falls back to the defaults for an invalid date instead of failing", async () => {
      const made = makeReport();
      const result = await made.service.buildReport(requester, { from: "2026-13-45", to: "garbage" }, NOW);
      expect([result.from, result.to]).toEqual(["2026-10-01", "2026-10-07"]);
    });

    it("returns nothing for a backwards range, and refuses more than a year", async () => {
      const made = makeReport();
      expect((await made.service.buildReport(requester, { from: "2026-10-07", to: "2026-10-01" }, NOW)).rows).toEqual([]);
      await expect(made.service.buildReport(requester, { from: "2024-01-01", to: "2026-10-07" }, NOW)).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});

// ───────────────────────── My attendance ─────────────────────────

describe("AttendanceReportService.mySummary", () => {
  const me = { id: "e1" } as unknown as RequestUser;
  const summary = (made: ReturnType<typeof makeReport>) => made.service.mySummary(me, NOW);

  it("returns this month's numbers for the person", async () => {
    const made = makeReport();
    made.prisma.workSession.findMany.mockResolvedValue([sess("2026-10-05", { lateByMin: 20 }), sess("2026-10-06")]);
    const result = await summary(made);
    expect(result).toMatchObject({ from: "2026-10-01", to: "2026-10-07", minWorkMinutes: 510 });
    expect(result.row).toMatchObject({ daysWorked: 2, lateCount: 1, totalWorkedMin: 1080 });
    expect(made.prisma.user.findMany.mock.calls[0][0].where).toEqual({ id: "e1" }); // only ever themselves
  });

  describe("streaks", () => {
    it("counts consecutive working days present and on time (today not yet clocked in doesn't break it)", async () => {
      const made = makeReport();
      made.prisma.workSession.findMany.mockResolvedValue([sess("2026-10-05"), sess("2026-10-06")]);
      expect(await summary(made)).toMatchObject({ presentStreak: 2, onTimeStreak: 2 });
    });

    it("being late ends the on-time streak but not the present streak", async () => {
      const made = makeReport();
      made.prisma.workSession.findMany.mockResolvedValue([sess("2026-10-05"), sess("2026-10-06", { lateByMin: 25 })]);
      expect(await summary(made)).toMatchObject({ presentStreak: 2, onTimeStreak: 0 });
    });

    it("an EXCUSED late arrival does not break the on-time streak", async () => {
      const made = makeReport();
      made.prisma.workSession.findMany.mockResolvedValue([
        sess("2026-10-05"),
        sess("2026-10-06", { lateByMin: 25, lateReviewStatus: ReasonReviewStatus.EXCUSED }),
      ]);
      expect(await summary(made)).toMatchObject({ onTimeStreak: 2 });
    });

    it("a missed working day ends both streaks", async () => {
      const made = makeReport();
      made.prisma.workSession.findMany.mockResolvedValue([sess("2026-10-06")]); // Monday missed
      expect(await summary(made)).toMatchObject({ presentStreak: 1, onTimeStreak: 1 });
    });

    it("weekends, holidays and approved leave neither break nor extend a streak", async () => {
      const made = makeReport();
      // Thu 1 Oct, Fri 2 Oct, [weekend], Mon 5 Oct holiday, Tue 6 Oct.
      made.calendar.listHolidays.mockResolvedValue([{ date: "2026-10-05", name: "Dussehra" }]);
      made.prisma.workSession.findMany.mockResolvedValue([sess("2026-10-01"), sess("2026-10-02"), sess("2026-10-06")]);
      expect(await summary(made)).toMatchObject({ presentStreak: 3 });

      made.calendar.listHolidays.mockResolvedValue([]);
      made.prisma.leaveRequest.findMany.mockResolvedValue([
        { startDate: new Date("2026-10-05T00:00:00Z"), endDate: new Date("2026-10-05T00:00:00Z") },
      ]);
      expect(await summary(made)).toMatchObject({ presentStreak: 3 });
    });

    it("is zero for someone with no attendance at all", async () => {
      const made = makeReport();
      expect(await summary(made)).toMatchObject({ presentStreak: 0, onTimeStreak: 0 });
    });
  });

  describe("the last two weeks, day by day", () => {
    it("lists 14 days, newest first, with each day's state", async () => {
      const made = makeReport();
      made.calendar.listHolidays.mockResolvedValue([{ date: "2026-10-01", name: "Holiday" }]);
      made.prisma.workSession.findMany.mockResolvedValue([sess("2026-10-05", { durationMin: 500, lateByMin: 15 })]);
      made.prisma.leaveRequest.findMany.mockResolvedValue([
        { startDate: new Date("2026-10-02T00:00:00Z"), endDate: new Date("2026-10-02T00:00:00Z") },
      ]);
      const { recentDays } = await summary(made);
      expect(recentDays).toHaveLength(14);
      const byDate = Object.fromEntries(recentDays.map((d) => [d.date, d]));
      expect(recentDays[0].date).toBe("2026-10-07");
      expect(byDate["2026-10-07"].state).toBe("PENDING"); // today, not clocked in yet -- not a miss
      expect(byDate["2026-10-06"].state).toBe("ABSENT");
      expect(byDate["2026-10-05"]).toMatchObject({ state: "WORKED", workedMin: 500, lateByMin: 15, lateExcused: false });
      expect(byDate["2026-10-04"].state).toBe("WEEKEND");
      expect(byDate["2026-10-01"].state).toBe("HOLIDAY");
      expect(byDate["2026-10-02"].state).toBe("LEAVE");
    });

    it("marks days before the person joined, or before tracking started, as nothing to judge", async () => {
      const made = makeReport({ policy: { absenceTrackingStart: "2026-10-06" } });
      made.prisma.user.findUnique.mockResolvedValue({ createdAt: new Date("2026-10-02T00:00:00Z") });
      const { recentDays } = await summary(made);
      const byDate = Object.fromEntries(recentDays.map((d) => [d.date, d]));
      expect(byDate["2026-10-01"].state).toBe("NA"); // before they joined
      expect(byDate["2026-10-02"].state).toBe("NA"); // joined, but before tracking started
      expect(byDate["2026-10-06"].state).toBe("ABSENT");
    });

    it("shows an excused late arrival as excused", async () => {
      const made = makeReport();
      made.prisma.workSession.findMany.mockResolvedValue([sess("2026-10-06", { lateByMin: 30, lateReviewStatus: ReasonReviewStatus.EXCUSED })]);
      const day = (await summary(made)).recentDays.find((d) => d.date === "2026-10-06")!;
      expect(day).toMatchObject({ lateByMin: 30, lateExcused: true });
    });
  });
});

// ───────────────────────── Live board ─────────────────────────

describe("AttendanceReportService.getLiveBoard", () => {
  // Wednesday 11:30 IST (06:00Z); everyone's shift starts at 10:00.
  const LIVE_NOW = new Date("2026-10-07T06:00:00Z");
  const board = (made: ReturnType<typeof makeReport>, now = LIVE_NOW, opts: { departmentId?: string } = {}) =>
    made.service.getLiveBoard(requester, opts, now);
  const statusOf = async (made: ReturnType<typeof makeReport>, id = "e1", now = LIVE_NOW) =>
    (await board(made, now)).people.find((p) => p.userId === id)!;

  const open = (over: Over = {}) => ({
    userId: "e1",
    clockInAt: new Date("2026-10-07T04:35:00Z"), // 10:05 IST
    clockOutAt: null,
    lateByMin: null,
    breaks: [],
    ...over,
  });

  it("shows someone who is clocked in as WORKING since they clocked in", async () => {
    const made = makeReport();
    made.prisma.workSession.findMany.mockResolvedValue([open()]);
    expect(await statusOf(made)).toMatchObject({ status: "WORKING", since: "2026-10-07T04:35:00.000Z", shiftStart: "10:00" });
  });

  it("carries how late they were when they clocked in", async () => {
    const made = makeReport();
    made.prisma.workSession.findMany.mockResolvedValue([open({ lateByMin: 25 })]);
    expect((await statusOf(made)).lateByMin).toBe(25);
  });

  it("shows ON_BREAK, since the break started", async () => {
    const made = makeReport();
    made.prisma.workSession.findMany.mockResolvedValue([open({ breaks: [{ startedAt: new Date("2026-10-07T05:30:00Z") }] })]);
    expect(await statusOf(made)).toMatchObject({ status: "ON_BREAK", since: "2026-10-07T05:30:00.000Z" });
  });

  describe("idle (from the desktop agent's own idle signal)", () => {
    it("IDLE once the agent reports 10+ minutes without input, with how long", async () => {
      const made = makeReport();
      made.prisma.workSession.findMany.mockResolvedValue([open()]);
      made.prisma.activityPing.findMany.mockResolvedValue([{ userId: "e1", idleSeconds: 12 * 60 }]);
      expect(await statusOf(made)).toMatchObject({ status: "IDLE", idleMin: 12 });
    });

    it("not idle just under the threshold", async () => {
      const made = makeReport();
      made.prisma.workSession.findMany.mockResolvedValue([open()]);
      made.prisma.activityPing.findMany.mockResolvedValue([{ userId: "e1", idleSeconds: LIVE_IDLE_SECONDS - 1 }]);
      expect((await statusOf(made)).status).toBe("WORKING");
    });

    it("only listens to pings from the last 3 minutes, and uses the newest", async () => {
      const made = makeReport();
      made.prisma.workSession.findMany.mockResolvedValue([open()]);
      made.prisma.activityPing.findMany.mockResolvedValue([
        { userId: "e1", idleSeconds: 5 }, // newest first
        { userId: "e1", idleSeconds: 3000 },
      ]);
      expect((await statusOf(made)).status).toBe("WORKING");
      const where = made.prisma.activityPing.findMany.mock.calls[0][0].where;
      expect(where.capturedAt.gte).toEqual(new Date("2026-10-07T05:57:00Z"));
    });

    it("someone on a break isn't called idle", async () => {
      const made = makeReport();
      made.prisma.workSession.findMany.mockResolvedValue([open({ breaks: [{ startedAt: new Date("2026-10-07T05:00:00Z") }] })]);
      made.prisma.activityPing.findMany.mockResolvedValue([{ userId: "e1", idleSeconds: 3000 }]);
      expect((await statusOf(made)).status).toBe("ON_BREAK");
    });
  });

  describe("people who haven't clocked in", () => {
    it("NOT_YET before their shift start plus the grace period", async () => {
      const made = makeReport();
      const early = new Date("2026-10-07T04:35:00Z"); // 10:05 IST, inside the 10-minute grace
      expect((await statusOf(made, "e1", early)).status).toBe("NOT_YET");
    });

    it("NOT_IN afterwards, with how overdue they are", async () => {
      const made = makeReport();
      expect(await statusOf(made)).toMatchObject({ status: "NOT_IN", lateByMin: 90, since: "2026-10-07T04:30:00.000Z" });
    });

    it("says when the no-show check has already marked them absent", async () => {
      const made = makeReport();
      made.prisma.absenceRecord.findMany.mockResolvedValue([{ userId: "e1" }]);
      expect((await statusOf(made)).markedAbsent).toBe(true);
    });

    it("the grace period is the department's own rule", async () => {
      const made = makeReport({ deptPolicy: { d1: { lateGraceMin: 120 } } });
      expect((await statusOf(made)).status).toBe("NOT_YET"); // 11:30 is within a 2-hour grace
    });

    it("a person who joined after today's shift started isn't 'not in'", async () => {
      const made = makeReport();
      made.prisma.user.findMany.mockResolvedValue([user("e1", { createdAt: new Date("2026-10-07T05:00:00Z") })]);
      expect((await statusOf(made)).status).toBe("NOT_YET");
    });
  });

  it("CLOCKED_OUT once they've finished for the day, since they left", async () => {
    const made = makeReport();
    made.prisma.workSession.findMany.mockResolvedValue([open({ clockOutAt: new Date("2026-10-07T05:30:00Z") })]);
    expect(await statusOf(made)).toMatchObject({ status: "CLOCKED_OUT", since: "2026-10-07T05:30:00.000Z" });
  });

  it("ON_LEAVE for approved leave today (and not 'not in')", async () => {
    const made = makeReport();
    made.prisma.leaveRequest.findMany.mockResolvedValue([{ userId: "e1" }]);
    expect((await statusOf(made)).status).toBe("ON_LEAVE");
  });

  describe("days off", () => {
    it("OFF on a company holiday", async () => {
      const made = makeReport();
      made.prisma.companyHoliday.findUnique.mockResolvedValue({ name: "Dussehra" });
      expect((await statusOf(made)).status).toBe("OFF");
    });

    it("OFF on a weekend", async () => {
      const made = makeReport();
      const saturday = new Date("2026-10-03T06:00:00Z");
      expect((await statusOf(made, "e1", saturday)).status).toBe("OFF");
    });

    it("someone who clocks in on a day off still shows as WORKING", async () => {
      const made = makeReport();
      made.prisma.companyHoliday.findUnique.mockResolvedValue({ name: "Dussehra" });
      made.prisma.workSession.findMany.mockResolvedValue([open()]);
      expect((await statusOf(made)).status).toBe("WORKING");
    });
  });

  it("counts each status and lists people needing attention first (not in, idle, break, working...)", async () => {
    const made = makeReport();
    made.prisma.user.findMany.mockResolvedValue([user("working"), user("idle"), user("away"), user("onbreak"), user("done"), user("leave")]);
    made.prisma.workSession.findMany.mockResolvedValue([
      open({ userId: "working" }),
      open({ userId: "idle" }),
      open({ userId: "onbreak", breaks: [{ startedAt: new Date("2026-10-07T05:00:00Z") }] }),
      open({ userId: "done", clockOutAt: new Date("2026-10-07T05:30:00Z") }),
    ]);
    made.prisma.activityPing.findMany.mockResolvedValue([{ userId: "idle", idleSeconds: 1200 }]);
    made.prisma.leaveRequest.findMany.mockResolvedValue([{ userId: "leave" }]);

    const result = await board(made);
    expect(result.people.map((p) => p.status)).toEqual(["NOT_IN", "IDLE", "ON_BREAK", "WORKING", "CLOCKED_OUT", "ON_LEAVE"]);
    expect(result.counts).toMatchObject({ NOT_IN: 1, IDLE: 1, ON_BREAK: 1, WORKING: 1, CLOCKED_OUT: 1, ON_LEAVE: 1, NOT_YET: 0, OFF: 0 });
    expect(result.generatedAt).toBe(LIVE_NOW.toISOString());
  });

  it("is limited to the requester's scope and to a chosen department", async () => {
    const made = makeReport();
    await board(made, LIVE_NOW, { departmentId: "d7" });
    expect(made.calendar.scopeUserWhere).toHaveBeenCalledWith(requester);
    expect(made.prisma.user.findMany.mock.calls[0][0].where).toMatchObject({
      isActive: true,
      departmentId: "d7",
    });
    expect(made.prisma.user.findMany.mock.calls[0][0].where.OR).toEqual([
      { role: { name: { notIn: ["ADMIN"] } } },
      { email: { in: ["jivan@venushiring.com"], mode: "insensitive" } },
    ]);
  });

  it("is empty when nobody is in scope", async () => {
    const made = makeReport();
    made.prisma.user.findMany.mockResolvedValue([]);
    const result = await board(made);
    expect(result.people).toEqual([]);
    expect(Object.values(result.counts).every((n) => n === 0)).toBe(true);
  });
});
