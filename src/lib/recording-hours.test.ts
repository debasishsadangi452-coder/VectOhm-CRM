import { describe, expect, it } from "vitest";
import { groupClipsByHour } from "./recording-hours";
import type { ScreenRecording } from "@/lib/api/screen-recordings";

const at = (h: number, m: number) => new Date(2026, 9, 21, h, m).toISOString();
const clip = (id: string, startedAt: string, durationSec = 180) =>
  ({ id, startedAt, durationSec, sizeBytes: 0 }) as ScreenRecording;
const ping = (capturedAt: string, keystrokeCount: number, clickCount: number) => ({
  capturedAt,
  active: true,
  keystrokeCount,
  clickCount,
});

describe("groupClipsByHour", () => {
  it("groups newest hour/clip first and splits pings per clip and per hour", () => {
    const groups = groupClipsByHour(
      [clip("a", at(10, 0)), clip("b", at(11, 0)), clip("c", at(11, 3))],
      [
        ping(at(10, 1), 5, 1),
        ping(at(11, 1), 10, 2),
        ping(at(11, 3), 1, 0), // end of clip b, not start of c
        ping(at(11, 4), 7, 3),
        ping(at(11, 30), 100, 50), // between clips: hour total only
        ping(at(12, 0), 999, 999), // no recordings that hour: dropped
      ],
    );
    expect(groups.map((g) => g.hour)).toEqual([11, 10]);
    expect(groups[0].clips.map((c) => [c.clip.id, c.keystrokes, c.clicks])).toEqual([
      ["c", 7, 3],
      ["b", 11, 2],
    ]);
    expect(groups[0]).toMatchObject({ seconds: 360, keystrokes: 118, clicks: 55 });
    expect(groups[1]).toMatchObject({ keystrokes: 5, clicks: 1 });
  });

  it("puts after-midnight hours above the evening on a night shift", () => {
    const groups = groupClipsByHour(
      [clip("a", at(19, 0)), clip("b", at(23, 30)), clip("c", at(1, 15)), clip("d", at(2, 40))],
      [],
    );
    expect(groups.map((g) => g.hour)).toEqual([2, 1, 23, 19]);
  });
});
