// One definition of "overdue" / "due soon" for every place the UI shows a task
// deadline (task list, task detail, filters, counts). Mirrors the backend job in
// server/src/modules/tasks/task-deadline.service.ts, so what a user sees on
// screen matches when notifications fire.

/** How far ahead of the deadline a task counts as "due soon" (matches the backend reminder). */
export const DUE_SOON_MS = 60 * 60 * 1000;

export type DeadlineState = "none" | "done" | "overdue" | "due_soon" | "upcoming";

export interface DeadlineInfo {
  state: DeadlineState;
  dueAt: Date | null;
  /** Milliseconds until the deadline; negative once it has passed. 0 when there is no deadline. */
  diffMs: number;
  /** Short badge text, e.g. "Overdue by 2 h 5 min" or "Due in 45 min". Empty when there is nothing to flag. */
  label: string;
}

interface DeadlineSource {
  dueDate?: string | null;
  status: string;
}

const DISPLAY_TZ = "Asia/Kolkata";

/** "45 min", "2 h 5 min", "3 d 4 h" -- coarse and human. */
export function formatSpan(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60_000));
  if (totalMin < 60) return `${totalMin} min`;
  const totalHours = Math.floor(totalMin / 60);
  if (totalHours < 24) {
    const m = totalMin % 60;
    return m ? `${totalHours} h ${m} min` : `${totalHours} h`;
  }
  const days = Math.floor(totalHours / 24);
  const h = totalHours % 24;
  return h ? `${days} d ${h} h` : `${days} d`;
}

export function formatDueDate(date: Date): string {
  return date.toLocaleString("en-IN", {
    timeZone: DISPLAY_TZ,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getDeadlineInfo(task: DeadlineSource, now: Date = new Date()): DeadlineInfo {
  if (!task.dueDate) return { state: "none", dueAt: null, diffMs: 0, label: "" };

  const dueAt = new Date(task.dueDate);
  if (Number.isNaN(dueAt.getTime())) return { state: "none", dueAt: null, diffMs: 0, label: "" };

  const diffMs = dueAt.getTime() - now.getTime();

  // A finished task is never "overdue", however late it was completed.
  if (task.status === "DONE") return { state: "done", dueAt, diffMs, label: "" };

  if (diffMs < 0) return { state: "overdue", dueAt, diffMs, label: `Overdue by ${formatSpan(-diffMs)}` };
  if (diffMs <= DUE_SOON_MS) return { state: "due_soon", dueAt, diffMs, label: `Due in ${formatSpan(diffMs)}` };
  return { state: "upcoming", dueAt, diffMs, label: "" };
}

export const isOverdue = (task: DeadlineSource, now?: Date) => getDeadlineInfo(task, now).state === "overdue";
export const isDueSoon = (task: DeadlineSource, now?: Date) => getDeadlineInfo(task, now).state === "due_soon";
