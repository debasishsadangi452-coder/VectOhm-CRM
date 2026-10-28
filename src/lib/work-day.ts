import { addDays, format } from "date-fns";

/**
 * Everyone works nights (about 18:00 to 04:00), so a shift crosses midnight and a calendar day
 * would cut it in two. A "work day" runs from WORK_DAY_START_HOUR to the same time the next day
 * (08:00 to 08:00, the same cut-off the server uses for attendance), a window nobody works in, and is
 * named after the date it starts on: Oct 25 means Oct 25 08:00 to Oct 26 07:59. Times are the viewer's local time, like the rest of the UI.
 */
export const WORK_DAY_START_HOUR = 8;

const keyOf = (d: Date) => format(d, "yyyy-MM-dd");

/** The work day (as "yyyy-MM-dd") that contains an instant. 02:00 on Oct 26 is still Oct 25. */
export function workDayKeyOf(d: Date): string {
  return keyOf(d.getHours() < WORK_DAY_START_HOUR ? addDays(d, -1) : d);
}

/** First and last millisecond of a work day. */
export function workDayWindow(key: string): { start: Date; end: Date } {
  const [y, m, day] = key.split("-").map(Number);
  const start = new Date(y, m - 1, day, WORK_DAY_START_HOUR, 0, 0, 0);
  const end = new Date(y, m - 1, day + 1, WORK_DAY_START_HOUR, 0, 0, -1);
  return { start, end };
}

/** True if an ISO instant falls inside a work day. */
export function inWorkDay(iso: string, key: string): boolean {
  const t = Date.parse(iso);
  const { start, end } = workDayWindow(key);
  return t >= start.getTime() && t <= end.getTime();
}

/** Position of an hour of the clock within the work day: 8 -> 0, 18 -> 10, 0 -> 16, 7 -> 23. */
export function hourInWorkDay(hour: number): number {
  return (hour - WORK_DAY_START_HOUR + 24) % 24;
}
