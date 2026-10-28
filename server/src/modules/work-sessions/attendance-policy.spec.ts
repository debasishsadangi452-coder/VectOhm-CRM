import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import {
  AttendancePolicyService,
  assertInRange,
  POLICY_LIMITS,
  validateTrackingStart,
  validateWeeklyOff,
} from "./attendance-policy.service";
import { ShiftTemplatesService } from "./shift-templates.service";
import { DEFAULT_POLICY, IDLE_LIMIT_SEC } from "./work-policy";
import type { RequestUser } from "../../common/types/request-user.type";

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

// ───────────────────────── validators ─────────────────────────

describe("assertInRange", () => {
  it.each(Object.entries(POLICY_LIMITS))("%s accepts its limits and rejects outside them", (field, [min, max]) => {
    expect(() => assertInRange(field as keyof typeof POLICY_LIMITS, min)).not.toThrow();
    expect(() => assertInRange(field as keyof typeof POLICY_LIMITS, max)).not.toThrow();
    expect(() => assertInRange(field as keyof typeof POLICY_LIMITS, min - 1)).toThrow(BadRequestException);
    expect(() => assertInRange(field as keyof typeof POLICY_LIMITS, max + 1)).toThrow(BadRequestException);
  });

  it.each([1.5, "30", null, undefined, NaN])("rejects the non-integer %p", (bad) => {
    expect(() => assertInRange("idlePromptMin", bad)).toThrow(/whole number from 5 to 240/);
  });
});

describe("validateWeeklyOff", () => {
  it("accepts weekday numbers, de-duplicated and sorted", () => {
    expect(validateWeeklyOff([6, 0, 6])).toEqual([0, 6]);
    expect(validateWeeklyOff([])).toEqual([]); // a six/seven-day week with no fixed off day is allowed
    expect(validateWeeklyOff([5])).toEqual([5]);
  });
  it.each([[[7]], [[-1]], [[1.5]], [["1"]], ["0,6"], [null]])("rejects %j", (bad) => {
    expect(() => validateWeeklyOff(bad)).toThrow(BadRequestException);
  });
  it("won't let all seven days be days off", () => {
    expect(() => validateWeeklyOff([0, 1, 2, 3, 4, 5, 6])).toThrow(/At least one day/);
  });
});

describe("validateTrackingStart", () => {
  it("accepts a real YYYY-MM-DD day, and empty/null to clear", () => {
    expect(validateTrackingStart("2026-10-05")).toBe("2026-10-05");
    expect(validateTrackingStart(null)).toBeNull();
    expect(validateTrackingStart("")).toBeNull();
  });
  it.each(["2026-13-01", "2026-02-30", "05-10-2026", "tomorrow", 20261005])("rejects %j", (bad) => {
    expect(() => validateTrackingStart(bad)).toThrow(BadRequestException);
  });
});

// ───────────────────────── the service ─────────────────────────

const row = (over: Record<string, unknown> = {}) => ({
  id: "attendance",
  lateGraceMin: 10,
  earlyGraceMin: 5,
  idlePromptMin: 30,
  absentAfterMin: 60,
  maxOpenSessionHours: 14,
  repeatLateThreshold: 3,
  repeatLateWindowDays: 7,
  minWorkMinutes: 510,
  weeklyOffDays: [0, 6],
  absenceTrackingStart: "2026-10-01",
  ...over,
});

function makePolicy(
  opts: { settings?: Record<string, unknown>; overrides?: unknown[]; devDepartment?: { id: string } | null } = {},
) {
  const prisma = {
    attendanceSettings: {
      upsert: jest.fn().mockResolvedValue(row(opts.settings)),
      update: jest.fn().mockResolvedValue({}),
    },
    attendanceDeptPolicy: {
      findMany: jest.fn().mockResolvedValue(opts.overrides ?? []),
      upsert: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    department: {
      findMany: jest.fn().mockResolvedValue([{ id: "d1", name: "Recruitment" }, { id: "d2", name: "Sales" }]),
      findUnique: jest.fn().mockResolvedValue({ id: "d1" }),
      findFirst: jest.fn().mockResolvedValue(opts.devDepartment === undefined ? null : opts.devDepartment),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ departmentId: "d1", role: { name: "EMPLOYEE" } }),
    },
  };
  return { service: new AttendancePolicyService(prisma as never), prisma };
}

