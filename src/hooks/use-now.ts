import { useEffect, useState } from "react";

/**
 * The current time, refreshed on an interval -- so "Overdue by 5 min" badges
 * tick over and a task flips to Overdue on screen without a page reload.
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
