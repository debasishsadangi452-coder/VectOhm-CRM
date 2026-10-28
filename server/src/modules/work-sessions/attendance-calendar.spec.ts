import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { AttendanceCalendarService } from "./attendance-calendar.service";
import { DEFAULT_POLICY, type AttendancePolicy } from "./work-policy";
import {
  addDaysToKey,
  autoCloseTime,
  dayKey,
  eachDayKey,
  instantAt,
  isWeeklyOff,
  leaveCoversDay,
  MAX_OPEN_SESSION_HOURS,
} from "./work-policy";
import type { RequestUser } from "../../common/types/request-user.type";

// 2026-10-05 is a Monday. IST = UTC+05:30.
const MON = "2026-10-05";

const makeUser = (role: string, department: string | null, id = "u1") =>
  ({
    id,
    email: `${id}@x.com`,
    firstName: "T",
    lastName: id,
    role: { id: "r", name: role },
    department: department ? { id: `dept-${department}`, name: department, managerTitle: "Manager" } : null,
  }) as unknown as RequestUser;

const admin = makeUser("ADMIN", null, "admin1");
const hr = makeUser("EMPLOYEE", "HR", "hr1");
const manager = makeUser("MANAGER", "Recruitment", "mgr1");
const employee = makeUser("EMPLOYEE", "Recruitment", "e1");

// ───────────────────────── calendar helpers ─────────────────────────

describe("day keys", () => {
  it("dayKey is the company-timezone calendar day, not the UTC day", () => {
    expect(dayKey(new Date("2026-10-05T04:30:00Z"))).toBe("2026-10-05"); // 10:00 IST
    expect(dayKey(new Date("2026-10-05T18:29:00Z"))).toBe("2026-10-05"); // 23:59 IST
    expect(dayKey(new Date("2026-10-05T18:30:00Z"))).toBe("2026-10-06"); // 00:00 IST next day
    expect(dayKey(new Date("2026-10-05T20:00:00Z"))).toBe("2026-10-06"); // 01:30 IST
  });

  it("addDaysToKey crosses month and year boundaries", () => {
    expect(addDaysToKey("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysToKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToKey("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDaysToKey("2028-03-01", -1)).toBe("2028-02-29"); // leap year
  });

  it("eachDayKey is inclusive and empty when reversed", () => {
    expect(eachDayKey("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(eachDayKey(MON, MON)).toEqual([MON]);
    expect(eachDayKey("2026-10-06", MON)).toEqual([]);
  });

  it("instantAt converts company wall-clock time to a UTC instant", () => {
    expect(instantAt(MON, "10:00").toISOString()).toBe("2026-10-05T04:30:00.000Z");
    expect(instantAt(MON, "00:00").toISOString()).toBe("2026-10-04T18:30:00.000Z");
    expect(instantAt(MON, "23:59").toISOString()).toBe("2026-10-05T18:29:00.000Z");
  });
});

describe("isWeeklyOff", () => {
  it.each([
    ["2026-10-03", "Saturday", true],
    ["2026-10-04", "Sunday", true],
    ["2026-10-05", "Monday", false],
    ["2026-10-09", "Friday", false],
    ["2026-10-10", "Saturday", true],
  ])("%s (%s) -> %s", (key, _day, off) => {
    expect(isWeeklyOff(key)).toBe(off);
  });
});

describe("leaveCoversDay", () => {
  const d = (s: string) => new Date(`${s}T00:00:00Z`);
  it("covers every day from start to end inclusive", () => {
    expect(leaveCoversDay(d("2026-10-05"), d("2026-10-07"), "2026-10-05")).toBe(true);
    expect(leaveCoversDay(d("2026-10-05"), d("2026-10-07"), "2026-10-06")).toBe(true);
    expect(leaveCoversDay(d("2026-10-05"), d("2026-10-07"), "2026-10-07")).toBe(true);
  });
  it("does not cover the day before or after", () => {
    expect(leaveCoversDay(d("2026-10-05"), d("2026-10-07"), "2026-10-04")).toBe(false);
    expect(leaveCoversDay(d("2026-10-05"), d("2026-10-07"), "2026-10-08")).toBe(false);
  });
  it("a one-day leave covers just that day", () => {
    expect(leaveCoversDay(d("2026-10-05"), d("2026-10-05"), "2026-10-05")).toBe(true);
  });
});

describe("autoCloseTime (when a forgotten session is closed on their behalf)", () => {
  const clockIn = new Date("2026-10-05T04:30:00Z"); // 10:00 IST Monday

  it("closes at the end of their shift that day", () => {
    expect(autoCloseTime(clockIn, "10:00", "19:00").toISOString()).toBe("2026-10-05T13:30:00.000Z"); // 19:00 IST
  });

  it("uses THEIR shift end", () => {
    expect(autoCloseTime(clockIn, "09:00", "18:00").toISOString()).toBe("2026-10-05T12:30:00.000Z");
  });

  it("closes at the next morning's shift end for an overnight shift", () => {
    const night = new Date("2026-10-05T16:30:00Z"); // 22:00 IST
    expect(autoCloseTime(night, "22:00", "06:00").toISOString()).toBe("2026-10-06T00:30:00.000Z"); // 06:00 IST next day
  });

  it("never closes before they clocked in (clocked in after shift end)", () => {
    const late = new Date("2026-10-05T14:30:00Z"); // 20:00 IST, shift ended 19:00
    expect(autoCloseTime(late, "10:00", "19:00")).toEqual(late);
  });

  it(`never more than ${MAX_OPEN_SESSION_HOURS} hours after clock-in`, () => {
    const early = new Date("2026-10-04T18:30:00Z"); // 00:00 IST
    const closeAt = autoCloseTime(early, "00:00", "23:59"); // shift end 23:59 would be 24h later
    expect(closeAt.getTime() - early.getTime()).toBe(MAX_OPEN_SESSION_HOURS * 60 * 60 * 1000);
  });
});

// ───────────────────────── calendar service ─────────────────────────

function makeCalendar(policyOver: Partial<AttendancePolicy> = {}) {
  const prisma = {
    companyHoliday: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "h1", ...data })),
      delete: jest.fn().mockResolvedValue({}),
    },
    leaveRequest: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    workSession: { findMany: jest.fn().mockResolvedValue([]) },
    absenceRecord: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const policy = { getGlobal: jest.fn().mockResolvedValue({ ...DEFAULT_POLICY, ...policyOver }) };
  return { service: new AttendanceCalendarService(prisma as never, policy as never), prisma, policy };
}

