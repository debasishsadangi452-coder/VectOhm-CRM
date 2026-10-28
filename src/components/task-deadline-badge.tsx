import { AlertTriangle, Clock } from "lucide-react";
import { formatDueDate, getDeadlineInfo } from "@/lib/task-deadline";

/**
 * Deadline for a task: the due date/time, plus a red "Overdue by …" or amber
 * "Due in …" flag when it needs attention. Pass `now` from useNow() so the flag
 * stays current.
 */
export function TaskDeadlineBadge({
  task,
  now,
  className = "",
}: {
  task: { dueDate?: string | null; status: string };
  now: Date;
  className?: string;
}) {
  const info = getDeadlineInfo(task, now);

  if (info.state === "none") {
    return <span className={`text-[11px] italic text-text-dim ${className}`}>No deadline</span>;
  }

  return (
    <div className={`space-y-1 ${className}`}>
      <span className="block text-[11px] text-text-dim">{formatDueDate(info.dueAt!)}</span>
      {info.state === "overdue" && (
        <span className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
          <AlertTriangle className="size-3" />
          {info.label}
        </span>
      )}
      {info.state === "due_soon" && (
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-500">
          <Clock className="size-3" />
          {info.label}
        </span>
      )}
      {info.state === "done" && <span className="text-[10px] font-semibold text-emerald-500">Completed</span>}
    </div>
  );
}
