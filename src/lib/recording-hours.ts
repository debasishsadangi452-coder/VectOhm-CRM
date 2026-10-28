import type { ActivityTimelinePing } from "@/lib/api/activity-monitoring";
import type { ScreenRecording } from "@/lib/api/screen-recordings";
import { hourInWorkDay } from "@/lib/work-day";

export type ClipStats = { clip: ScreenRecording; keystrokes: number; clicks: number };
export type HourGroup = {
  hour: number;
  clips: ClipStats[];
  seconds: number;
  keystrokes: number;
  clicks: number;
};

/**
 * Newest hour first, newest clip first (how a reviewer reads a timeline).
 * Hourly key/click totals come from every ping in that local hour, so they
 * still count gaps between clips; each clip gets the pings captured while it
 * was recording (a ping counts the minute before it).
 */
export function groupClipsByHour(
  recordings: ScreenRecording[],
  pings: ActivityTimelinePing[],
): HourGroup[] {
  const map = new Map<number, HourGroup>();
  for (const r of recordings) {
    const hour = new Date(r.startedAt).getHours();
    let g = map.get(hour);
    if (!g) map.set(hour, (g = { hour, clips: [], seconds: 0, keystrokes: 0, clicks: 0 }));
    const start = Date.parse(r.startedAt);
    const end = start + r.durationSec * 1000;
    let keystrokes = 0;
    let clicks = 0;
    for (const p of pings) {
      const t = Date.parse(p.capturedAt);
      if (t > start && t <= end) {
        keystrokes += p.keystrokeCount;
        clicks += p.clickCount;
      }
    }
    g.clips.push({ clip: r, keystrokes, clicks });
    g.seconds += r.durationSec;
  }
  for (const p of pings) {
    // Only hours that have recordings get a row.
    const g = map.get(new Date(p.capturedAt).getHours());
    if (!g) continue;
    g.keystrokes += p.keystrokeCount;
    g.clicks += p.clickCount;
  }
  // Newest first within the work day (noon to noon): 01:00 is later than 23:00 on a night shift.
  const groups = [...map.values()].sort((a, b) => hourInWorkDay(b.hour) - hourInWorkDay(a.hour));
  for (const g of groups) {
    g.clips.sort((a, b) => Date.parse(b.clip.startedAt) - Date.parse(a.clip.startedAt));
  }
  return groups;
}
