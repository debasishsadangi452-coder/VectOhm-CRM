// Scheduling maths for Intent automations. Times are company time (IST,
// UTC+05:30, no DST), matching work-sessions/work-policy.ts.
const IST_OFFSET_MS = 330 * 60_000;

export type IntentFrequency = "DAILY" | "WEEKDAYS" | "WEEKLY";

export interface ScheduleConfig {
  frequency: IntentFrequency;
  // "HH:MM", 24h, company time.
  timeOfDay: string;
  // 0 = Sunday .. 6 = Saturday; only used for WEEKLY (defaults to Monday).
  weekday?: number | null;
}

export function isValidTimeOfDay(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

// The first scheduled moment strictly after `after`.
export function computeNextRun(after: Date, cfg: ScheduleConfig): Date {
  const [hour, minute] = cfg.timeOfDay.split(":").map(Number);
  const ist = new Date(after.getTime() + IST_OFFSET_MS);
  for (let dayOffset = 0; dayOffset <= 8; dayOffset++) {
    const candidate =
      Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + dayOffset, hour, minute) -
      IST_OFFSET_MS;
    if (candidate <= after.getTime()) continue;
    const dow = new Date(candidate + IST_OFFSET_MS).getUTCDay();
    if (cfg.frequency === "WEEKDAYS" && (dow === 0 || dow === 6)) continue;
    if (cfg.frequency === "WEEKLY" && dow !== (cfg.weekday ?? 1)) continue;
    return new Date(candidate);
  }
  throw new Error("Could not compute the next run time");
}

// Start (as a UTC instant) of the company-time calendar day containing `now`.
export function startOfCompanyDay(now: Date): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_OFFSET_MS);
}
