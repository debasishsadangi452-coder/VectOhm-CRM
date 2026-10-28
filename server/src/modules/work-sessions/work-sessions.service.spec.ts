import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { NotificationType, ReasonReviewStatus } from "@prisma/client";
import { WorkSessionsService } from "./work-sessions.service";
import { DEFAULT_POLICY, type AttendancePolicy } from "./work-policy";
import type { RequestUser } from "../../common/types/request-user.type";

// 10:30 IST on 2026-10-05 -- 30 min after a 10:00 shift start.
const NOW = new Date("2026-10-05T05:00:00Z");
const CLOCK_IN = new Date("2026-10-05T04:30:00Z"); // 10:00 IST

const user = {
  id: "u1",
  email: "e@x.com",
  firstName: "Jane",
  lastName: "Doe",
  role: { id: "r1", name: "EMPLOYEE" },
  department: { id: "d1", name: "Engineering", managerTitle: "Manager" },
} as unknown as RequestUser;

function makeService(rulesOver: Partial<AttendancePolicy> = {}) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ shiftStart: "10:00", shiftEnd: "19:00" }),
      findMany: jest.fn().mockResolvedValue([{ id: "admin1" }, { id: "mgr1" }]),
    },
    workSession: {
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "s1", ...data })),
      update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data })),
    },
    workBreak: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    },
    idleEvent: {
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "ev1", ...data })),
    },
    absenceRecord: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    lateStartRequest: { findFirst: jest.fn().mockResolvedValue(null) },
    activityPing: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const notifications = { create: jest.fn().mockResolvedValue({}) };
  const calendar = { isWorkingDay: jest.fn().mockResolvedValue(true) };
  const oversight = {
    recipientsFor: jest.fn().mockResolvedValue(["hr1", "mgr1"]),
    notify: jest.fn().mockResolvedValue(2),
  };
  const rules = { ...DEFAULT_POLICY, ...rulesOver };
  const policy = {
    forUser: jest.fn().mockResolvedValue(rules),
    getGlobal: jest.fn().mockResolvedValue(rules),
  };
  const service = new WorkSessionsService(
    prisma as never,
    notifications as never,
    calendar as never,
    oversight as never,
    policy as never,
  );
  return { service, prisma, notifications, calendar, oversight, policy };
}

const activeSession = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  userId: "u1",
  clockInAt: CLOCK_IN,
  clockOutAt: null,
  lateByMin: null,
  lateReason: null,
  ...over,
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("WorkSessionsService.clockIn", () => {
  it("marks the first clock-in of the day late once past shift start + grace", async () => {
    const { service, prisma } = makeService();
    await service.clockIn(user); // 10:30 IST vs 10:00 shift
    expect(prisma.workSession.create.mock.calls[0][0].data.lateByMin).toBe(30);
  });

  it("does not mark an on-time clock-in late", async () => {
    const { service, prisma } = makeService();
    jest.setSystemTime(new Date("2026-10-05T04:35:00Z")); // 10:05 IST, inside grace
    await service.clockIn(user);
    expect(prisma.workSession.create.mock.calls[0][0].data.lateByMin).toBeNull();
  });

  it("judges lateness against the user's own shift start", async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({ shiftStart: "10:30", shiftEnd: "19:30" });
    await service.clockIn(user);
    expect(prisma.workSession.create.mock.calls[0][0].data.lateByMin).toBeNull();
  });

  it("falls back to the default shift when the user has none", async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue(null);
    await service.clockIn(user);
    expect(prisma.workSession.create.mock.calls[0][0].data.lateByMin).toBe(30);
  });

  it("never marks a later session in the same work day as late", async () => {
    const { service, prisma } = makeService();
    prisma.workSession.count.mockResolvedValue(1); // already clocked in earlier today
    await service.clockIn(user);
    expect(prisma.workSession.create.mock.calls[0][0].data.lateByMin).toBeNull();
  });

  it("rejects when a session is already active", async () => {
    const { service, prisma } = makeService();
    prisma.workSession.findFirst.mockResolvedValue(activeSession());
    await expect(service.clockIn(user)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.workSession.create).not.toHaveBeenCalled();
  });
});

