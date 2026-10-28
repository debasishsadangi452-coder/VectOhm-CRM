import { describe, expect, it } from "vitest";
import type { AttendancePolicy } from "./api/types";
import {
  draftToPatch,
  parseHoursToMinutes,
  parseWholeNumber,
  policyToDraft,
  validateDraft,
} from "./attendance-rules";

const policy: AttendancePolicy = {
  lateGraceMin: 10,
  earlyGraceMin: 5,
  idlePromptMin: 30,
  absentAfterMin: 60,
  maxOpenSessionHours: 14,
  repeatLateThreshold: 3,
  repeatLateWindowDays: 7,
  minWorkMinutes: 510,
  weeklyOffDays: [6, 0],
  absenceTrackingStart: "2026-10-01",
};

const limits: Record<string, [number, number]> = {
  lateGraceMin: [0, 180],
  earlyGraceMin: [0, 180],
  idlePromptMin: [5, 240],
  absentAfterMin: [15, 600],
  maxOpenSessionHours: [4, 24],
  repeatLateThreshold: [2, 30],
  repeatLateWindowDays: [1, 90],
  minWorkMinutes: [60, 1440],
};

describe("parseWholeNumber", () => {
  it.each([["30", 30], [" 7 ", 7], ["0", 0], ["007", 7]])("%j -> %d", (raw, n) => expect(parseWholeNumber(raw)).toBe(n));
  it.each(["", " ", "-5", "1.5", "1e3", "ten", "5 minutes"])("rejects %j", (raw) => expect(parseWholeNumber(raw)).toBeNull());
});

describe("parseHoursToMinutes", () => {
  it.each([
    ["8.5", 510],
    ["8,5", 510],
    ["8", 480],
    ["0.25", 15],
    [" 7.75 ", 465],
  ])("%j -> %d minutes", (raw, min) => expect(parseHoursToMinutes(raw)).toBe(min));
  it.each(["", "-1", "abc", "8.5h", "1..5"])("rejects %j", (raw) => expect(parseHoursToMinutes(raw)).toBeNull());
});

describe("policyToDraft", () => {
  it("turns every rule into editable text, minutes into hours, and sorts the days off", () => {
    expect(policyToDraft(policy)).toEqual({
      lateGraceMin: "10",
      earlyGraceMin: "5",
      idlePromptMin: "30",
      absentAfterMin: "60",
      maxOpenSessionHours: "14",
      repeatLateThreshold: "3",
      repeatLateWindowDays: "7",
      minWorkHours: "8.5",
      absenceTrackingStart: "2026-10-01",
      weeklyOffDays: [0, 6],
    });
  });

  it("shows no start date as an empty field, and tidies awkward hours", () => {
    const draft = policyToDraft({ ...policy, absenceTrackingStart: null, minWorkMinutes: 400 });
    expect(draft.absenceTrackingStart).toBe("");
    expect(draft.minWorkHours).toBe("6.67");
  });
});

describe("validateDraft", () => {
  const good = policyToDraft(policy);

  it("accepts the stored rules as they are", () => {
    expect(validateDraft(good, limits)).toEqual({});
  });

  it.each([
    ["lateGraceMin", "181"],
    ["lateGraceMin", "-1"],
    ["lateGraceMin", "abc"],
    ["lateGraceMin", ""],
    ["idlePromptMin", "4"],
    ["maxOpenSessionHours", "25"],
    ["repeatLateThreshold", "1"],
    ["repeatLateWindowDays", "0"],
    ["absentAfterMin", "10"],
  ])("rejects %s = %j", (field, value) => {
    const errors = validateDraft({ ...good, [field]: value }, limits);
    expect(Object.keys(errors)).toEqual([field]);
    expect(errors[field as keyof typeof errors]).toMatch(/whole number from/);
  });

  it("accepts values right at the limits", () => {
    expect(validateDraft({ ...good, lateGraceMin: "0", idlePromptMin: "240", maxOpenSessionHours: "4" }, limits)).toEqual({});
  });

  it("checks the minimum hours in hours", () => {
    expect(validateDraft({ ...good, minWorkHours: "0.5" }, limits).minWorkMinutes).toMatch(/hours from 1 to 24/);
    expect(validateDraft({ ...good, minWorkHours: "30" }, limits).minWorkMinutes).toBeDefined();
    expect(validateDraft({ ...good, minWorkHours: "nine" }, limits).minWorkMinutes).toBeDefined();
    expect(validateDraft({ ...good, minWorkHours: "7.5" }, limits)).toEqual({});
  });

  it("won't allow every weekday to be a day off", () => {
    expect(validateDraft({ ...good, weeklyOffDays: [0, 1, 2, 3, 4, 5, 6] }, limits).weeklyOffDays).toMatch(/At least one day/);
    expect(validateDraft({ ...good, weeklyOffDays: [] }, limits)).toEqual({}); // a seven-day working week is allowed
  });

  it("checks the tracking start is a real date, but allows it empty", () => {
    expect(validateDraft({ ...good, absenceTrackingStart: "" }, limits)).toEqual({});
    expect(validateDraft({ ...good, absenceTrackingStart: "2026-02-30" }, limits).absenceTrackingStart).toBeDefined();
    expect(validateDraft({ ...good, absenceTrackingStart: "soon" }, limits).absenceTrackingStart).toBeDefined();
  });

  it("reports every problem at once", () => {
    const errors = validateDraft({ ...good, lateGraceMin: "x", minWorkHours: "x", weeklyOffDays: [0, 1, 2, 3, 4, 5, 6] }, limits);
    expect(Object.keys(errors).sort()).toEqual(["lateGraceMin", "minWorkMinutes", "weeklyOffDays"]);
  });
});

describe("draftToPatch", () => {
  it("round-trips the stored rules", () => {
    expect(draftToPatch(policyToDraft(policy))).toEqual({ ...policy, weeklyOffDays: [0, 6] });
  });

  it("turns edited text into numbers, hours into minutes, and an empty date into null", () => {
    const draft = { ...policyToDraft(policy), lateGraceMin: "15", minWorkHours: "8", absenceTrackingStart: "  ", weeklyOffDays: [6, 5] };
    expect(draftToPatch(draft)).toMatchObject({
      lateGraceMin: 15,
      minWorkMinutes: 480,
      absenceTrackingStart: null,
      weeklyOffDays: [5, 6],
    });
  });
});
