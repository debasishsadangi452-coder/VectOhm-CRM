import { describe, expect, it } from "vitest";
import {
  describeMonitoringStatus,
  getMonitoringStatus,
  shouldMonitor,
  shouldRecord,
  type MonitoringInputs,
} from "./monitoring-state";

const base: MonitoringInputs = { signedIn: true, clockedIn: true, onBreak: false };
const with_ = (over: Partial<MonitoringInputs>): MonitoringInputs => ({ ...base, ...over });

describe("shouldMonitor", () => {
  it("monitors while signed in, clocked in and not on a break", () => {
    expect(shouldMonitor(base)).toBe(true);
  });

  it("has no notion of the CRM window: closing it can never stop monitoring", () => {
    // The input type has no window field at all -- the agent keeps running in
    // the background after the window is closed to the tray.
    expect(Object.keys(base)).not.toContain("windowOpen");
  });

  it("does not monitor when signed out", () => {
    expect(shouldMonitor(with_({ signedIn: false }))).toBe(false);
  });

  it("does not monitor when not clocked in", () => {
    expect(shouldMonitor(with_({ clockedIn: false }))).toBe(false);
  });

  it("does not monitor during a break", () => {
    expect(shouldMonitor(with_({ onBreak: true }))).toBe(false);
  });

  it("is on for exactly one combination", () => {
    const bools = [true, false];
    let on = 0;
    for (const signedIn of bools)
      for (const clockedIn of bools)
        for (const onBreak of bools) {
          if (shouldMonitor({ signedIn, clockedIn, onBreak })) {
            on++;
            expect({ signedIn, clockedIn, onBreak }).toEqual(base);
          }
        }
    expect(on).toBe(1);
  });
});

describe("shouldRecord", () => {
  it("records whenever signed in, regardless of clock-in or break", () => {
    expect(shouldRecord(base)).toBe(true);
    expect(shouldRecord(with_({ clockedIn: false }))).toBe(true);
    expect(shouldRecord(with_({ onBreak: true }))).toBe(true);
    expect(shouldRecord(with_({ clockedIn: false, onBreak: false }))).toBe(true);
  });

  it("does not record when signed out", () => {
    expect(shouldRecord(with_({ signedIn: false }))).toBe(false);
    expect(shouldRecord({ signedIn: false, clockedIn: false, onBreak: false })).toBe(false);
  });
});

describe("getMonitoringStatus", () => {
  it("reports the most fundamental reason first", () => {
    expect(getMonitoringStatus({ signedIn: false, clockedIn: true, onBreak: true })).toBe("signed-out");
    expect(getMonitoringStatus({ signedIn: true, clockedIn: false, onBreak: true })).toBe("not-clocked-in");
    expect(getMonitoringStatus({ signedIn: true, clockedIn: true, onBreak: true })).toBe("on-break");
    expect(getMonitoringStatus(base)).toBe("active");
  });
});

describe("describeMonitoringStatus", () => {
  it("says what is happening in plain words", () => {
    expect(describeMonitoringStatus("active")).toBe("Clocked in — monitoring active");
    expect(describeMonitoringStatus("not-clocked-in")).toBe("Not clocked in — monitoring paused");
    expect(describeMonitoringStatus("signed-out")).toBe("Signed out");
  });

  it("shows break time left, and <1m under a minute", () => {
    expect(describeMonitoringStatus("on-break", 12)).toContain("12m left");
    expect(describeMonitoringStatus("on-break", 0)).toContain("<1m left");
  });
});