describe("WorkSessionsService.clockOut", () => {
  it("requires a reason when leaving before shift end", async () => {
    const { service, prisma } = makeService();
    prisma.workSession.findFirst.mockResolvedValue(activeSession());
    // NOW is 10:30 IST, shift ends 19:00.
    await expect(service.clockOut(user)).rejects.toMatchObject({
      response: { code: "EARLY_CLOCK_OUT_REASON_REQUIRED" },
    });
    expect(prisma.workSession.update).not.toHaveBeenCalled();
  });

  it("rejects a too-short early reason", async () => {
    const { service, prisma } = makeService();
    prisma.workSession.findFirst.mockResolvedValue(activeSession());
    await expect(service.clockOut(user, "ab")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("stores the early reason and notifies oversight", async () => {
    const { service, prisma, notifications } = makeService();
    prisma.workSession.findFirst.mockResolvedValue(activeSession());
    await service.clockOut(user, "  Doctor appointment  ");

    const data = prisma.workSession.update.mock.calls.at(-1)![0].data;
    expect(data.earlyByMin).toBe(510); // 19:00 - 10:30
    expect(data.earlyReason).toBe("Doctor appointment");
    expect(notifications.create).toHaveBeenCalledTimes(2);
    expect(notifications.create.mock.calls[0][0]).toMatchObject({
      type: NotificationType.ATTENDANCE_EARLY,
      link: "/attendance",
    });
    expect(notifications.create.mock.calls[0][0].message).toContain("Doctor appointment");
  });

  it("needs no reason after shift end and records no early leave", async () => {
    const { service, prisma, notifications } = makeService();
    jest.setSystemTime(new Date("2026-10-05T13:35:00Z")); // 19:05 IST
    prisma.workSession.findFirst.mockResolvedValue(activeSession());
    await service.clockOut(user);

    const data = prisma.workSession.update.mock.calls.at(-1)![0].data;
    expect(data.earlyByMin).toBeUndefined();
    expect(data.clockOutAt).toBeInstanceOf(Date);
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it("rejects when there is no active session", async () => {
    const { service } = makeService();
    await expect(service.clockOut(user, "x")).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("WorkSessionsService.submitLateReason", () => {
  it("404s for a session that isn't the user's", async () => {
    const { service } = makeService();
    await expect(service.submitLateReason(user, "s1", "traffic")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects a session that wasn't a late clock-in", async () => {
    const { service, prisma } = makeService();
    prisma.workSession.findFirst.mockResolvedValue(activeSession({ lateByMin: null }));
    await expect(service.submitLateReason(user, "s1", "traffic")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a second answer", async () => {
    const { service, prisma } = makeService();
    prisma.workSession.findFirst.mockResolvedValue(activeSession({ lateByMin: 30, lateReason: "traffic" }));
    await expect(service.submitLateReason(user, "s1", "again")).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.workSession.update).not.toHaveBeenCalled();
  });

  it("saves the trimmed reason and notifies Admin/HR/manager but not the user", async () => {
    const { service, prisma, notifications } = makeService();
    prisma.workSession.findFirst.mockResolvedValue(activeSession({ lateByMin: 30 }));
    await service.submitLateReason(user, "s1", "  Traffic jam  ");

    expect(prisma.workSession.update.mock.calls[0][0].data.lateReason).toBe("Traffic jam");
    expect(prisma.user.findMany.mock.calls[0][0].where.id).toEqual({ not: "u1" });
    expect(notifications.create).toHaveBeenCalledTimes(2);
    expect(notifications.create.mock.calls[0][0]).toMatchObject({
      userId: "admin1",
      type: NotificationType.ATTENDANCE_LATE,
    });
    expect(notifications.create.mock.calls[0][0].message).toContain("30 min late");
  });

  it("still succeeds if notifying fails", async () => {
    const { service, prisma, notifications } = makeService();
    prisma.workSession.findFirst.mockResolvedValue(activeSession({ lateByMin: 30 }));
    notifications.create.mockRejectedValue(new Error("socket down"));
    await expect(service.submitLateReason(user, "s1", "Traffic")).resolves.toBeDefined();
  });
});

describe("WorkSessionsService.submitIdleReason", () => {
  const dto = (over: Record<string, unknown> = {}) => ({
    idleStartedAt: "2026-10-05T04:50:00.000Z",
    idleMinutes: 35,
    reason: "In a meeting",
    ...over,
  });

  it("requires an active session", async () => {
    const { service } = makeService();
    await expect(service.submitIdleReason(user, dto())).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects idle stretches shorter than the threshold", async () => {
    const { service, prisma } = makeService();
    prisma.workSession.findFirst.mockResolvedValue(activeSession());
    await expect(service.submitIdleReason(user, dto({ idleMinutes: 4 }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.idleEvent.create).not.toHaveBeenCalled();
  });

  it("rejects an idle start in the future", async () => {
    const { service, prisma } = makeService();
    prisma.workSession.findFirst.mockResolvedValue(activeSession());
    await expect(
      service.submitIdleReason(user, dto({ idleStartedAt: "2026-10-05T06:00:00.000Z" })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("records the event against the active session and notifies oversight", async () => {
    const { service, prisma, notifications } = makeService();
    prisma.workSession.findFirst.mockResolvedValue(activeSession());
    await service.submitIdleReason(user, dto());

    expect(prisma.idleEvent.create.mock.calls[0][0].data).toMatchObject({
      userId: "u1",
      workSessionId: "s1",
      idleMinutes: 35,
      reason: "In a meeting",
    });
    expect(notifications.create.mock.calls[0][0]).toMatchObject({
      type: NotificationType.ATTENDANCE_IDLE,
      link: "/screen-monitoring",
    });
  });

  it("clamps idle time that began before clock-in to the clock-in time", async () => {
    const { service, prisma } = makeService();
    prisma.workSession.findFirst.mockResolvedValue(activeSession());
    await service.submitIdleReason(user, dto({ idleStartedAt: "2026-10-05T03:00:00.000Z" }));
    expect(prisma.idleEvent.create.mock.calls[0][0].data.idleStartedAt).toEqual(CLOCK_IN);
  });
});

describe("WorkSessionsService — days they are not expected to work", () => {
  it.each(["weekend", "company holiday", "approved leave"])(
    "does not mark a late clock-in as late on a %s",
    async () => {
      const { service, prisma, calendar } = makeService();
      calendar.isWorkingDay.mockResolvedValue(false); // the calendar says: not a working day
      await service.clockIn(user); // 10:30 IST vs 10:00 shift would normally be 30 min late
      expect(prisma.workSession.create.mock.calls[0][0].data.lateByMin).toBeNull();
    },
  );

  it("asks the calendar about THIS user and the clock-in moment", async () => {
    const { service, calendar } = makeService();
    await service.clockIn(user);
    expect(calendar.isWorkingDay).toHaveBeenCalledWith("u1", NOW);
  });

  it("does not require a reason for leaving early on a non-working day", async () => {
    const { service, prisma, calendar } = makeService();
    calendar.isWorkingDay.mockResolvedValue(false);
    prisma.workSession.findFirst.mockResolvedValue(activeSession());
    await expect(service.clockOut(user)).resolves.toBeDefined(); // 10:30 IST, shift ends 19:00
    expect(prisma.workSession.update.mock.calls.at(-1)![0].data.earlyByMin).toBeUndefined();
  });

  it("still requires the early reason on a normal working day", async () => {
    const { service, prisma } = makeService();
    prisma.workSession.findFirst.mockResolvedValue(activeSession());
    await expect(service.clockOut(user)).rejects.toMatchObject({
      response: { code: "EARLY_CLOCK_OUT_REASON_REQUIRED" },
    });
  });

  it("the active-session response doesn't call a weekend clock-out early", async () => {
    const { service, prisma, calendar } = makeService();
    prisma.workSession.findFirst.mockResolvedValue(activeSession());
    prisma.workBreak.findFirst.mockResolvedValue(null);
    calendar.isWorkingDay.mockResolvedValue(false);
    const active = await service.getActive("u1");
    expect(active!.clockOutIsEarly).toBe(false);

    calendar.isWorkingDay.mockResolvedValue(true);
    expect((await service.getActive("u1"))!.clockOutIsEarly).toBe(true);
  });
});

describe("WorkSessionsService.clockIn — clears a no-show mark", () => {
  it("removes today's absence record when the person finally clocks in", async () => {
    const { service, prisma } = makeService();
    await service.clockIn(user);
    expect(prisma.absenceRecord.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1", date: "2026-10-05" },
    });
  });
});

describe("WorkSessionsService.clockIn — repeat-late alert", () => {
  it("does not alert for the first or second late arrival", async () => {
    const { service, prisma, oversight } = makeService();
    prisma.workSession.count.mockResolvedValueOnce(0).mockResolvedValueOnce(2); // earlierToday, late count
    await service.clockIn(user);
    expect(oversight.notify).not.toHaveBeenCalled();
  });

  it("alerts the manager(s) and HR on the third late arrival in 7 days", async () => {
    const { service, prisma, oversight } = makeService();
    prisma.workSession.count.mockResolvedValueOnce(0).mockResolvedValueOnce(3);
    prisma.user.findUnique
      .mockResolvedValueOnce({ shiftStart: "10:00", shiftEnd: "19:00" }) // getShift
      .mockResolvedValueOnce({ id: "u1", firstName: "Eve", lastName: "Employee", departmentId: "d1", managerId: "m1" });
    await service.clockIn(user);

    expect(oversight.recipientsFor).toHaveBeenCalledWith(expect.objectContaining({ id: "u1", managerId: "m1" }));
    expect(oversight.notify).toHaveBeenCalledWith(
      ["hr1", "mgr1"],
      expect.objectContaining({
        type: NotificationType.ATTENDANCE_REPEAT_LATE,
        link: "/attendance",
        message: "Eve Employee has been late 3 times in the last 7 days.",
      }),
    );
  });

  it("counts only late sessions in the last 7 days", async () => {
    const { service, prisma } = makeService();
    prisma.workSession.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    await service.clockIn(user);
    const where = prisma.workSession.count.mock.calls[1][0].where;
    expect(where.lateByMin).toEqual({ not: null });
    expect(where.clockInAt.gte).toEqual(new Date("2026-09-28T05:00:00Z"));
  });

  it("does not check at all when the clock-in wasn't late", async () => {
    const { service, prisma, oversight } = makeService();
    jest.setSystemTime(new Date("2026-10-05T04:35:00Z")); // 10:05 IST, inside grace
    await service.clockIn(user);
    expect(prisma.workSession.count).toHaveBeenCalledTimes(1); // only the earlier-today count
    expect(oversight.notify).not.toHaveBeenCalled();
  });

  it("never fails the clock-in if the alert blows up", async () => {
    const { service, prisma, oversight } = makeService();
    prisma.workSession.count.mockResolvedValueOnce(0).mockResolvedValueOnce(5);
    oversight.recipientsFor.mockRejectedValue(new Error("db down"));
    await expect(service.clockIn(user)).resolves.toBeDefined();
  });
});

describe("WorkSessionsService — correcting a forgotten clock-out", () => {
  const autoClosed = (over: Record<string, unknown> = {}) => ({
    id: "s1",
    userId: "u1",
    clockInAt: CLOCK_IN, // 10:00 IST
    clockOutAt: new Date("2026-10-05T13:30:00Z"), // closed at 19:00 IST
    autoClosed: true,
    correctionSubmittedAt: null,
    ...over,
  });
  const dto = (clockOutAt = "2026-10-05T12:00:00.000Z", note = "Left at 5:30pm") => ({ clockOutAt, note });

  it("finds the oldest uncorrected auto-closed session from the last 14 days", async () => {
    const { service, prisma } = makeService();
    prisma.workSession.findFirst.mockResolvedValue(autoClosed());
    await service.getPendingCorrection("u1");
    const q = prisma.workSession.findFirst.mock.calls[0][0];
    expect(q.where).toMatchObject({ userId: "u1", autoClosed: true, correctionSubmittedAt: null });
    expect(q.where.clockInAt.gte).toEqual(new Date("2026-09-21T05:00:00Z"));
    expect(q.orderBy).toEqual({ clockInAt: "asc" });
  });

  it("records the real clock-out, recalculates the duration, and keeps the note", async () => {
    const { service, prisma } = makeService();
    prisma.workSession.findFirst.mockResolvedValue(autoClosed());
    await service.submitCorrection(user, "s1", dto("2026-10-05T04:50:00.000Z", "  Left at 5:30pm  ")); // within 14h of clock-in, before NOW
    const data = prisma.workSession.update.mock.calls[0][0].data;
    expect(data.clockOutAt).toEqual(new Date("2026-10-05T04:50:00.000Z"));
    expect(data.durationMin).toBe(20);
    expect(data.correctionNote).toBe("Left at 5:30pm");
    expect(data.correctionSubmittedAt).toBeInstanceOf(Date);
  });

  it("404s for someone else's session", async () => {
    const { service } = makeService();
    await expect(service.submitCorrection(user, "s1", dto())).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects a session that wasn't auto-closed", async () => {
    const { service, prisma } = makeService();
    prisma.workSession.findFirst.mockResolvedValue(autoClosed({ autoClosed: false }));
    await expect(service.submitCorrection(user, "s1", dto())).rejects.toThrow(/not closed automatically/);
  });

  it("rejects a second correction", async () => {
    const { service, prisma } = makeService();
    prisma.workSession.findFirst.mockResolvedValue(autoClosed({ correctionSubmittedAt: new Date() }));
    await expect(service.submitCorrection(user, "s1", dto())).rejects.toThrow(/already corrected/);
    expect(prisma.workSession.update).not.toHaveBeenCalled();
  });

  it.each([
    ["before they clocked in", "2026-10-05T04:00:00.000Z", /before you clocked in/],
    ["in the future", "2026-10-05T07:00:00.000Z", /future/],
  ])("rejects a time %s", async (_label, at, message) => {
    const { service, prisma } = makeService();
    prisma.workSession.findFirst.mockResolvedValue(autoClosed());
    await expect(service.submitCorrection(user, "s1", dto(at))).rejects.toThrow(message);
    expect(prisma.workSession.update).not.toHaveBeenCalled();
  });

  it("rejects a time more than 14 hours after clock-in", async () => {
    const { service, prisma } = makeService();
    jest.setSystemTime(new Date("2026-10-06T10:00:00Z")); // the next day, so it isn't "in the future"
    prisma.workSession.findFirst.mockResolvedValue(autoClosed());
    await expect(service.submitCorrection(user, "s1", dto("2026-10-05T19:00:00.000Z"))).rejects.toThrow(/14 hours/);
  });
});

describe("WorkSessionsService — rules set by Admin/HR are what gets applied", () => {
  it("a longer late grace period means a 30-minute-late arrival isn't late", async () => {
    const { service, prisma } = makeService({ lateGraceMin: 45 });
    await service.clockIn(user); // 10:30 IST vs 10:00 shift = 30 min
    expect(prisma.workSession.create.mock.calls[0][0].data.lateByMin).toBeNull();
  });

  it("a shorter one makes a 15-minute-late arrival late", async () => {
    const { service, prisma } = makeService({ lateGraceMin: 5 });
    jest.setSystemTime(new Date("2026-10-05T04:45:00Z")); // 10:15 IST
    await service.clockIn(user);
    expect(prisma.workSession.create.mock.calls[0][0].data.lateByMin).toBe(15);
  });

  it("looks the rules up for THIS user (so department overrides apply)", async () => {
    const { service, policy } = makeService();
    await service.clockIn(user);
    expect(policy.forUser).toHaveBeenCalledWith("u1");
  });

  it("the early-leave grace comes from the rules too", async () => {
    const { service, prisma } = makeService({ earlyGraceMin: 600 }); // 10h of slack: nothing is early
    prisma.workSession.findFirst.mockResolvedValue(activeSession());
    await expect(service.clockOut(user)).resolves.toBeDefined(); // 10:30 IST, shift ends 19:00
  });

  it("the idle threshold comes from the rules: 25 minutes is enough when the rule is 20", async () => {
    const { service, prisma } = makeService({ idlePromptMin: 20 });
    prisma.workSession.findFirst.mockResolvedValue(activeSession());
    await expect(
      service.submitIdleReason(user, { idleStartedAt: "2026-10-05T04:50:00.000Z", idleMinutes: 25, reason: "On a call" }),
    ).resolves.toBeDefined();
  });

  it("...and 25 minutes is refused when the rule is 45", async () => {
    const { service, prisma } = makeService({ idlePromptMin: 45 });
    prisma.workSession.findFirst.mockResolvedValue(activeSession());
    await expect(
      service.submitIdleReason(user, { idleStartedAt: "2026-10-05T04:50:00.000Z", idleMinutes: 25, reason: "On a call" }),
    ).rejects.toThrow(/under 45 minutes/);
  });

  it("the active-session response tells the app the idle limit and the minimum hours that apply", async () => {
    const { service, prisma } = makeService({ idlePromptMin: 20, minWorkMinutes: 480 });
    prisma.workSession.findFirst.mockResolvedValue(activeSession());
    const active = await service.getActive("u1");
    expect(active).toMatchObject({ idlePromptMinutes: 20, minWorkMinutes: 480 });
  });

  it("the repeat-late alert uses the configured threshold and window", async () => {
    const { service, prisma, oversight } = makeService({ repeatLateThreshold: 2, repeatLateWindowDays: 14 });
    prisma.workSession.count.mockResolvedValueOnce(0).mockResolvedValueOnce(2);
    prisma.user.findUnique
      .mockResolvedValueOnce({ shiftStart: "10:00", shiftEnd: "19:00" })
      .mockResolvedValueOnce({ id: "u1", firstName: "Eve", lastName: "Employee", departmentId: "d1", managerId: null });
    await service.clockIn(user);

    const where = prisma.workSession.count.mock.calls[1][0].where;
    expect(where.clockInAt.gte).toEqual(new Date("2026-09-21T05:00:00Z")); // 14 days back
    expect(oversight.notify).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ message: "Eve Employee has been late 2 times in the last 14 days." }),
    );
  });

  it("an excused late arrival does not count toward the repeat-late alert", async () => {
    const { service, prisma } = makeService();
    prisma.workSession.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    await service.clockIn(user);
    const where = prisma.workSession.count.mock.calls[1][0].where;
    expect(where.OR).toEqual([{ lateReviewStatus: null }, { lateReviewStatus: { not: ReasonReviewStatus.EXCUSED } }]);
  });
});

describe("WorkSessionsService — the desktop agent's idle signal", () => {
  it("passes on the agent's OS-level idle time when the agent is reporting", async () => {
    const { service, prisma } = makeService();
    prisma.workSession.findFirst.mockResolvedValue(activeSession());
    const seen = new Date("2026-10-05T04:59:00Z");
    prisma.activityPing.findFirst.mockResolvedValue({ idleSeconds: 42, capturedAt: seen });
    const active = await service.getActive("u1");
    expect(active).toMatchObject({ agentIdleSeconds: 42, agentSeenAt: seen });
    const where = prisma.activityPing.findFirst.mock.calls[0][0].where;
    expect(where.userId).toBe("u1");
    expect(where.capturedAt.gte).toEqual(new Date("2026-10-05T04:57:00Z")); // only pings from the last 3 min
  });

  it("is null when there is no agent (or no recent ping), so the browser's tracking is used", async () => {
    const { service, prisma } = makeService();
    prisma.workSession.findFirst.mockResolvedValue(activeSession());
    const active = await service.getActive("u1");
    expect(active).toMatchObject({ agentIdleSeconds: null, agentSeenAt: null });
  });

  it("never breaks the active-session call if the ping lookup fails", async () => {
    const { service, prisma } = makeService();
    prisma.workSession.findFirst.mockResolvedValue(activeSession());
    prisma.activityPing.findFirst.mockRejectedValue(new Error("db down"));
    await expect(service.getActive("u1")).resolves.toMatchObject({ agentIdleSeconds: null });
  });
});

describe("WorkSessionsService.reviewReason", () => {
  const hr = { ...user, id: "hr1", role: { id: "r", name: "EMPLOYEE" }, department: { id: "dHR", name: "HR", managerTitle: "M" } } as unknown as RequestUser;
  const admin = { ...user, id: "admin1", role: { id: "r", name: "ADMIN" }, department: null } as unknown as RequestUser;
  const manager = { ...user, id: "mgr1", role: { id: "r", name: "MANAGER" }, department: { id: "d1", name: "Recruitment", managerTitle: "M" } } as unknown as RequestUser;
  const otherManager = { ...manager, id: "mgr2", department: { id: "d9", name: "Sales", managerTitle: "M" } } as unknown as RequestUser;

  const lateSession = (over: Record<string, unknown> = {}) => ({
    id: "s1",
    userId: "u1",
    clockInAt: new Date("2026-10-05T05:00:00Z"),
    lateByMin: 30,
    earlyByMin: 20,
    user: { id: "u1", departmentId: "d1" },
    ...over,
  });
  const reviewPrisma = (over: Record<string, unknown> = {}) => {
    const made = makeService();
    made.prisma.workSession.findUnique = jest.fn().mockResolvedValue(lateSession(over));
    return made;
  };

  it.each([
    ["Admin", admin],
    ["HR", hr],
    ["the person's own department manager", manager],
  ])("lets %s excuse a late arrival", async (_label, reviewer) => {
    const { service, prisma } = reviewPrisma();
    await service.reviewReason(reviewer, "s1", { kind: "LATE", status: "EXCUSED" });
    const data = prisma.workSession.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ lateReviewStatus: ReasonReviewStatus.EXCUSED, lateReviewedById: reviewer.id });
    expect(data.lateReviewedAt).toBeInstanceOf(Date);
  });

  it("stops a manager from another department, and a plain employee", async () => {
    const { service, prisma } = reviewPrisma();
    await expect(service.reviewReason(otherManager, "s1", { kind: "LATE", status: "EXCUSED" })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.reviewReason({ ...user, id: "someone" } as RequestUser, "s1", { kind: "LATE", status: "EXCUSED" })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.workSession.update).not.toHaveBeenCalled();
  });

  it("nobody can review their own reasons, not even an Admin", async () => {
    const { service } = reviewPrisma({ userId: "admin1", user: { id: "admin1", departmentId: null } });
    await expect(service.reviewReason(admin, "s1", { kind: "LATE", status: "EXCUSED" })).rejects.toThrow(/own reasons/);
  });

  it("404s for an unknown session", async () => {
    const { service, prisma } = makeService();
    prisma.workSession.findUnique = jest.fn().mockResolvedValue(null);
    await expect(service.reviewReason(hr, "nope", { kind: "LATE", status: "EXCUSED" })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("only reviews what happened: no late arrival to review, or no early leave", async () => {
    const a = reviewPrisma({ lateByMin: null });
    await expect(a.service.reviewReason(hr, "s1", { kind: "LATE", status: "EXCUSED" })).rejects.toThrow(/wasn't a late arrival/);
    const b = reviewPrisma({ earlyByMin: null });
    await expect(b.service.reviewReason(hr, "s1", { kind: "EARLY", status: "EXCUSED" })).rejects.toThrow(/wasn't an early leave/);
  });

  it("rejecting needs a note; excusing doesn't", async () => {
    const { service, prisma } = reviewPrisma();
    await expect(service.reviewReason(hr, "s1", { kind: "LATE", status: "REJECTED" })).rejects.toThrow(/short note/);
    await expect(service.reviewReason(hr, "s1", { kind: "LATE", status: "REJECTED", note: "ab" })).rejects.toThrow(/short note/);
    await service.reviewReason(hr, "s1", { kind: "LATE", status: "REJECTED", note: "  Not a valid reason  " });
    expect(prisma.workSession.update.mock.calls[0][0].data).toMatchObject({
      lateReviewStatus: ReasonReviewStatus.REJECTED,
      lateReviewNote: "Not a valid reason",
    });
  });

  it("reviews the early-leave reason separately from the late one", async () => {
    const { service, prisma } = reviewPrisma();
    await service.reviewReason(hr, "s1", { kind: "EARLY", status: "EXCUSED", note: "Doctor's appointment" });
    const data = prisma.workSession.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ earlyReviewStatus: ReasonReviewStatus.EXCUSED, earlyReviewNote: "Doctor's appointment" });
    expect(data).not.toHaveProperty("lateReviewStatus");
  });

  it("PENDING clears an earlier decision completely", async () => {
    const { service, prisma, oversight } = reviewPrisma();
    await service.reviewReason(hr, "s1", { kind: "LATE", status: "PENDING", note: "ignored" });
    expect(prisma.workSession.update.mock.calls[0][0].data).toEqual({
      lateReviewStatus: null,
      lateReviewNote: null,
      lateReviewedById: null,
      lateReviewedAt: null,
    });
    expect(oversight.notify).not.toHaveBeenCalled(); // nothing to tell the employee
  });

  it("tells the employee the outcome, with the note", async () => {
    const { service, oversight } = reviewPrisma();
    await service.reviewReason(hr, "s1", { kind: "LATE", status: "EXCUSED", note: "Bus strike" });
    expect(oversight.notify).toHaveBeenCalledWith(
      ["u1"],
      expect.objectContaining({
        type: NotificationType.ATTENDANCE_REVIEWED,
        title: "✅ Reason accepted",
        link: "/attendance",
        message: "Your late arrival on 5 Oct was excused: Bus strike",
      }),
    );

    oversight.notify.mockClear();
    await service.reviewReason(hr, "s1", { kind: "EARLY", status: "REJECTED", note: "Not agreed in advance" });
    expect(oversight.notify.mock.calls[0][1]).toMatchObject({
      title: "❌ Reason not accepted",
      message: "Your early clock-out on 5 Oct was not accepted: Not agreed in advance",
    });
  });
});
