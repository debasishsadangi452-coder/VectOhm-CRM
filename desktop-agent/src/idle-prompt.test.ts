import { describe, expect, it } from "vitest";
import { idleMinutesToReport, shouldPromptForIdle } from "./idle-prompt";

const MIN = 60_000;

describe("shouldPromptForIdle", () => {
  it("prompts once the idle time reaches the threshold", () => {
    expect(shouldPromptForIdle(4 * 60 + 59, 5)).toBe(false);
    expect(shouldPromptForIdle(5 * 60, 5)).toBe(true);
  });
});

describe("idleMinutesToReport", () => {
  it("measures from the start of the stretch to when the person came back", () => {
    expect(idleMinutesToReport({ startedAtMs: 0, returnedAtMs: 23 * MIN }, 40 * MIN, 5)).toBe(23);
  });

  it("uses now when no return was seen", () => {
    expect(idleMinutesToReport({ startedAtMs: 0, returnedAtMs: null }, 12 * MIN, 5)).toBe(12);
  });

  it("never reports less than the threshold (the server would refuse it)", () => {
    expect(idleMinutesToReport({ startedAtMs: 0, returnedAtMs: 4.6 * MIN }, 5 * MIN, 5)).toBe(5);
  });

  it("caps at a day, the most the server accepts", () => {
    expect(idleMinutesToReport({ startedAtMs: 0, returnedAtMs: null }, 3 * 24 * 60 * MIN, 5)).toBe(1440);
  });
});