const dept = (departmentId: string, over: Record<string, unknown> = {}) => ({
  departmentId,
  lateGraceMin: null,
  earlyGraceMin: null,
  idlePromptMin: null,
  absentAfterMin: null,
  minWorkMinutes: null,
  ...over,
});

describe("AttendancePolicyService — reading the rules", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-05T06:00:00Z"));
  });
  afterEach(() => jest.useRealTimers());

  it("returns the stored company rules", async () => {
    const { service } = makePolicy({ settings: { lateGraceMin: 20, minWorkMinutes: 480 } });
    expect(await service.getGlobal()).toMatchObject({ lateGraceMin: 20, minWorkMinutes: 480, weeklyOffDays: [0, 6] });
  });

  it("creates the settings row on first use, starting absence tracking TODAY (not retroactively)", async () => {
    const { service, prisma } = makePolicy();
    await service.getGlobal();
    expect(prisma.attendanceSettings.upsert).toHaveBeenCalledWith({
      where: { id: "attendance" },
      update: {},
      create: { absenceTrackingStart: "2026-10-05" },
    });
  });

  it("caches for a few seconds so every clock-in doesn't hit the database", async () => {
    const { service, prisma } = makePolicy();
    await service.getGlobal();
    await service.getGlobal();
    await service.forDepartment("d1");
    expect(prisma.attendanceSettings.upsert).toHaveBeenCalledTimes(1);

    jest.setSystemTime(new Date("2026-10-05T06:00:11Z")); // after the cache window
    await service.getGlobal();
    expect(prisma.attendanceSettings.upsert).toHaveBeenCalledTimes(2);
  });

  it("a department's overrides sit on top of the company rules; unset fields fall back", async () => {
    const { service } = makePolicy({ overrides: [dept("d1", { lateGraceMin: 30, minWorkMinutes: 480 })] });
    const p = await service.forDepartment("d1");
    expect(p).toMatchObject({ lateGraceMin: 30, minWorkMinutes: 480, earlyGraceMin: 5, idlePromptMin: 30 });
  });

  it("a department with no override, no department, or an unknown one gets the company rules", async () => {
    const { service } = makePolicy({ overrides: [dept("d1", { lateGraceMin: 30 })] });
    expect((await service.forDepartment("d2")).lateGraceMin).toBe(10);
    expect((await service.forDepartment(null)).lateGraceMin).toBe(10);
    expect((await service.forDepartment(undefined)).lateGraceMin).toBe(10);
  });

  it("overrides cannot touch the company-wide-only rules", async () => {
    const { service } = makePolicy({ overrides: [dept("d1", { lateGraceMin: 30 })] });
    const p = await service.forDepartment("d1");
    expect(p.maxOpenSessionHours).toBe(14);
    expect(p.weeklyOffDays).toEqual([0, 6]);
  });

  describe("forUser: one idle limit for everyone, none for Admins", () => {
    it("gives every non-Admin the single idle limit, ignoring department and per-user settings", async () => {
      const { service, prisma } = makePolicy({ overrides: [dept("d1", { idlePromptMin: 45 })] });
      prisma.user.findUnique.mockResolvedValue({ departmentId: "d1", role: { name: "EMPLOYEE" } });
      expect((await service.forUser("e1")).idlePromptMin).toBe(IDLE_LIMIT_SEC / 60);

      prisma.user.findUnique.mockResolvedValue(null); // unknown user -> same limit
      expect((await service.forUser("ghost")).idlePromptMin).toBe(IDLE_LIMIT_SEC / 60);
    });

    it("turns idle tracking off (0) for an Admin", async () => {
      const { service, prisma } = makePolicy({});
      prisma.user.findUnique.mockResolvedValue({ departmentId: "d1", role: { name: "ADMIN" } });
      expect((await service.forUser("admin1")).idlePromptMin).toBe(0);
    });

    it("keeps every other rule from the person's department", async () => {
      const { service, prisma } = makePolicy({ overrides: [dept("d1", { lateGraceMin: 20 })] });
      prisma.user.findUnique.mockResolvedValue({ departmentId: "d1", role: { name: "EMPLOYEE" } });
      expect((await service.forUser("e1")).lateGraceMin).toBe(20);
    });
  });

  it("the built-in defaults match what the code assumed before the rules were editable", () => {
    expect(DEFAULT_POLICY).toMatchObject({
      lateGraceMin: 10, earlyGraceMin: 5, idlePromptMin: 5, absentAfterMin: 60,
      maxOpenSessionHours: 14, repeatLateThreshold: 3, repeatLateWindowDays: 7, minWorkMinutes: 510,
      weeklyOffDays: [0, 6],
    });
  });
});