describe("AttendanceCalendarService.getDayType", () => {
  it("a normal weekday with no leave is a working day", async () => {
    const { service } = makeCalendar();
    await expect(service.getDayType("u1", MON)).resolves.toEqual({ type: "WORKING" });
  });

  it("a company holiday wins, with its name", async () => {
    const { service, prisma } = makeCalendar();
    prisma.companyHoliday.findUnique.mockResolvedValue({ name: "Diwali" });
    await expect(service.getDayType("u1", MON)).resolves.toEqual({ type: "HOLIDAY", note: "Diwali" });
  });

  it("a Saturday or Sunday is a weekend", async () => {
    const { service } = makeCalendar();
    await expect(service.getDayType("u1", "2026-10-03")).resolves.toEqual({ type: "WEEKEND" });
    await expect(service.getDayType("u1", "2026-10-04")).resolves.toEqual({ type: "WEEKEND" });
  });

  it("approved leave on a weekday is LEAVE with the leave type", async () => {
    const { service, prisma } = makeCalendar();
    prisma.leaveRequest.findFirst.mockResolvedValue({ type: "SICK" });
    await expect(service.getDayType("u1", MON)).resolves.toEqual({ type: "LEAVE", note: "SICK" });
  });

  it("only APPROVED leave counts, and it is looked up for that user and day", async () => {
    const { service, prisma } = makeCalendar();
    await service.getDayType("u9", MON);
    const where = prisma.leaveRequest.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ userId: "u9", status: "APPROVED" });
    expect(where.startDate.lt).toEqual(new Date("2026-10-06T00:00:00Z"));
    expect(where.endDate.gte).toEqual(new Date("2026-10-05T00:00:00Z"));
  });

  it("which weekdays are the weekly days off is a rule, not a constant", async () => {
    const onlySunday = makeCalendar({ weeklyOffDays: [0] });
    await expect(onlySunday.service.getDayType("u1", "2026-10-03")).resolves.toEqual({ type: "WORKING" }); // a Saturday
    await expect(onlySunday.service.getDayType("u1", "2026-10-04")).resolves.toEqual({ type: "WEEKEND" });

    const fridays = makeCalendar({ weeklyOffDays: [5] });
    await expect(fridays.service.getDayType("u1", "2026-10-09")).resolves.toEqual({ type: "WEEKEND" }); // a Friday
  });

  it("holiday beats weekend beats leave", async () => {
    const { service, prisma } = makeCalendar();
    prisma.leaveRequest.findFirst.mockResolvedValue({ type: "SICK" });
    await expect(service.getDayType("u1", "2026-10-03")).resolves.toEqual({ type: "WEEKEND" }); // leave on a Saturday: just a weekend
    prisma.companyHoliday.findUnique.mockResolvedValue({ name: "Holiday" });
    await expect(service.getDayType("u1", "2026-10-03")).resolves.toMatchObject({ type: "HOLIDAY" });
  });

  it("isWorkingDay is true only for WORKING, using the company-timezone day of the instant", async () => {
    const { service, prisma } = makeCalendar();
    await expect(service.isWorkingDay("u1", new Date("2026-10-05T04:30:00Z"))).resolves.toBe(true); // Mon 10:00 IST
    // Night shifts: before 08:00 IST an instant still belongs to the previous shift day.
    // Sun 18:30Z is Mon 00:00 IST -> Sunday's shift day (weekend); Fri 18:30Z is Sat 00:00 IST -> Friday's (working).
    await expect(service.isWorkingDay("u1", new Date("2026-10-04T18:30:00Z"))).resolves.toBe(false);
    await expect(service.isWorkingDay("u1", new Date("2026-10-02T18:30:00Z"))).resolves.toBe(true);
    await expect(service.isWorkingDay("u1", new Date("2026-10-03T18:30:00Z"))).resolves.toBe(false); // Sat 18:30Z is Sun 00:00 IST -> Saturday's shift day (weekend)
    prisma.companyHoliday.findUnique.mockResolvedValue({ name: "X" });
    await expect(service.isWorkingDay("u1", new Date("2026-10-05T04:30:00Z"))).resolves.toBe(false);
  });
});

