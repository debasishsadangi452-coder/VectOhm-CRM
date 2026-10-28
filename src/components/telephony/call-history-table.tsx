import { Loader2, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { useCalls } from "@/hooks/use-telephony";
import type { ListCallsFilters } from "@/lib/api/telephony";
import type { CallStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<CallStatus, string> = {
  INITIATED: "Initiating",
  RINGING: "Ringing",
  CONNECTED: "Connected",
  COMPLETED: "Completed",
  FAILED: "Failed",
  BUSY: "Busy",
  NO_ANSWER: "No answer",
};

const STATUS_STYLES: Record<CallStatus, string> = {
  INITIATED: "text-text-dim",
  RINGING: "text-warning",
  CONNECTED: "text-success",
  COMPLETED: "text-success",
  FAILED: "text-destructive",
  BUSY: "text-destructive",
  NO_ANSWER: "text-text-dim",
};

function formatDuration(sec: number | null): string {
  if (sec == null) return "--";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Filterable call log (see the plan's §8). `compact` drops the agent column
// and per-row borders for embedding inside Contact/Deal detail panels; the
// full table (used on the standalone /calls page) shows everything Admin/
// Manager visibility scoping (see CallsService.visibilityScope) returns.
export function CallHistoryTable({
  compact = false,
  ...filters
}: ListCallsFilters & { compact?: boolean }) {
  const { data: calls, isLoading } = useCalls(filters);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-text-dim py-4">
        <Loader2 className="size-4 animate-spin" /> Loading calls…
      </div>
    );
  }

  if (!calls || calls.length === 0) {
    return <p className="text-sm text-text-dim py-4">No calls logged yet.</p>;
  }

  return (
    <div className="space-y-2">
      {calls.map((call) => (
        <div
          key={call.id}
          className={cn(
            "flex items-start justify-between gap-3 rounded-lg border border-border-subtle bg-canvas/30 p-2.5",
          )}
        >
          <div className="flex items-start gap-2 min-w-0">
            {call.direction === "INBOUND" ? (
              <PhoneIncoming className="size-4 text-text-dim shrink-0 mt-0.5" />
            ) : (
              <PhoneOutgoing className="size-4 text-text-dim shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {call.contact
                  ? `${call.contact.firstName} ${call.contact.lastName}`
                  : call.toNumber}
              </p>
              <p className="text-[11px] text-text-dim">
                {new Date(call.startedAt).toLocaleString()}
                {!compact ? ` · ${call.agent.firstName} ${call.agent.lastName}` : ""}
              </p>
              {call.disposition && (
                <p className="text-[11px] text-text-dim mt-0.5">{call.disposition}</p>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className={cn("text-xs font-medium", STATUS_STYLES[call.status])}>
              {STATUS_LABELS[call.status]}
            </p>
            <p className="text-[11px] text-text-dim">{formatDuration(call.durationSec)}</p>
            {call.recordingUrl && (
              <a
                href={call.recordingUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-primary hover:underline"
              >
                Play recording
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
