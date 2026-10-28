// Shared by the deadline job and the update-request flow so both agree on who
// "the assignees" of a task are.

/** Anything shaped like a task with a primary assignee and/or a TaskAssignee list. */
export interface TaskWithAssignees {
  assigneeId?: string | null;
  assignees?: { userId: string }[] | null;
}

/**
 * Every user a task is assigned to: the primary assignee plus everyone in the
 * multi-assignee list, de-duplicated, primary first.
 */
export function collectAssigneeIds(task: TaskWithAssignees): string[] {
  const ids = new Set<string>();
  if (task.assigneeId) ids.add(task.assigneeId);
  for (const a of task.assignees ?? []) {
    if (a.userId) ids.add(a.userId);
  }
  return Array.from(ids);
}

// Company working timezone (see work-sessions/work-policy.ts) -- notification
// text should read in the same clock the team works to.
const DISPLAY_TZ = "Asia/Kolkata";

export function formatDeadline(date: Date): string {
  return date.toLocaleString("en-IN", {
    timeZone: DISPLAY_TZ,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "45 min", "2 h 5 min", "3 d 4 h" -- coarse, for notification text. */
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