describe("AttendanceCalendarService — holidays", () => {
  it("lets Admin and HR add a holiday", async () => {
    for (const who of [admin, hr]) {
      const { service, prisma } = makeCalendar();
      await service.createHoliday(who, "2026-11-08", "  Diwali  ");
      expect(prisma.companyHoliday.create).toHaveBeenCalledWith({
        data: { date: "2026-11-08", name: "Diwali", createdById: who.id },
      });
    }
  });

  it("stops everyone else adding or removing one", async () => {
    for (const who of [manager, employee]) {
      const { service, prisma } = makeCalendar();
      await expect(service.createHoliday(who, "2026-11-08", "X")).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.deleteHoliday(who, "h1")).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.companyHoliday.create).not.toHaveBeenCalled();
    }
  });

  it.each(["2026-13-01", "2026-02-30", "not-a-date", "26-10-05", ""])("rejects the invalid date %j", async (bad) => {
    const { service } = makeCalendar();
    await expect(service.createHoliday(admin, bad, "X")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuses a duplicate day, naming the existing holiday", async () => {
    const { service, prisma } = makeCalendar();
    prisma.companyHoliday.findUnique.mockResolvedValue({ name: "Diwali" });
    await expect(service.createHoliday(admin, "2026-11-08", "Other")).rejects.toBeInstanceOf(ConflictException);
    await expect(service.createHoliday(admin, "2026-11-08", "Other")).rejects.toThrow(/Diwali/);
  });

  it("deletes a holiday, 404ing for an unknown one", async () => {
    const { service, prisma } = makeCalendar();
    await expect(service.deleteHoliday(admin, "nope")).rejects.toBeInstanceOf(NotFoundException);
    prisma.companyHoliday.findUnique.mockResolvedValue({ id: "h1" });
    await expect(service.deleteHoliday(hr, "h1")).resolves.toEqual({ success: true });
    expect(prisma.companyHoliday.delete).toHaveBeenCalledWith({ where: { id: "h1" } });
  });

  it("lists holidays in date order, optionally within a range", async () => {
    const { service, prisma } = makeCalendar();
    await service.listHolidays({ from: "2026-10-01", to: "2026-10-31" });
    expect(prisma.companyHoliday.findMany).toHaveBeenCalledWith({
      where: { date: { gte: "2026-10-01", lte: "2026-10-31" } },
      orderBy: { date: "asc" },
    });
    await service.listHolidays();
    expect(prisma.companyHoliday.findMany.mock.calls[1][0].where).toEqual({});
  });
});

// ───────────────────────── "Absent" / "On leave" rows ─────────────────────────

