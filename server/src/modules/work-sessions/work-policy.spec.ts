import {
  computeEarlyByMin,
  computeLateByMin,
  EARLY_GRACE_MIN,
  LATE_GRACE_MIN,
  SHIFT_TIME_RE,
  shiftDayBounds,
  shiftDayKey,
  shiftDayWindow,
  workDayBounds,
} from "./work-policy";

// Company timezone is IST (UTC+05:30), so 10:00 IST === 04:30Z.
const z = (hhmmUtc: string, day = "2026-10-05") => new Date(`${day}T${hhmmUtc}:00Z`);

describe("computeLateByMin", () => {
  it("is null when clocking in before shift start", () => {
    expect(computeLateByMin(z("04:00"), "10:00")).toBeNull(); // 09:30 IST
  });

  it("is null exactly at shift start and within the grace period", () => {
    expect(computeLateByMin(z("04:30"), "10:00")).toBeNull(); // 10:00 IST
    expect(computeLateByMin(z("04:40"), "10:00")).toBeNull(); // 10:10 IST == grace limit
  });

  it("reports minutes past shift start once grace is exceeded", () => {
    expect(computeLateByMin(z("04:41"), "10:00")).toBe(11); // 10:11 IST
    expect(computeLateByMin(z("05:30"), "10:00")).toBe(60); // 11:00 IST
  });

  it("uses the per-user shift start", () => {
    expect(computeLateByMin(z("05:00"), "10:30")).toBeNull(); // 10:30 IST on a 10:30 shift
    expect(computeLateByMin(z("05:00"), "09:00")).toBe(90); // same instant, 09:00 shift
  });

  it("uses the company timezone, not UTC", () => {
    // 04:41Z reads as 04:41 in UTC (before a 10:00 shift) but is 10:41 IST.
    expect(computeLateByMin(z("04:41"), "10:00")).toBe(11);
  });

  it("grace constant matches the documented 10 minutes", () => {
    expect(LATE_GRACE_MIN).toBe(10);
  });
});

describe("shift days (08:00 to 08:00 IST)", () => {
  it("keeps a night shift on the day it started", () => {
    expect(shiftDayKey(z("12:30"))).toBe("2026-10-05"); // 18:00 IST on the 5th
    expect(shiftDayKey(z("19:00"))).toBe("2026-10-05"); // 00:30 IST on the 6th
    expect(shiftDayKey(z("21:30"))).toBe("2026-10-05"); // 03:00 IST on the 6th
    expect(shiftDayKey(z("02:29", "2026-10-06"))).toBe("2026-10-05"); // 07:59 IST on the 6th
    expect(shiftDayKey(z("02:30", "2026-10-06"))).toBe("2026-10-06"); // 08:00 IST on the 6th
  });

  it("window and bounds span 08:00 IST to 08:00 IST", () => {
    const w = shiftDayWindow("2026-10-05");
    expect(w.start).toEqual(new Date("2026-10-05T02:30:00Z"));
    expect(w.end).toEqual(new Date("2026-10-06T02:30:00Z"));
    expect(shiftDayBounds(z("19:00"))).toEqual(w); // 00:30 IST on the 6th is still the 5th's day
  });
});

describe("computeLateByMin on a night shift", () => {
  it("measures from the evening start, including a clock-in after midnight", () => {
    expect(computeLateByMin(z("12:30"), "18:00")).toBeNull(); // 18:00 IST on time
    expect(computeLateByMin(z("12:41"), "18:00")).toBe(11); // 18:11 IST
    expect(computeLateByMin(z("19:00"), "18:00")).toBe(390); // 00:30 IST the next morning
    expect(computeLateByMin(z("10:30"), "18:00")).toBeNull(); // 16:00 IST, early
  });
});

describe("computeEarlyByMin", () => {
  const clockIn = z("04:30"); // 10:00 IST

  it("is null when leaving at or after shift end", () => {
    expect(computeEarlyByMin(clockIn, z("13:30"), "10:00", "19:00")).toBeNull(); // 19:00 IST
    expect(computeEarlyByMin(clockIn, z("14:30"), "10:00", "19:00")).toBeNull(); // 20:00 IST
  });

  it("is null within the early grace period", () => {
    expect(computeEarlyByMin(clockIn, z("13:25"), "10:00", "19:00")).toBeNull(); // 18:55 IST
    expect(EARLY_GRACE_MIN).toBe(5);
  });

  it("reports minutes before shift end once grace is exceeded", () => {
    expect(computeEarlyByMin(clockIn, z("13:24"), "10:00", "19:00")).toBe(6); // 18:54 IST
    expect(computeEarlyByMin(clockIn, z("12:30"), "10:00", "19:00")).toBe(60); // 18:00 IST
  });

  it("works for overnight shifts (18:00 to 03:00 IST)", () => {
    const nightIn = z("12:30"); // 18:00 IST on the 5th
    expect(computeEarlyByMin(nightIn, z("20:30"), "18:00", "03:00")).toBe(60); // 02:00 IST on the 6th
    expect(computeEarlyByMin(nightIn, z("21:20"), "18:00", "03:00")).toBe(10); // 02:50 IST
    expect(computeEarlyByMin(nightIn, z("21:25"), "18:00", "03:00")).toBeNull(); // 02:55, within grace
    expect(computeEarlyByMin(nightIn, z("21:30"), "18:00", "03:00")).toBeNull(); // 03:00 on time
    expect(computeEarlyByMin(nightIn, z("22:30"), "18:00", "03:00")).toBeNull(); // 04:00, stayed late
  });

  it("skips sessions that span a work-day boundary", () => {
    // Clocked in 10:00 IST on the 5th, out 11:00 IST on the 6th.
    expect(computeEarlyByMin(clockIn, z("05:30", "2026-10-06"), "10:00", "19:00")).toBeNull();
  });
});

describe("workDayBounds", () => {
  it("returns the IST calendar day containing the instant", () => {
    const { start, end } = workDayBounds(z("04:30")); // 10:00 IST on the 5th
    expect(start.toISOString()).toBe("2026-10-04T18:30:00.000Z"); // 00:00 IST on the 5th
    expect(end.toISOString()).toBe("2026-10-05T18:30:00.000Z");
  });

  it("rolls late-evening UTC into the next IST day", () => {
    // 20:00Z is 01:30 IST on the 6th.
    expect(workDayBounds(z("20:00")).start.toISOString()).toBe("2026-10-05T18:30:00.000Z");
  });

  it("treats the start as inclusive and the end as exclusive", () => {
    const { start, end } = workDayBounds(z("04:30"));
    expect(workDayBounds(start).start.getTime()).toBe(start.getTime());
    expect(workDayBounds(end).start.getTime()).toBe(end.getTime());
  });
});

describe("SHIFT_TIME_RE", () => {
  it.each(["00:00", "09:30", "10:00", "19:00", "23:59"])("accepts %s", (v) => {
    expect(SHIFT_TIME_RE.test(v)).toBe(true);
  });

  it.each(["24:00", "9:30", "10:60", "10:5", "1000", "10:00:00", "", "ab:cd"])("rejects %j", (v) => {
    expect(SHIFT_TIME_RE.test(v)).toBe(false);
  });
});
