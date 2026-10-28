import { describe, expect, it } from "vitest";
import { hourInWorkDay, inWorkDay, workDayKeyOf, workDayWindow } from "./work-day";

const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m);

describe("work day (08:00 to 08:00)", () => {
  it("keeps a night shift on the date it started", () => {
    expect(workDayKeyOf(at(25, 18))).toBe("2026-10-25");
    expect(workDayKeyOf(at(25, 23, 59))).toBe("2026-10-25");
    expect(workDayKeyOf(at(26, 0, 5))).toBe("2026-10-25");
    expect(workDayKeyOf(at(26, 3, 30))).toBe("2026-10-25");
    expect(workDayKeyOf(at(26, 7, 59))).toBe("2026-10-25");
    expect(workDayKeyOf(at(26, 8, 0))).toBe("2026-10-26");
  });

  it("windows span 08:00 to 08:00 and can be tested for membership", () => {
    const { start, end } = workDayWindow("2026-10-25");
    expect(start).toEqual(at(25, 8));
    expect(end.getTime()).toBe(at(26, 8).getTime() - 1);
    expect(inWorkDay(at(26, 2).toISOString(), "2026-10-25")).toBe(true);
    expect(inWorkDay(at(26, 9).toISOString(), "2026-10-25")).toBe(false);
    expect(inWorkDay(at(25, 7).toISOString(), "2026-10-25")).toBe(false);
  });

  it("orders hours from 08:00, so after-midnight hours come after the evening", () => {
    expect(hourInWorkDay(18)).toBeLessThan(hourInWorkDay(23));
    expect(hourInWorkDay(23)).toBeLessThan(hourInWorkDay(0));
    expect(hourInWorkDay(0)).toBeLessThan(hourInWorkDay(3));
  });
});