describe("AttendanceCalendarService.listDayStatuses", () => {
  // "Now" is Wednesday 2026-10-07 midday IST.
  const NOW = new Date("2026-10-07T06:30:00Z");
  const person = (id: string, first = id, createdAt = "2026-01-01T00:00:00Z") => ({
    id,
    firstName: first,
    lastName: "X",
    avatarUrl: null,
    createdAt: new Date(createdAt),
  });

  it("shows approved leave days (so 'On leave' isn't a blank) and absent days, but not days with a session", async () => {
    const { service, prisma } = makeCalendar({ absenceTrackingStart: "2026-10-07" });
    prisma.user.findMany.mockResolvedValue([person("e1", "Eve")]);
    // Mon: worked. Tue: leave. Wed: marked absent.
    prisma.workSession.findMany.mockResolvedValue([{ userId: "e1", clockInAt: new Date("2026-10-05T04:30:00Z") }]);
    prisma.leaveRequest.findMany.mockResolvedValue([
      { userId: "e1", type: "SICK", startDate: new Date("2026-10-06T00:00:00Z"), endDate: new Date("2026-10-06T00:00:00Z") },
    ]);
    prisma.absenceRecord.findMany.mockResolvedValue([{ userId: "e1", date: "2026-10-07" }]);

    const rows = await service.listDayStatuses(admin, { from: "2026-10-05", to: "2026-10-07" }, NOW);
    expect(rows.map((r) => [r.date, r.status, r.note])).toEqual([
      ["2026-10-07", "ABSENT", undefined],
      ["2026-10-06", "LEAVE", "SICK"],
    ]);
  });

  it("skips weekends, company holidays and days that haven't happened yet", async () => {
    const { service, prisma } = makeCalendar({ absenceTrackingStart: "2026-10-07" });
    prisma.user.findMany.mockResolvedValue([person("e1")]);
    prisma.companyHoliday.findMany.mockResolvedValue([{ date: "2026-10-06" }]);
    prisma.absenceRecord.findMany.mockResolvedValue([
      { userId: "e1", date: "2026-10-03" }, // Saturday
      { userId: "e1", date: "2026-10-06" }, // holiday
      { userId: "e1", date: "2026-10-08" }, // tomorrow
    ]);
    const rows = await service.listDayStatuses(admin, { from: "2026-10-03", to: "2026-10-09" }, NOW);
    expect(rows).toEqual([]);
  });

  it("does not list days before the person joined", async () => {
    const { service, prisma } = makeCalendar({ absenceTrackingStart: "2026-10-07" });
    prisma.user.findMany.mockResolvedValue([person("e1", "Eve", "2026-10-06T00:00:00Z")]);
    prisma.absenceRecord.findMany.mockResolvedValue([
      { userId: "e1", date: "2026-10-05" },
      { userId: "e1", date: "2026-10-07" },
    ]);
    const rows = await service.listDayStatuses(admin, { from: "2026-10-05", to: "2026-10-07" }, NOW);
    expect(rows.map((r) => r.date)).toEqual(["2026-10-07"]);
  });

  it("does not claim someone is absent on a day they have not been marked yet (e.g. this morning)", async () => {
    const { service, prisma } = makeCalendar();
    prisma.user.findMany.mockResolvedValue([person("e1")]);
    const rows = await service.listDayStatuses(admin, { from: "2026-10-07", to: "2026-10-07" }, NOW);
    expect(rows).toEqual([]);
  });

  describe("finished working days with no session count as absent even without a no-show record", () => {
    it("a past working day with no session and no leave is ABSENT", async () => {
      const { service, prisma } = makeCalendar({ absenceTrackingStart: null });
      prisma.user.findMany.mockResolvedValue([person("e1")]);
      const rows = await service.listDayStatuses(admin, { from: "2026-10-05", to: "2026-10-07" }, NOW);
      expect(rows.map((r) => [r.date, r.status])).toEqual([
        ["2026-10-06", "ABSENT"],
        ["2026-10-05", "ABSENT"],
      ]); // not today (2026-10-07): it isn't over, and the no-show job hasn't marked it
    });

    it("never inferred before absence tracking started (so turning it on isn't retroactive)", async () => {
      const { service, prisma } = makeCalendar({ absenceTrackingStart: "2026-10-06" });
      prisma.user.findMany.mockResolvedValue([person("e1")]);
      const rows = await service.listDayStatuses(admin, { from: "2026-10-05", to: "2026-10-07" }, NOW);
      expect(rows.map((r) => r.date)).toEqual(["2026-10-06"]);
    });

    it("approved leave and days with a session are not absences", async () => {
      const { service, prisma } = makeCalendar({ absenceTrackingStart: null });
      prisma.user.findMany.mockResolvedValue([person("e1")]);
      prisma.workSession.findMany.mockResolvedValue([{ userId: "e1", clockInAt: new Date("2026-10-05T04:30:00Z") }]);
      prisma.leaveRequest.findMany.mockResolvedValue([
        { userId: "e1", type: "CASUAL", startDate: new Date("2026-10-06T00:00:00Z"), endDate: new Date("2026-10-06T00:00:00Z") },
      ]);
      const rows = await service.listDayStatuses(admin, { from: "2026-10-05", to: "2026-10-06" }, NOW);
      expect(rows.map((r) => [r.date, r.status])).toEqual([["2026-10-06", "LEAVE"]]);
    });

    it("respects the configured weekly days off", async () => {
      const { service, prisma } = makeCalendar({ absenceTrackingStart: null, weeklyOffDays: [0] }); // only Sunday off
      prisma.user.findMany.mockResolvedValue([person("e1")]);
      const rows = await service.listDayStatuses(admin, { from: "2026-10-03", to: "2026-10-04" }, NOW);
      expect(rows.map((r) => r.date)).toEqual(["2026-10-03"]); // Saturday is now a working day; Sunday still off
    });
  });

  it("covers multi-day leave across several days", async () => {
    const { service, prisma } = makeCalendar();
    prisma.user.findMany.mockResolvedValue([person("e1")]);
    prisma.leaveRequest.findMany.mockResolvedValue([
      { userId: "e1", type: "ANNUAL", startDate: new Date("2026-10-05T00:00:00Z"), endDate: new Date("2026-10-07T00:00:00Z") },
    ]);
    const rows = await service.listDayStatuses(admin, { from: "2026-10-05", to: "2026-10-07" }, NOW);
    expect(rows.map((r) => r.date)).toEqual(["2026-10-07", "2026-10-06", "2026-10-05"]);
    expect(rows.every((r) => r.status === "LEAVE" && r.note === "ANNUAL")).toBe(true);
  });

  it("never reports the future: the range is clamped to today", async () => {
    const { service, prisma } = makeCalendar({ absenceTrackingStart: "2026-10-07" });
    prisma.user.findMany.mockResolvedValue([person("e1")]);
    await service.listDayStatuses(admin, { from: "2026-10-05", to: "2026-12-31" }, NOW);
    const where = prisma.absenceRecord.findMany.mock.calls[0][0].where;
    expect(where.date).toEqual({ gte: "2026-10-05", lte: "2026-10-07" });
  });

  it("defaults to the last 30 days and rejects an absurdly long range", async () => {
    const { service, prisma } = makeCalendar({ absenceTrackingStart: "2026-10-07" });
    prisma.user.findMany.mockResolvedValue([person("e1")]);
    await service.listDayStatuses(admin, {}, NOW);
    expect(prisma.absenceRecord.findMany.mock.calls[0][0].where.date).toEqual({ gte: "2026-09-08", lte: "2026-10-07" });
    await expect(service.listDayStatuses(admin, { from: "2025-01-01", to: "2026-10-07" }, NOW)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("returns nothing when no one is in scope", async () => {
    const { service } = makeCalendar();
    await expect(service.listDayStatuses(admin, {}, NOW)).resolves.toEqual([]);
  });

  describe("who can see whom", () => {
    const whereFor = async (who: RequestUser, userId?: string) => {
      const { service, prisma } = makeCalendar();
      await service.listDayStatuses(who, { userId }, NOW);
      return prisma.user.findMany.mock.calls[0][0].where;
    };

    it("always excludes inactive users and Admins (who aren't expected to clock in)", async () => {
      const where = await whereFor(admin);
      expect(where.isActive).toBe(true);
      expect(where.OR).toEqual([
        { role: { name: { notIn: ["ADMIN"] } } },
        { email: { in: ["jivan@venushiring.com"], mode: "insensitive" } },
      ]);
    });

    it("Admin and HR see everyone, or one chosen person", async () => {
      expect(await whereFor(admin)).not.toHaveProperty("id");
      expect(await whereFor(hr)).not.toHaveProperty("id");
      expect((await whereFor(hr, "e5")).id).toBe("e5");
    });

    it("a Manager sees only their department, and only that department's people when one is chosen", async () => {
      expect((await whereFor(manager)).departmentId).toBe("dept-Recruitment");
      const chosen = await whereFor(manager, "e5");
      expect(chosen.AND).toEqual([{ id: "e5" }, { departmentId: "dept-Recruitment" }]);
    });

    it("an Employee sees only themselves, even if they ask for someone else", async () => {
      expect((await whereFor(employee)).id).toBe("e1");
      expect((await whereFor(employee, "someone-else")).id).toBe("e1");
    });
  });
});
