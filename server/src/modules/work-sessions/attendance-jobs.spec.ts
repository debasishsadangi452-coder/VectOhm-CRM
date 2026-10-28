import { Logger } from "@nestjs/common";
import { NotificationType } from "@prisma/client";
import { AttendanceJobsService } from "./attendance-jobs.service";
import { AttendanceOversightService } from "./attendance-oversight.service";
import { DEFAULT_POLICY, type AttendancePolicy } from "./work-policy";

// Monday 2026-10-05, 11:05 IST (05:35Z). IST = UTC+05:30.
const MON_1105 = new Date("2026-10-05T05:35:00Z");

type Over = Record<string, unknown>;

const employee = (id: string, over: Over = {}) => ({
  id,
  firstName: id.toUpperCase(),
  lastName: "Person",
  shiftStart: "10:00",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  departmentId: "dept1",
  managerId: null,
  ...over,
});

function makeJobs(policyOver: Partial<AttendancePolicy> = {}, deptOver: Record<string, Partial<AttendancePolicy>> = {}) {
  const prisma = {
    companyHoliday: { findUnique: jest.fn().mockResolvedValue(null) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    workSession: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    leaveRequest: { findMany: jest.fn().mockResolvedValue([]) },
    absenceRecord: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    workBreak: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const oversight = {
    getHrUserIds: jest.fn().mockResolvedValue(["hr1"]),
    recipientsFor: jest
      .fn()
      .mockImplementation((subject: { departmentId: string }, hr: string[]) =>
        Promise.resolve([...hr, `mgr-${subject.departmentId}`]),
      ),
    notify: jest.fn().mockResolvedValue(1),
  };
  const global = { ...DEFAULT_POLICY, ...policyOver };
  const policy = {
    getGlobal: jest.fn().mockResolvedValue(global),
    forDepartment: jest
      .fn()
      .mockImplementation((id: string | null) => Promise.resolve({ ...global, ...(id ? deptOver[id] : {}) })),
  };
  const jobs = new AttendanceJobsService(prisma as never, oversight as never, policy as never);
  return { jobs, prisma, oversight, policy };
}

beforeEach(() => {
  // The jobs log their (deliberately provoked) failures; keep test output readable.
  jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
});

// ───────────────────────── no-shows ─────────────────────────

describe("AttendanceJobsService.markAbsences", () => {
  it("marks someone absent an hour after their shift start when they never clocked in", async () => {
    const { jobs, prisma } = makeJobs();
    prisma.user.findMany.mockResolvedValue([employee("e1")]);
    await expect(jobs.markAbsences(MON_1105)).resolves.toEqual({ marked: 1 });

    expect(prisma.absenceRecord.createMany).toHaveBeenCalledWith({
      data: [{ userId: "e1", date: "2026-10-05" }],
      skipDuplicates: true,
    });
  });

  it("does nothing on a weekend", async () => {
    const { jobs, prisma } = makeJobs();
    prisma.user.findMany.mockResolvedValue([employee("e1")]);
    const sat = new Date("2026-10-03T05:35:00Z"); // Saturday 11:05 IST
    await expect(jobs.markAbsences(sat)).resolves.toEqual({ marked: 0 });
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.absenceRecord.createMany).not.toHaveBeenCalled();
  });

  it("does nothing on a company holiday", async () => {
    const { jobs, prisma } = makeJobs();
    prisma.companyHoliday.findUnique.mockResolvedValue({ name: "Diwali" });
    prisma.user.findMany.mockResolvedValue([employee("e1")]);
    await expect(jobs.markAbsences(MON_1105)).resolves.toEqual({ marked: 0 });
    expect(prisma.absenceRecord.createMany).not.toHaveBeenCalled();
  });

  it("waits until a full hour after THEIR shift starts", async () => {
    const { jobs, prisma } = makeJobs();
    prisma.user.findMany.mockResolvedValue([
      employee("early", { shiftStart: "09:00" }), // due from 10:00
      employee("normal", { shiftStart: "10:00" }), // due from 11:00
      employee("late", { shiftStart: "11:00" }), // due from 12:00 -- not yet at 11:05
    ]);
    await jobs.markAbsences(MON_1105);
    const ids = prisma.absenceRecord.createMany.mock.calls[0][0].data.map((r: { userId: string }) => r.userId);
    expect(ids).toEqual(["early", "normal"]);
  });

  it("is not yet due at 10:59 for a 10:00 shift, and is due at exactly 11:00", async () => {
    const a = makeJobs();
    a.prisma.user.findMany.mockResolvedValue([employee("e1")]);
    await expect(a.jobs.markAbsences(new Date("2026-10-05T05:29:00Z"))).resolves.toEqual({ marked: 0 }); // 10:59 IST

    const b = makeJobs();
    b.prisma.user.findMany.mockResolvedValue([employee("e1")]);
    await expect(b.jobs.markAbsences(new Date("2026-10-05T05:30:00Z"))).resolves.toEqual({ marked: 1 }); // 11:00 IST
  });

  it("skips anyone who clocked in today, is on approved leave, or is already marked", async () => {
    const { jobs, prisma } = makeJobs();
    prisma.user.findMany.mockResolvedValue([
      employee("worked"),
      employee("onleave"),
      employee("already"),
      employee("absent"),
    ]);
    prisma.workSession.findMany.mockResolvedValue([{ userId: "worked" }]);
    prisma.leaveRequest.findMany.mockResolvedValue([{ userId: "onleave" }]);
    prisma.absenceRecord.findMany.mockResolvedValue([{ userId: "already" }]);

    await expect(jobs.markAbsences(MON_1105)).resolves.toEqual({ marked: 1 });
    expect(prisma.absenceRecord.createMany.mock.calls[0][0].data).toEqual([{ userId: "absent", date: "2026-10-05" }]);
  });

  it("looks only at today's sessions and only APPROVED leave covering today", async () => {
    const { jobs, prisma } = makeJobs();
    prisma.user.findMany.mockResolvedValue([employee("e1")]);
    await jobs.markAbsences(MON_1105);

    const sessionWhere = prisma.workSession.findMany.mock.calls[0][0].where;
    expect(sessionWhere.clockInAt.gte).toEqual(new Date("2026-10-05T02:30:00Z")); // 08:00 IST today (shift day start)
    expect(sessionWhere.clockInAt.lt).toEqual(new Date("2026-10-06T02:30:00Z"));
    const leaveWhere = prisma.leaveRequest.findMany.mock.calls[0][0].where;
    expect(leaveWhere.status).toBe("APPROVED");
    expect(leaveWhere.startDate.lt).toEqual(new Date("2026-10-06T00:00:00Z"));
    expect(leaveWhere.endDate.gte).toEqual(new Date("2026-10-05T00:00:00Z"));
  });

  it("never marks a new hire absent on a day their account didn't exist yet at shift start", async () => {
    const { jobs, prisma } = makeJobs();
    prisma.user.findMany.mockResolvedValue([
      employee("newhire", { createdAt: new Date("2026-10-05T04:45:00Z") }), // 10:15 IST, after the 10:00 shift start
      employee("old"),
    ]);
    await jobs.markAbsences(MON_1105);
    const ids = prisma.absenceRecord.createMany.mock.calls[0][0].data.map((r: { userId: string }) => r.userId);
    expect(ids).toEqual(["old"]);
  });

  it("only asks about active users who are expected to clock in (not Admins)", async () => {
    const { jobs, prisma } = makeJobs();
    await jobs.markAbsences(MON_1105);
    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.isActive).toBe(true);
    expect(where.OR).toEqual([
      { role: { name: { notIn: ["ADMIN"] } } },
      { email: { in: ["jivan@venushiring.com"], mode: "insensitive" } },
    ]);
  });

  it("does nothing, quietly, when everyone is accounted for", async () => {
    const { jobs, prisma, oversight } = makeJobs();
    prisma.user.findMany.mockResolvedValue([employee("e1")]);
    prisma.workSession.findMany.mockResolvedValue([{ userId: "e1" }]);
    await expect(jobs.markAbsences(MON_1105)).resolves.toEqual({ marked: 0 });
    expect(prisma.absenceRecord.createMany).not.toHaveBeenCalled();
    expect(oversight.notify).not.toHaveBeenCalled();
  });

  describe("rules set by Admin/HR", () => {
    it("a department can wait longer before someone counts as absent", async () => {
      const { jobs, prisma } = makeJobs({}, { dept2: { absentAfterMin: 120 } }); // dept2: 2h after shift start
      prisma.user.findMany.mockResolvedValue([employee("a", { departmentId: "dept1" }), employee("b", { departmentId: "dept2" })]);
      await jobs.markAbsences(MON_1105); // 11:05 -- dept1 is due (11:00), dept2 isn't until 12:00
      const ids = prisma.absenceRecord.createMany.mock.calls[0][0].data.map((r: { userId: string }) => r.userId);
      expect(ids).toEqual(["a"]);
    });

    it("uses the company waiting time when a department has no override", async () => {
      const { jobs, prisma } = makeJobs({ absentAfterMin: 90 });
      prisma.user.findMany.mockResolvedValue([employee("a")]);
      await expect(jobs.markAbsences(MON_1105)).resolves.toEqual({ marked: 0 }); // 11:05 < 11:30
      await expect(jobs.markAbsences(new Date("2026-10-05T06:00:00Z"))).resolves.toEqual({ marked: 1 }); // 11:30
    });

    it("which weekdays are days off is a rule: with only Sunday off, Saturday is checked", async () => {
      const { jobs, prisma } = makeJobs({ weeklyOffDays: [0] });
      prisma.user.findMany.mockResolvedValue([employee("a")]);
      const sat = new Date("2026-10-03T05:35:00Z"); // Saturday 11:05 IST
      await expect(jobs.markAbsences(sat)).resolves.toEqual({ marked: 1 });
    });

    it("does nothing before absence tracking started", async () => {
      const { jobs, prisma } = makeJobs({ absenceTrackingStart: "2026-10-06" }); // starts tomorrow
      prisma.user.findMany.mockResolvedValue([employee("a")]);
      await expect(jobs.markAbsences(MON_1105)).resolves.toEqual({ marked: 0 });
      expect(prisma.absenceRecord.createMany).not.toHaveBeenCalled();
    });

    it("does mark absences on the tracking start day itself", async () => {
      const { jobs, prisma } = makeJobs({ absenceTrackingStart: "2026-10-05" });
      prisma.user.findMany.mockResolvedValue([employee("a")]);
      await expect(jobs.markAbsences(MON_1105)).resolves.toEqual({ marked: 1 });
    });
  });

  describe("telling the manager and HR", () => {
    it("sends ONE digest per recipient, listing only the people they are responsible for", async () => {
      const { jobs, prisma, oversight } = makeJobs();
      prisma.user.findMany.mockResolvedValue([
        employee("a", { departmentId: "dept1" }),
        employee("b", { departmentId: "dept1" }),
        employee("c", { departmentId: "dept2" }),
      ]);
      await jobs.markAbsences(MON_1105);

      const byRecipient = Object.fromEntries(oversight.notify.mock.calls.map(([ids, input]) => [ids[0], input.message]));
      expect(Object.keys(byRecipient).sort()).toEqual(["hr1", "mgr-dept1", "mgr-dept2"]);
      expect(byRecipient["hr1"]).toContain("3 people have not clocked in");
      expect(byRecipient["hr1"]).toContain("A Person, B Person, C Person");
      expect(byRecipient["mgr-dept1"]).toContain("2 people");
      expect(byRecipient["mgr-dept1"]).not.toContain("C Person");
      expect(byRecipient["mgr-dept2"]).toContain("1 person has not clocked in");
      expect(oversight.notify).toHaveBeenCalledTimes(3); // not one per absentee
    });

    it("uses the right type, title and link", async () => {
      const { jobs, prisma, oversight } = makeJobs();
      prisma.user.findMany.mockResolvedValue([employee("a")]);
      await jobs.markAbsences(MON_1105);
      expect(oversight.notify.mock.calls[0][1]).toMatchObject({
        type: NotificationType.ATTENDANCE_ABSENT,
        title: "🚫 Not clocked in",
        link: "/attendance",
      });
    });

    it("looks up HR once and reuses it for everyone", async () => {
      const { jobs, prisma, oversight } = makeJobs();
      prisma.user.findMany.mockResolvedValue([employee("a"), employee("b"), employee("c")]);
      await jobs.markAbsences(MON_1105);
      expect(oversight.getHrUserIds).toHaveBeenCalledTimes(1);
      for (const call of oversight.recipientsFor.mock.calls) expect(call[1]).toEqual(["hr1"]);
    });

    it("lists at most 8 names then says how many more", async () => {
      const { jobs, prisma, oversight } = makeJobs();
      prisma.user.findMany.mockResolvedValue(Array.from({ length: 11 }, (_, i) => employee(`p${i}`)));
      await jobs.markAbsences(MON_1105);
      const hr = oversight.notify.mock.calls.find(([ids]) => ids[0] === "hr1")![1].message;
      expect(hr).toContain("11 people have not clocked in");
      expect(hr).toContain("and 3 more");
      expect(hr).not.toContain("P8 Person");
    });
  });
});