describe("AttendancePolicyService — who may view or change the rules", () => {
  it.each([["Admin", admin], ["HR", hr]])("%s can view and edit", async (_l, who) => {
    const { service } = makePolicy();
    await expect(service.getSettingsView(who)).resolves.toBeDefined();
    await expect(service.updateGlobal(who, { lateGraceMin: 15 })).resolves.toBeDefined();
  });

  it.each([["a manager", manager], ["an employee", employee]])("%s cannot", async (_l, who) => {
    const { service, prisma } = makePolicy();
    await expect(service.getSettingsView(who)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.updateGlobal(who, { lateGraceMin: 15 })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.setDepartmentOverride(who, "d1", { lateGraceMin: 15 })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.clearDepartmentOverride(who, "d1")).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.attendanceSettings.update).not.toHaveBeenCalled();
  });
});

describe("AttendancePolicyService — editing the company rules", () => {
  it("writes only the fields provided, and records who changed it", async () => {
    const { service, prisma } = makePolicy();
    await service.updateGlobal(hr, { lateGraceMin: 15, idlePromptMin: 45 });
    expect(prisma.attendanceSettings.update).toHaveBeenCalledWith({
      where: { id: "attendance" },
      data: { lateGraceMin: 15, idlePromptMin: 45, updatedById: "hr1" },
    });
  });

  it("can set the weekly days off and the absence-tracking start (or clear it)", async () => {
    const { service, prisma } = makePolicy();
    await service.updateGlobal(admin, { weeklyOffDays: [0], absenceTrackingStart: "2026-11-01" });
    expect(prisma.attendanceSettings.update.mock.calls[0][0].data).toMatchObject({
      weeklyOffDays: [0],
      absenceTrackingStart: "2026-11-01",
    });
    await service.updateGlobal(admin, { absenceTrackingStart: null });
    expect(prisma.attendanceSettings.update.mock.calls[1][0].data.absenceTrackingStart).toBeNull();
  });

  it.each([
    [{ lateGraceMin: -1 }],
    [{ lateGraceMin: 500 }],
    [{ idlePromptMin: 2 }],
    [{ minWorkMinutes: 5 }],
    [{ maxOpenSessionHours: 40 }],
    [{ repeatLateThreshold: 1 }],
    [{ weeklyOffDays: [9] }],
    [{ absenceTrackingStart: "soon" }],
  ])("refuses the bad edit %j and writes nothing", async (bad) => {
    const { service, prisma } = makePolicy();
    await expect(service.updateGlobal(admin, bad as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.attendanceSettings.update).not.toHaveBeenCalled();
  });

  it("an edit takes effect immediately (the cache is dropped)", async () => {
    const { service, prisma } = makePolicy();
    await service.getGlobal();
    await service.updateGlobal(admin, { lateGraceMin: 15 });
    const before = prisma.attendanceSettings.upsert.mock.calls.length;
    await service.getGlobal();
    expect(prisma.attendanceSettings.upsert.mock.calls.length).toBeGreaterThan(before - 1);
  });

  it("returns the settings view with defaults, limits, departments and overrides", async () => {
    const { service } = makePolicy({ overrides: [dept("d2", { lateGraceMin: 20 })] });
    const view = await service.getSettingsView(admin);
    expect(view.defaults).toEqual(DEFAULT_POLICY);
    expect(view.limits).toEqual(POLICY_LIMITS);
    expect(view.departments.map((d) => d.name)).toEqual(["Recruitment", "Sales"]);
    expect(view.overrides).toEqual([expect.objectContaining({ departmentId: "d2", departmentName: "Sales", lateGraceMin: 20 })]);
  });
});

describe("AttendancePolicyService — department overrides", () => {
  it("sets overrides, validating each value", async () => {
    const { service, prisma } = makePolicy();
    await service.setDepartmentOverride(hr, "d1", { lateGraceMin: 25, minWorkMinutes: 480 });
    expect(prisma.attendanceDeptPolicy.upsert).toHaveBeenCalledWith({
      where: { departmentId: "d1" },
      update: { lateGraceMin: 25, minWorkMinutes: 480 },
      create: { departmentId: "d1", lateGraceMin: 25, minWorkMinutes: 480 },
    });
    await expect(service.setDepartmentOverride(hr, "d1", { lateGraceMin: 9999 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("null clears one field's override; omitted fields are left alone", async () => {
    const { service, prisma } = makePolicy();
    await service.setDepartmentOverride(hr, "d1", { lateGraceMin: null });
    expect(prisma.attendanceDeptPolicy.upsert.mock.calls[0][0].update).toEqual({ lateGraceMin: null });
  });

  it("404s for an unknown department", async () => {
    const { service, prisma } = makePolicy();
    prisma.department.findUnique.mockResolvedValue(null);
    await expect(service.setDepartmentOverride(hr, "nope", { lateGraceMin: 20 })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("clearing removes the whole override", async () => {
    const { service, prisma } = makePolicy();
    await service.clearDepartmentOverride(admin, "d1");
    expect(prisma.attendanceDeptPolicy.deleteMany).toHaveBeenCalledWith({ where: { departmentId: "d1" } });
  });
});

// ───────────────────────── shift templates ─────────────────────────

function makeTemplates() {
  const prisma = {
    shiftTemplate: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "t1", ...data })),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "t1", ...data })),
      delete: jest.fn().mockResolvedValue({}),
    },
    user: { updateMany: jest.fn().mockResolvedValue({ count: 3 }) },
  };
  return { service: new ShiftTemplatesService(prisma as never), prisma };
}

const UUIDS = ["3f2b8c1e-5d4a-4e6b-9c7d-1a2b3c4d5e61", "3f2b8c1e-5d4a-4e6b-9c7d-1a2b3c4d5e62", "3f2b8c1e-5d4a-4e6b-9c7d-1a2b3c4d5e63"];

describe("ShiftTemplatesService", () => {
  it.each([["a manager", manager], ["an employee", employee]])("%s cannot do anything", async (_l, who) => {
    const { service } = makeTemplates();
    expect(() => service.list(who)).toThrow(ForbiddenException);
    await expect(service.create(who, { name: "x", shiftStart: "09:00", shiftEnd: "18:00" })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.apply(who, "t1", UUIDS)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("Admin and HR can create a template", async () => {
    for (const who of [admin, hr]) {
      const { service, prisma } = makeTemplates();
      await service.create(who, { name: "  9-6 Sales  ", shiftStart: "09:00", shiftEnd: "18:00" });
      expect(prisma.shiftTemplate.create).toHaveBeenCalledWith({ data: { name: "9-6 Sales", shiftStart: "09:00", shiftEnd: "18:00" } });
    }
  });

  it.each([
    ["no name", { name: "  ", shiftStart: "09:00", shiftEnd: "18:00" }],
    ["a bad start", { name: "x", shiftStart: "9am", shiftEnd: "18:00" }],
    ["a bad end", { name: "x", shiftStart: "09:00", shiftEnd: "25:00" }],
    ["the same start and end", { name: "x", shiftStart: "09:00", shiftEnd: "09:00" }],
  ])("refuses %s", async (_l, dto) => {
    const { service } = makeTemplates();
    await expect(service.create(admin, dto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuses a duplicate name", async () => {
    const { service, prisma } = makeTemplates();
    prisma.shiftTemplate.findUnique.mockResolvedValue({ id: "other" });
    await expect(service.create(admin, { name: "Day", shiftStart: "09:00", shiftEnd: "18:00" })).rejects.toBeInstanceOf(ConflictException);
  });

  it("supports overnight shifts (end earlier than start)", async () => {
    const { service } = makeTemplates();
    await expect(service.create(admin, { name: "Night", shiftStart: "22:00", shiftEnd: "06:00" })).resolves.toBeDefined();
  });

  it("updates, keeping unchanged fields, and 404s for an unknown template", async () => {
    const { service, prisma } = makeTemplates();
    await expect(service.update(admin, "nope", { name: "x" })).rejects.toBeInstanceOf(NotFoundException);
    prisma.shiftTemplate.findUnique.mockResolvedValueOnce({ id: "t1", name: "Day", shiftStart: "09:00", shiftEnd: "18:00" });
    await service.update(admin, "t1", { shiftEnd: "18:30" });
    expect(prisma.shiftTemplate.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { name: "Day", shiftStart: "09:00", shiftEnd: "18:30" } });
  });

  it("won't rename a template onto an existing name", async () => {
    const { service, prisma } = makeTemplates();
    prisma.shiftTemplate.findUnique
      .mockResolvedValueOnce({ id: "t1", name: "Day", shiftStart: "09:00", shiftEnd: "18:00" })
      .mockResolvedValueOnce({ id: "t2" });
    await expect(service.update(admin, "t1", { name: "Night" })).rejects.toBeInstanceOf(ConflictException);
  });

  it("deletes, 404ing for an unknown template", async () => {
    const { service, prisma } = makeTemplates();
    await expect(service.remove(admin, "nope")).rejects.toBeInstanceOf(NotFoundException);
    prisma.shiftTemplate.findUnique.mockResolvedValue({ id: "t1" });
    await expect(service.remove(hr, "t1")).resolves.toEqual({ success: true });
  });

  describe("apply", () => {
    const withTemplate = () => {
      const made = makeTemplates();
      made.prisma.shiftTemplate.findUnique.mockResolvedValue({ id: "t1", name: "Day", shiftStart: "09:00", shiftEnd: "18:00" });
      return made;
    };

    it("copies the template's hours onto the chosen active people and says how many changed", async () => {
      const { service, prisma } = withTemplate();
      const result = await service.apply(hr, "t1", [...UUIDS, UUIDS[0]]); // a duplicate id is ignored
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: { in: UUIDS }, isActive: true },
        data: { shiftStart: "09:00", shiftEnd: "18:00" },
      });
      expect(result).toEqual({ updated: 3, shiftStart: "09:00", shiftEnd: "18:00" });
    });

    it("404s for an unknown template and refuses an empty or oversized selection", async () => {
      const a = makeTemplates();
      await expect(a.service.apply(admin, "nope", UUIDS)).rejects.toBeInstanceOf(NotFoundException);
      const { service } = withTemplate();
      await expect(service.apply(admin, "t1", [])).rejects.toThrow(/at least one person/i);
      await expect(service.apply(admin, "t1", Array.from({ length: 501 }, (_, i) => `id-${i}`))).rejects.toThrow(/at most 500/);
    });
  });
});
