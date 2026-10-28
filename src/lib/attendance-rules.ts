// Turning the stored attendance rules into an editable form and back. Pure, so the
// validation can be tested; the server validates again and is the final authority.
import type { AttendancePolicy } from "./api/types";

/** Every field is text while it is being typed. */
export interface PolicyDraft {
  lateGraceMin: string;
  earlyGraceMin: string;
  idlePromptMin: string;
  absentAfterMin: string;
  maxOpenSessionHours: string;
  repeatLateThreshold: string;
  repeatLateWindowDays: string;
  /** Hours, decimals allowed ("8.5"); stored as minutes. */
  minWorkHours: string;
  absenceTrackingStart: string;
  weeklyOffDays: number[];
}

export type DraftErrors = Partial<Record<keyof AttendancePolicy, string>>;

const INTEGER_FIELDS = [
  "lateGraceMin",
  "earlyGraceMin",
  "idlePromptMin",
  "absentAfterMin",
  "maxOpenSessionHours",
  "repeatLateThreshold",
  "repeatLateWindowDays",
] as const;

/** A whole number written with digits only ("30"), else null. */
export function parseWholeNumber(raw: string): number | null {
  const text = raw.trim();
  return /^\d+$/.test(text) ? Number(text) : null;
}

/** Hours as typed ("8.5", "8,5") to minutes, or null if it isn't a positive number. */
export function parseHoursToMinutes(raw: string): number | null {
  const text = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  return Math.round(Number(text) * 60);
}

function isRealDay(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const t = Date.parse(`${key}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === key;
}

export function policyToDraft(p: AttendancePolicy): PolicyDraft {
  return {
    lateGraceMin: String(p.lateGraceMin),
    earlyGraceMin: String(p.earlyGraceMin),
    idlePromptMin: String(p.idlePromptMin),
    absentAfterMin: String(p.absentAfterMin),
    maxOpenSessionHours: String(p.maxOpenSessionHours),
    repeatLateThreshold: String(p.repeatLateThreshold),
    repeatLateWindowDays: String(p.repeatLateWindowDays),
    minWorkHours: String(+(p.minWorkMinutes / 60).toFixed(2)),
    absenceTrackingStart: p.absenceTrackingStart ?? "",
    weeklyOffDays: [...p.weeklyOffDays].sort(),
  };
}

/** Problems with the form, keyed by the rule they belong to. Empty = good to save. */
export function validateDraft(draft: PolicyDraft, limits: Record<string, [number, number]>): DraftErrors {
  const errors: DraftErrors = {};

  for (const field of INTEGER_FIELDS) {
    const [min, max] = limits[field] ?? [0, Number.MAX_SAFE_INTEGER];
    const n = parseWholeNumber(draft[field]);
    if (n == null || n < min || n > max) errors[field] = `Enter a whole number from ${min} to ${max}.`;
  }

  const [minLo, minHi] = limits.minWorkMinutes ?? [0, Number.MAX_SAFE_INTEGER];
  const minutes = parseHoursToMinutes(draft.minWorkHours);
  if (minutes == null || minutes < minLo || minutes > minHi) {
    errors.minWorkMinutes = `Enter hours from ${+(minLo / 60).toFixed(2)} to ${+(minHi / 60).toFixed(2)}.`;
  }

  if (draft.weeklyOffDays.length >= 7) errors.weeklyOffDays = "At least one day of the week must be a working day.";

  const start = draft.absenceTrackingStart.trim();
  if (start && !isRealDay(start)) errors.absenceTrackingStart = "Enter a valid date.";

  return errors;
}

/** The request body for a valid draft. Call only when validateDraft found nothing. */
export function draftToPatch(draft: PolicyDraft): Partial<AttendancePolicy> {
  const patch: Partial<AttendancePolicy> = {};
  for (const field of INTEGER_FIELDS) patch[field] = parseWholeNumber(draft[field]) as number;
  patch.minWorkMinutes = parseHoursToMinutes(draft.minWorkHours) as number;
  patch.weeklyOffDays = [...draft.weeklyOffDays].sort();
  patch.absenceTrackingStart = draft.absenceTrackingStart.trim() || null;
  return patch;
}
