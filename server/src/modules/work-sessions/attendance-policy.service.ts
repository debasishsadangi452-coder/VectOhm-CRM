import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { isHrUser } from "../../common/utils/directory-access";
import type { RequestUser } from "../../common/types/request-user.type";
import { AttendancePolicy, DEFAULT_POLICY, IDLE_LIMIT_SEC, dayKey, isValidDayKey } from "./work-policy";

// Per company policy, Admin always gets the Dev department's idle-prompt
// timing (set via the Dev department override below), regardless of which
// department an Admin account happens to sit in -- an Admin who's also in Dev
// would already get this through the department override alone, but this
// makes it true for every Admin, not just by coincidence of their own
// department. Everyone else is unaffected: resolved purely by their own
// department, same as before.
const ADMIN_IDLE_DEPARTMENT_NAME = "Dev";

/** The rules that can be set per department; everything else is company-wide. */
export const DEPT_POLICY_FIELDS = [
  "lateGraceMin",
  "earlyGraceMin",
  "idlePromptMin",
  "absentAfterMin",
  "minWorkMinutes",
] as const;
export type DeptPolicyField = (typeof DEPT_POLICY_FIELDS)[number];
export type DeptPolicyOverride = Partial<Record<DeptPolicyField, number | null>>;

// Per-user overrides for idle prompt time (in minutes).
export const USER_IDLE_OVERRIDES: Record<string, number> = {
  "sourav@venushiring.com": 20,
  "jivan@venushiring.com": 180,
};

/** Allowed range for each rule -- stops a typo from turning a rule into nonsense. */
export const POLICY_LIMITS: Record<Exclude<keyof AttendancePolicy, "weeklyOffDays" | "absenceTrackingStart">, [number, number]> = {
  lateGraceMin: [0, 180],
  earlyGraceMin: [0, 180],
  idlePromptMin: [5, 240],
  absentAfterMin: [15, 600],
  maxOpenSessionHours: [4, 24],
  repeatLateThreshold: [2, 30],
  repeatLateWindowDays: [1, 90],
  minWorkMinutes: [60, 1440],
};

const CACHE_MS = 10_000;

export function assertInRange(field: keyof typeof POLICY_LIMITS, value: unknown): asserts value is number {
  const [min, max] = POLICY_LIMITS[field];
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new BadRequestException(`${field} must be a whole number from ${min} to ${max}.`);
  }
}

export function validateWeeklyOff(days: unknown): number[] {
  if (!Array.isArray(days) || days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    throw new BadRequestException("weeklyOffDays must be weekday numbers from 0 (Sunday) to 6 (Saturday).");
  }
  const unique = Array.from(new Set(days as number[])).sort();
  if (unique.length >= 7) throw new BadRequestException("At least one day of the week must be a working day.");
  return unique;
}

export function validateTrackingStart(value: unknown): string | null {
  if (value === null || value === "") return null;
  if (!isValidDayKey(value)) {
    throw new BadRequestException("absenceTrackingStart must be a valid YYYY-MM-DD day (or empty).");
  }
  return value;
}

export type GlobalPolicyPatch = Partial<Omit<AttendancePolicy, "weeklyOffDays" | "absenceTrackingStart">> & {
  weeklyOffDays?: number[];
  absenceTrackingStart?: string | null;
};

interface Loaded {
  at: number;
  global: AttendancePolicy;
  departments: Map<string, DeptPolicyOverride>;
  /** The Dev department's id, if one exists -- see ADMIN_IDLE_DEPARTMENT_NAME. */
  devDepartmentId: string | null;
  /** Seconds of OS idle time below which an activity ping counts as active. */
  activeGapSec: number;
}


/**
 * The attendance rules in force. Reads are cached for a few seconds (every clock
 * in/out, job tick and page load asks for them); any edit clears the cache.
 * Resolution order for a person: their department's override, else the company
 * setting, else the built-in default.
 */
@Injectable()
export class AttendancePolicyService {
  private cache: Loaded | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private async load(): Promise<Loaded> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache;

    // Created on first use so `absenceTrackingStart` is "the day this was turned
    // on" -- tracking starts then, not retroactively.
    const row = await this.prisma.attendanceSettings.upsert({
      where: { id: "attendance" },
      update: {},
      create: { absenceTrackingStart: dayKey(new Date()) },
    });
    const overrides = await this.prisma.attendanceDeptPolicy.findMany();
    const devDepartment = await this.prisma.department.findFirst({
      where: { name: { equals: ADMIN_IDLE_DEPARTMENT_NAME, mode: "insensitive" } },
      select: { id: true },
    });

    const departments = new Map<string, DeptPolicyOverride>();
    for (const o of overrides) {
      departments.set(o.departmentId, {
        lateGraceMin: o.lateGraceMin,
        earlyGraceMin: o.earlyGraceMin,
        idlePromptMin: o.idlePromptMin,
        absentAfterMin: o.absentAfterMin,
        minWorkMinutes: o.minWorkMinutes,
      });
    }

