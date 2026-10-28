import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Coffee, Lock, Play, Square, Loader2, Sparkles, ShieldAlert, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ACTIVE_SESSION_KEY, useActiveWorkSession, useStartBreak, useEndBreak } from "@/hooks/use-work-session";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function formatSeconds(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatCooldown(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/**
 * Break state shared by the dashboard card and the top-bar button: live countdowns,
 * start/end, and the confirmation dialogs. The server ends a break after 1 hour
 * (screen recording resumes on the desktop app's next check); when the countdown
 * hits zero the session is re-fetched so the UI resumes too.
 */
function useBreakControls() {
  const qc = useQueryClient();
  const { data: session, isLoading } = useActiveWorkSession();
  const startBreakMutation = useStartBreak();
  const endBreakMutation = useEndBreak();

  const [confirmStartOpen, setConfirmStartOpen] = useState(false);
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);

  // Live countdown states
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const [cooldownSec, setCooldownSec] = useState<number>(0);

  const isClockedIn = !!session;
  const isOnBreak = !!session?.isOnBreak;

  // Initialize and tick remaining break seconds & cooldown seconds
  useEffect(() => {
    if (!session) {
      setRemainingSec(0);
      setCooldownSec(0);
      return;
    }

    setRemainingSec(session.breakRemainingSeconds ?? 0);
    setCooldownSec(session.cooldownRemainingSeconds ?? 0);

    const interval = setInterval(() => {
      setRemainingSec((prev) => (prev > 0 ? prev - 1 : 0));
      setCooldownSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [session?.isOnBreak, session?.breakRemainingSeconds, session?.cooldownRemainingSeconds]);

  // The hour is up: ask the server, which ends the break, instead of waiting for the next poll.
  useEffect(() => {
    if (isOnBreak && remainingSec === 0 && (session?.breakRemainingSeconds ?? 0) > 0) {
      qc.invalidateQueries({ queryKey: ACTIVE_SESSION_KEY });
    }
  }, [isOnBreak, remainingSec, session?.breakRemainingSeconds, qc]);

  const isPending = startBreakMutation.isPending || endBreakMutation.isPending;
  const isCooldownActive = cooldownSec > 0 && !isOnBreak;

  const onError = (err: Error) => toast.error(err.message || "Something went wrong. Please try again.");

  const handleStartBreak = () => {
    setConfirmStartOpen(false);
    startBreakMutation.mutate(undefined, { onError });
  };

  const handleEndBreak = () => {
    setConfirmEndOpen(false);
    endBreakMutation.mutate(undefined, { onError });
  };

  return {
    isLoading,
    isClockedIn,
    isOnBreak,
    isCooldownActive,
    isPending,
    remainingSec,
    cooldownSec,
    confirmStartOpen,
    setConfirmStartOpen,
    confirmEndOpen,
    setConfirmEndOpen,
    handleStartBreak,
    handleEndBreak,
  };
}

type BreakControls = ReturnType<typeof useBreakControls>;

function StartBreakDialog({ c }: { c: BreakControls }) {
  return (
    <AlertDialog open={c.confirmStartOpen} onOpenChange={c.setConfirmStartOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Start 1-Hour Break?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              During your 1-hour break, <strong>screen recording and activity monitoring are completely paused</strong>.
            </p>
            <div className="p-3 rounded-xl bg-orange-50 border border-orange-200 text-xs text-orange-900 space-y-1">
              <p className="font-semibold">• Maximum break duration is 60 minutes.</p>
              <p className="font-semibold">• The break automatically ends after 1 hour (or you can end it earlier).</p>
              <p className="font-semibold">• Once ended, you will have a <strong>5-hour cooldown</strong> before another break can be started.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={c.handleStartBreak} className="bg-orange-600 hover:bg-orange-700">
            Start Break (60m)
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function EndBreakDialog({ c }: { c: BreakControls }) {
  return (
    <AlertDialog open={c.confirmEndOpen} onOpenChange={c.setConfirmEndOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>End Break Early?</AlertDialogTitle>
          <AlertDialogDescription>
            Ending your break now will resume active work time and screen recording. You will not be able to start another break for the next <strong>5 hours</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep On Break</AlertDialogCancel>
          <AlertDialogAction onClick={c.handleEndBreak} className="bg-amber-600 hover:bg-amber-700">
            End Break & Resume Work
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Compact break control for the top bar, next to the notification bell. */
export function TopBarBreakButton() {
  const c = useBreakControls();
  if (c.isLoading) return null;

  const pill = "h-8 inline-flex items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors";

  if (c.isOnBreak) {
    return (
      <>
        <button
          type="button"
          onClick={() => c.setConfirmEndOpen(true)}
          disabled={c.isPending}
          className={`${pill} border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400`}
          title="On break — screen recording paused. Click to resume work."
        >
          {c.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex size-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
            </span>
          )}
          <span className="hidden sm:inline">On break</span>
          <span className="font-mono tabular-nums">{formatSeconds(c.remainingSec)}</span>
          <span className="mx-0.5 h-3 w-px bg-amber-500/40" />
          <Play className="size-3 fill-current" />
          Resume
        </button>
        <EndBreakDialog c={c} />
      </>
    );
  }

  if (c.isCooldownActive || !c.isClockedIn) {
    const why = c.isClockedIn
      ? `One break every 5 hours. Next break in ${formatCooldown(c.cooldownSec)}.`
      : "Clock in to take a break.";
    return (
      <span
        className={`${pill} border-border-subtle text-text-dim cursor-not-allowed opacity-70`}
        title={why}
        aria-label={why}
      >
        {c.isClockedIn ? <Lock className="size-3.5" /> : <Coffee className="size-3.5" />}
        <span className="hidden sm:inline">
          {c.isClockedIn ? `Break in ${formatCooldown(c.cooldownSec)}` : "Break"}
        </span>
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => c.setConfirmStartOpen(true)}
        disabled={c.isPending}
        className={`${pill} border-border-subtle text-text-dim hover:bg-accent hover:text-foreground`}
        title="Take a 1-hour break (pauses screen recording)"
      >
        {c.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Coffee className="size-3.5" />}
        <span className="hidden sm:inline">Break</span>
      </button>
      <StartBreakDialog c={c} />
    </>
  );
}

export function BreakTimeToggle({ compact = false }: { compact?: boolean }) {
  const c = useBreakControls();
  const {
    isLoading,
    isClockedIn,
    isOnBreak,
    isCooldownActive,
    isPending,
    remainingSec,
    cooldownSec,
    setConfirmStartOpen,
    setConfirmEndOpen,
  } = c;

  if (isLoading) {
    return (
      <div className="flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white/60 text-slate-400">
        <Loader2 className="size-4 animate-spin" />
      </div>
    );
  }

  // 1. ACTIVE BREAK STATE
  if (isOnBreak) {
    return (
      <>
        <div
          className={`flex items-center justify-between gap-3 p-3 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 border border-amber-500/30 shadow-xs ${
            compact ? "w-full" : ""
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="relative flex size-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full size-3 bg-amber-500" />
            </span>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-amber-900">On 1-Hour Break</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-mono font-bold">
                  Recording Paused
                </span>
              </div>
              <span className="text-[11px] font-mono font-extrabold text-amber-700">
                {formatSeconds(remainingSec)} remaining
              </span>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirmEndOpen(true)}
            disabled={isPending}
            className="h-8 px-3 rounded-xl bg-white hover:bg-amber-50 text-amber-900 border-amber-300 text-xs font-bold shadow-2xs shrink-0"
          >
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Square className="size-3.5 mr-1 fill-amber-700 text-amber-700" />}
            End Break
          </Button>
        </div>

        <EndBreakDialog c={c} />
      </>
    );
  }

  // 2. COOLDOWN STATE (Break locked for 5 hours)
  if (isCooldownActive) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={`flex items-center justify-between gap-3 p-2.5 px-3.5 rounded-2xl bg-slate-100/90 border border-slate-200/80 text-slate-500 cursor-not-allowed ${
                compact ? "w-full" : ""
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Lock className="size-4 text-slate-400 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-700">Break On Cooldown</span>
                  <span className="text-[10px] font-mono font-medium text-slate-500">
                    Available in {formatCooldown(cooldownSec)}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-mono shrink-0">
                5h Rule
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            Break time is limited to once every 5 hours. Your next 1-hour break unlocks in {formatCooldown(cooldownSec)}.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // 3. READY TO TAKE BREAK (Clocked in, no cooldown)
  if (isClockedIn) {
    return (
      <>
        <Button
          variant="outline"
          onClick={() => setConfirmStartOpen(true)}
          disabled={isPending}
          className={`h-auto py-2 px-3.5 justify-between rounded-2xl bg-white hover:bg-orange-50/80 border-orange-200 hover:border-orange-300 text-orange-950 transition-all shadow-2xs group text-left ${
            compact ? "w-full" : ""
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-7 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold shrink-0 group-hover:scale-105 transition-transform">
              <Coffee className="size-3.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-900 group-hover:text-orange-950">
                Take 1-Hour Break
              </span>
              <span className="text-[10px] text-slate-500">
                Pauses screen recording for 60m
              </span>
            </div>
          </div>
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin text-orange-600 shrink-0" />
          ) : (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 shrink-0">
              Ready
            </span>
          )}
        </Button>

        <StartBreakDialog c={c} />
      </>
    );
  }

  // 4. NOT CLOCKED IN STATE
  return (
    <div
      className={`flex items-center justify-between gap-3 p-2.5 px-3.5 rounded-2xl bg-slate-50 border border-slate-200/60 text-slate-400 ${
        compact ? "w-full" : ""
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Coffee className="size-3.5 text-slate-400 shrink-0" />
        <span className="text-xs font-medium text-slate-500 truncate">
          Go online to enable 1h break
        </span>
      </div>
      <span className="text-[10px] font-mono text-slate-400">Offline</span>
    </div>
  );
}