// ───────────────────────── forgotten clock-outs ─────────────────────────

describe("AttendanceJobsService.closeForgottenSessions", () => {
  // Mon 2026-10-05 10:00 IST clock-in; it is now Tue 01:00 IST (15h later).
  const NOW = new Date("2026-10-05T19:30:00Z");
  const stale = (over: Over = {}) => ({
    id: "s1",
    userId: "e1",
    clockInAt: new Date("2026-10-05T04:30:00Z"),
    user: { id: "e1", shiftStart: "10:00", shiftEnd: "19:00" },
    ...over,
  });

  it("looks for open sessions older than 14 hours", async () => {
    const { jobs, prisma } = makeJobs();
    await jobs.closeForgottenSessions(NOW);
    const where = prisma.workSession.findMany.mock.calls[0][0].where;
    expect(where.clockOutAt).toBeNull();
    expect(where.clockInAt.lte).toEqual(new Date("2026-10-05T05:30:00Z"));
  });

  it("the maximum open time is a rule: with a 6-hour limit the session is closed no later than 6 hours after clock-in", async () => {
    const { jobs, prisma } = makeJobs({ maxOpenSessionHours: 6 });
    prisma.workSession.findMany.mockResolvedValue([stale()]); // clocked in 10:00 IST; shift would end 19:00
    await jobs.closeForgottenSessions(NOW);
    expect(prisma.workSession.findMany.mock.calls[0][0].where.clockInAt.lte).toEqual(new Date(NOW.getTime() - 6 * 3600_000));
    // Shift end (19:00) is 9h after clock-in, so the 6h cap wins: 16:00 IST.
    expect(prisma.workSession.updateMany.mock.calls[0][0].data.clockOutAt).toEqual(new Date("2026-10-05T10:30:00Z"));
  });

  it("closes it at the end of their shift, flags it, and tells the employee", async () => {
    const { jobs, prisma, oversight } = makeJobs();
    prisma.workSession.findMany.mockResolvedValue([stale()]);
    await expect(jobs.closeForgottenSessions(NOW)).resolves.toEqual({ closed: 1 });

    expect(prisma.workSession.updateMany).toHaveBeenCalledWith({
      where: { id: "s1", clockOutAt: null },
      data: {
        clockOutAt: new Date("2026-10-05T13:30:00Z"), // 19:00 IST
        durationMin: 540, // 9 hours
        autoClosed: true,
        autoClosedAt: NOW,
      },
    });
    expect(oversight.notify).toHaveBeenCalledWith(
      ["e1"],
      expect.objectContaining({
        type: NotificationType.ATTENDANCE_NO_CLOCKOUT,
        title: "⏱ You didn't clock out",
        link: "/attendance",
      }),
    );
  });

  it("uses each person's own shift end", async () => {
    const { jobs, prisma } = makeJobs();
    prisma.workSession.findMany.mockResolvedValue([stale({ user: { id: "e1", shiftStart: "09:00", shiftEnd: "18:00" } })]);
    await jobs.closeForgottenSessions(NOW);
    expect(prisma.workSession.updateMany.mock.calls[0][0].data.clockOutAt).toEqual(new Date("2026-10-05T12:30:00Z"));
  });

  it("closes a break that was left open, no longer than the 1-hour maximum", async () => {
    const { jobs, prisma } = makeJobs();
    prisma.workSession.findMany.mockResolvedValue([stale()]);
    prisma.workBreak.findMany.mockResolvedValue([{ id: "b1", startedAt: new Date("2026-10-05T07:00:00Z") }]);
    await jobs.closeForgottenSessions(NOW);
    expect(prisma.workBreak.update).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: { endedAt: new Date("2026-10-05T08:00:00Z"), durationMin: 60, autoEnded: true },
    });
  });

  it("does not notify when a real clock-out landed first (nothing was updated)", async () => {
    const { jobs, prisma, oversight } = makeJobs();
    prisma.workSession.findMany.mockResolvedValue([stale()]);
    prisma.workSession.updateMany.mockResolvedValue({ count: 0 });
    await expect(jobs.closeForgottenSessions(NOW)).resolves.toEqual({ closed: 0 });
    expect(oversight.notify).not.toHaveBeenCalled();
  });

  it("one session failing doesn't stop the others", async () => {
    const { jobs, prisma } = makeJobs();
    prisma.workSession.findMany.mockResolvedValue([stale({ id: "bad" }), stale({ id: "good" })]);
    prisma.workSession.updateMany.mockRejectedValueOnce(new Error("db hiccup")).mockResolvedValue({ count: 1 });
    await expect(jobs.closeForgottenSessions(NOW)).resolves.toEqual({ closed: 1 });
    expect(prisma.workSession.updateMany).toHaveBeenCalledTimes(2);
  });

  it("does nothing when no session is stale", async () => {
    const { jobs, prisma, oversight } = makeJobs();
    await expect(jobs.closeForgottenSessions(NOW)).resolves.toEqual({ closed: 0 });
    expect(prisma.workSession.updateMany).not.toHaveBeenCalled();
    expect(oversight.notify).not.toHaveBeenCalled();
  });
});