    this.cache = {
      at: Date.now(),
      departments,
      devDepartmentId: devDepartment?.id ?? null,
      activeGapSec: row.activeGapSec,
      global: {
        lateGraceMin: row.lateGraceMin,
        earlyGraceMin: row.earlyGraceMin,
        idlePromptMin: row.idlePromptMin,
        absentAfterMin: row.absentAfterMin,
        maxOpenSessionHours: row.maxOpenSessionHours,
        repeatLateThreshold: row.repeatLateThreshold,
        repeatLateWindowDays: row.repeatLateWindowDays,
        minWorkMinutes: row.minWorkMinutes,
        weeklyOffDays: row.weeklyOffDays,
        absenceTrackingStart: row.absenceTrackingStart,
      },
    };
    return this.cache;
  }

  /** Company-wide rules. */
  async getGlobal(): Promise<AttendancePolicy> {
    return (await this.load()).global;
  }

  /** Seconds of OS idle time below which an activity ping counts as active. */
  async getActiveGapSec(): Promise<number> {
    return IDLE_LIMIT_SEC;
  }

  /** The rules for a department: its overrides on top of the company rules. */
  async forDepartment(departmentId: string | null | undefined): Promise<AttendancePolicy> {
    const { global, departments } = await this.load();
    const override = departmentId ? departments.get(departmentId) : undefined;
    if (!override) return global;
    const merged: AttendancePolicy = { ...global };
    for (const field of DEPT_POLICY_FIELDS) {
      const v = override[field];
      if (v != null) merged[field] = v;
    }
    return merged;
  }

  /**
   * The rules for one person (by their department), with idle timing fixed company-wide:
   * IDLE_LIMIT_SEC for everyone, and off (0) for an Admin.
   */
  async forUser(userId: string): Promise<AttendancePolicy> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true, role: { select: { name: true } } },
    });
    const own = await this.forDepartment(user?.departmentId);
    // One idle rule for everyone: the same limit, with Admins not idle-tracked at all (0 = off).
    return { ...own, idlePromptMin: user?.role?.name === RoleName.ADMIN ? 0 : IDLE_LIMIT_SEC / 60 };
  }

  // ─── editing (Admin / HR) ──────────────────────────────────────────────────

  private assertCanEdit(user: RequestUser) {
    if (user.role.name !== RoleName.ADMIN && !isHrUser(user)) {
      throw new ForbiddenException("Only Admin and HR can view or change the attendance rules.");
    }
  }

  /** Everything the rules screen needs. */
  async getSettingsView(user: RequestUser) {
    this.assertCanEdit(user);
    this.cache = null; // always show what is really stored
    const { global, departments } = await this.load();
    const depts = await this.prisma.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
    return {
      global,
      defaults: DEFAULT_POLICY,
      limits: POLICY_LIMITS,
      departments: depts,
      overrides: depts
        .filter((d) => departments.has(d.id))
        .map((d) => ({ departmentId: d.id, departmentName: d.name, ...departments.get(d.id)! })),
    };
  }

  async updateGlobal(user: RequestUser, patch: GlobalPolicyPatch) {
    this.assertCanEdit(user);
    const data: Record<string, unknown> = {};
    for (const field of Object.keys(POLICY_LIMITS) as Array<keyof typeof POLICY_LIMITS>) {
      if (patch[field] !== undefined) {
        assertInRange(field, patch[field]);
        data[field] = patch[field];
      }
    }
    if (patch.weeklyOffDays !== undefined) data.weeklyOffDays = validateWeeklyOff(patch.weeklyOffDays);
    if (patch.absenceTrackingStart !== undefined) {
      data.absenceTrackingStart = validateTrackingStart(patch.absenceTrackingStart);
    }
    await this.load(); // make sure the row exists
    await this.prisma.attendanceSettings.update({
      where: { id: "attendance" },
      data: { ...data, updatedById: user.id },
    });
    this.cache = null;
    return this.getSettingsView(user);
  }

  /** Sets (or, with null, clears) a department's overrides. Omitted fields are left as they were. */
  async setDepartmentOverride(user: RequestUser, departmentId: string, patch: DeptPolicyOverride) {
    this.assertCanEdit(user);
    const department = await this.prisma.department.findUnique({ where: { id: departmentId }, select: { id: true } });
    if (!department) throw new NotFoundException("Department not found.");

    const data: DeptPolicyOverride = {};
    for (const field of DEPT_POLICY_FIELDS) {
      const v = patch[field];
      if (v === undefined) continue;
      if (v !== null) assertInRange(field, v);
      data[field] = v;
    }
    await this.prisma.attendanceDeptPolicy.upsert({
      where: { departmentId },
      update: data,
      create: { departmentId, ...data },
    });
    this.cache = null;
    return this.getSettingsView(user);
  }

  async clearDepartmentOverride(user: RequestUser, departmentId: string) {
    this.assertCanEdit(user);
    await this.prisma.attendanceDeptPolicy.deleteMany({ where: { departmentId } });
    this.cache = null;
    return this.getSettingsView(user);
  }
}
