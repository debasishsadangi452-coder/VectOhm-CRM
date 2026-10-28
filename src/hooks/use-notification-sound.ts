import { useEffect, useRef } from "react";
import { useNotifications } from "@/hooks/use-notifications";

let audioCtx: AudioContext | null = null;

function tone(ctx: AudioContext, freq: number, start: number, length: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + length + 0.05);
}

/** A short chime; a mention gets a brighter three-note one so it stands out. */
export function playNotificationSound(mention = false) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx ??= new Ctx();
    const ctx = audioCtx;
    void ctx.resume();
    const t = ctx.currentTime;
    if (mention) {
      tone(ctx, 784, t, 0.18);
      tone(ctx, 988, t + 0.16, 0.18);
      tone(ctx, 1319, t + 0.32, 0.3);
    } else {
      tone(ctx, 880, t, 0.15);
      tone(ctx, 1175, t + 0.13, 0.25);
    }
  } catch {
    // Browsers block audio until the person has interacted with the page; a missed chime is harmless.
  }
}

/** Plays a sound whenever a new unread notification shows up (the list is already polled). */
export function useNotificationSound() {
  const { data } = useNotifications();
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!data) return;
    if (seen.current === null) {
      // First load: everything already there is old news.
      seen.current = new Set(data.map((n) => n.id));
      return;
    }
    const fresh = data.filter((n) => !seen.current!.has(n.id) && !n.isRead);
    data.forEach((n) => seen.current!.add(n.id));
    if (fresh.length > 0) playNotificationSound(fresh.some((n) => /mentioned you/i.test(n.title)));
  }, [data]);
}