describe("AttendanceJobsService.runAll", () => {
  it("runs both checks, and a failure in one doesn't stop the other", async () => {
    const { jobs } = makeJobs();
    const absences = jest.spyOn(jobs, "markAbsences").mockRejectedValue(new Error("boom"));
    const closing = jest.spyOn(jobs, "closeForgottenSessions").mockResolvedValue({ closed: 0 });
    await expect(jobs.runAll()).resolves.toBeUndefined();
    expect(absences).toHaveBeenCalled();
    expect(closing).toHaveBeenCalled();
  });
});

// ───────────────────────── recipients ─────────────────────────

describe("AttendanceOversightService", () => {
  function makeOversight() {
    const prisma = { user: { findMany: jest.fn().mockResolvedValue([]) } };
    const notifications = { create: jest.fn().mockResolvedValue({}) };
    return { service: new AttendanceOversightService(prisma as never, notifications as never), prisma, notifications };
  }

  it("HR users are matched by department name, not by a loose substring", async () => {
    const { service, prisma } = makeOversight();
    prisma.user.findMany.mockResolvedValue([
      { id: "hr1", department: { name: "HR" } },
      { id: "hr2", department: { name: "Human Resources" } },
      { id: "no1", department: { name: "Shrewsbury Sales" } },
      { id: "no2", department: { name: "Threshold Ops" } },
    ]);
    await expect(service.getHrUserIds()).resolves.toEqual(["hr1", "hr2"]);
  });

  it("recipients are the direct manager, the department's managers and HR -- never the person themselves", async () => {
    const { service, prisma } = makeOversight();
    prisma.user.findMany.mockResolvedValue([{ id: "mgrA" }, { id: "e1" }]); // dept managers (one is the subject)
    const ids = await service.recipientsFor({ id: "e1", departmentId: "d1", managerId: "mgrB" }, ["hr1"]);
    expect(ids.sort()).toEqual(["hr1", "mgrA", "mgrB"]);
    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ isActive: true, departmentId: "d1", role: { name: "MANAGER" } });
  });

  it("de-duplicates when the direct manager is also a department manager", async () => {
    const { service, prisma } = makeOversight();
    prisma.user.findMany.mockResolvedValue([{ id: "mgrA" }]);
    const ids = await service.recipientsFor({ id: "e1", departmentId: "d1", managerId: "mgrA" }, []);
    expect(ids).toEqual(["mgrA"]);
  });

  it("skips the department lookup for someone with no department", async () => {
    const { service, prisma } = makeOversight();
    const ids = await service.recipientsFor({ id: "e1", departmentId: null, managerId: null }, ["hr1"]);
    expect(ids).toEqual(["hr1"]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("notify sends to everyone, tolerates a failure, and counts deliveries", async () => {
    const { service, notifications } = makeOversight();
    notifications.create.mockRejectedValueOnce(new Error("socket down"));
    const delivered = await service.notify(["a", "b", "c"], {
      type: NotificationType.ATTENDANCE_ABSENT,
      title: "t",
      message: "m",
    });
    expect(delivered).toBe(2);
    expect(notifications.create.mock.calls.map(([c]) => c.userId)).toEqual(["a", "b", "c"]);
  });
});
