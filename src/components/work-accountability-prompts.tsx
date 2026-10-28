import { useState } from "react";
import { AlarmClock, Loader2, TimerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  useActiveWorkSession,
  usePendingCorrection,
  useSubmitCorrection,
  useSubmitLateReason,
} from "@/hooks/use-work-session";
import type { WorkSession } from "@/lib/api/types";

const MIN_REASON_LENGTH = 3;

const LATE_QUICK_REASONS = ["Traffic / commute", "Internet or power issue", "Health issue", "Personal emergency", "Other"];

function formatTime(d: Date) {
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

/** Full-screen blocking prompt: no close button, no outside-click or Esc dismissal. */
function ReasonPrompt({
  icon,
  title,
  description,
  quickReasons,
  submitting,
  error,
  onSubmit,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  quickReasons: string[];
  submitting: boolean;
  error: string | null;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const valid = reason.trim().length >= MIN_REASON_LENGTH;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reason-prompt-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
    >
      <form
        className="w-full max-w-md space-y-4 rounded-xl border border-border-subtle bg-panel p-6 shadow-xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !submitting) onSubmit(reason.trim());
        }}
      >
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
            {icon}
          </div>
          <div className="space-y-1">
            <h2 id="reason-prompt-title" className="text-base font-semibold">
              {title}
            </h2>
            <p className="text-sm text-text-dim">{description}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {quickReasons.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setReason(q === "Other" ? "" : q)}
              className="rounded-full border border-border-subtle px-2.5 py-1 text-xs text-text-dim hover:bg-hover hover:text-foreground"
            >
              {q}
            </button>
          ))}
        </div>

        <Textarea
          autoFocus
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Type your reason…"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}

        <Button type="submit" className="w-full" disabled={!valid || submitting}>
          {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
          Submit reason
        </Button>
      </form>
    </div>
  );
}

const CORRECTION_QUICK_NOTES = ["Forgot to clock out", "Power / internet issue", "Left on time", "Other"];
const MAX_SESSION_HOURS = 14; // keep in step with MAX_OPEN_SESSION_HOURS on the server

/** A Date as the value a <input type="datetime-local"> expects (local time, to the minute). */
export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Asks the employee when they really finished a session the system had to close
 * because they never clocked out. Not blocking -- "Later" hides it until the next
 * page load -- but it keeps coming back until it is answered.
 */
function CorrectionPrompt({
  session,
  submitting,
  error,
  onSubmit,
  onLater,
}: {
  session: WorkSession;
  submitting: boolean;
  error: string | null;
  onSubmit: (input: { clockOutAt: string; note: string }) => void;
  onLater: () => void;
}) {
  const clockIn = new Date(session.clockInAt);
  const autoClosedAt = new Date(session.clockOutAt ?? session.clockInAt);
  const latest = new Date(Math.min(Date.now(), clockIn.getTime() + MAX_SESSION_HOURS * 60 * 60 * 1000));

  const [value, setValue] = useState(() => toLocalInput(autoClosedAt));
  const [note, setNote] = useState("");

  const picked = new Date(value);
  const inRange =
    !Number.isNaN(picked.getTime()) && picked.getTime() >= clockIn.getTime() && picked.getTime() <= latest.getTime();
  const valid = inRange && note.trim().length >= MIN_REASON_LENGTH;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="correction-prompt-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
    >
      <form
        className="w-full max-w-md space-y-4 rounded-xl border border-border-subtle bg-panel p-6 shadow-xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !submitting) onSubmit({ clockOutAt: picked.toISOString(), note: note.trim() });
        }}
      >
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-orange-400">
            <TimerOff className="size-5" />
          </div>
          <div className="space-y-1">
            <h2 id="correction-prompt-title" className="text-base font-semibold">
              You didn't clock out
            </h2>
            <p className="text-sm text-text-dim">
              Your session from {formatTime(clockIn)} on {clockIn.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}{" "}
              was still open, so it was closed automatically at {formatTime(autoClosedAt)}. When did you actually finish?
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="correction-time" className="text-xs text-text-dim">
            I finished at
          </label>
          <input
            id="correction-time"
            type="datetime-local"
            value={value}
            min={toLocalInput(clockIn)}
            max={toLocalInput(latest)}
            onChange={(e) => setValue(e.target.value)}
            className="h-9 w-full rounded-md border border-border-subtle bg-canvas px-3 text-sm"
          />
          {!inRange && (
            <p className="text-xs text-destructive">
              Pick a time between {formatTime(clockIn)} and now (within {MAX_SESSION_HOURS} hours of clocking in).
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {CORRECTION_QUICK_NOTES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setNote(q === "Other" ? "" : q)}
              className="rounded-full border border-border-subtle px-2.5 py-1 text-xs text-text-dim hover:bg-hover hover:text-foreground"
            >
              {q}
            </button>
          ))}
        </div>
        <Textarea
          rows={2}
          maxLength={300}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a short note…"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onLater} disabled={submitting}>
            Later
          </Button>
          <Button type="submit" className="flex-1" disabled={!valid || submitting}>
            {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            Submit
          </Button>
        </div>
      </form>
    </div>
  );
}

/**
 * Mounted once in the app shell. Two mandatory prompts:
 *  1. Late clock-in -- asked once, right after clocking in past shift start.
 *  2. Forgotten clock-out -- the system closed the session; when did they really finish?
 *
 * Idle time is deliberately NOT judged here. Idle means no keyboard or mouse input
 * anywhere on the computer, which a browser tab can't see -- someone working in
 * another app would look idle. The desktop app reads the OS idle time and asks
 * "Are you still working?" itself.
 */
export function WorkAccountabilityPrompts() {
  const { data: session } = useActiveWorkSession();
  const submitLate = useSubmitLateReason();
  const { data: pendingCorrection } = usePendingCorrection();
  const submitCorrection = useSubmitCorrection();
  // "Later" hides the correction prompt until the next page load.
  const [correctionDeferred, setCorrectionDeferred] = useState<string | null>(null);

  const needsLateReason = !!session && session.lateByMin != null && !session.lateReason;

  if (needsLateReason && session) {
    return (
      <ReasonPrompt
        key="late"
        icon={<AlarmClock className="size-5" />}
        title="You clocked in late"
        description={`You clocked in ${session.lateByMin} min after shift start. Please tell us why.`}
        quickReasons={LATE_QUICK_REASONS}
        submitting={submitLate.isPending}
        error={submitLate.isError ? "Couldn't save your reason. Please try again." : null}
        onSubmit={(reason) => submitLate.mutate({ sessionId: session.id, reason })}
      />
    );
  }

  // Least urgent: only when nothing else is asking for attention.
  if (pendingCorrection && pendingCorrection.id !== correctionDeferred) {
    return (
      <CorrectionPrompt
        key={`correction-${pendingCorrection.id}`}
        session={pendingCorrection}
        submitting={submitCorrection.isPending}
        error={submitCorrection.isError ? (submitCorrection.error as Error)?.message || "Couldn't save that. Please try again." : null}
        onSubmit={(input) => submitCorrection.mutate({ sessionId: pendingCorrection.id, ...input })}
        onLater={() => setCorrectionDeferred(pendingCorrection.id)}
      />
    );
  }

  return null;
}
