import { useEffect, useState } from "react";
import { Clock, Play, Square, Loader2, Monitor, Camera, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useActiveWorkSession, useClockIn, useClockOut } from "@/hooks/use-work-session";
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
import { captureClockPhoto } from "@/lib/capture-login-photo";

const CAMERA_ERROR_MESSAGES: Record<"denied" | "unsupported", string> = {
  denied:
    "Camera access is required to go online or offline. Please allow the camera prompt and try again.",
  unsupported: "This device/browser doesn't support camera capture, which is required to clock in or out.",
};

// Ongoing, ambient disclosure that screen monitoring is active -- not a
// one-time popup that's easy to forget. Shown for the whole clocked-in
// session, next to the Online/Offline toggle. See PROJECT_STATUS.md / phase
// 10 plan for why this exists: monitoring here is disclosed policy, not
// covert -- this indicator is part of what makes that true in practice.
function MonitoringIndicator({ isOnBreak }: { isOnBreak?: boolean }) {
  if (isOnBreak) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-[10px] text-amber-400 px-1 cursor-default">
              <Monitor className="size-3" />
              Monitoring paused (1h Break)
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            Screen recording and activity monitoring are suspended during your 1-hour break.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 text-[10px] text-text-dim px-1 cursor-default">
            <Monitor className="size-3" />
            Screen monitoring active
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          Screen recordings are captured during active work time, per company policy.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// Used only until the server says what the rule is (it is editable by Admin/HR).
const DEFAULT_MINIMUM_MIN = 8.5 * 60;

export function WorkSessionToggle() {
  const { data: session, isLoading } = useActiveWorkSession();
  // The minimum hours per day is a company rule (editable by Admin/HR), so use the server's figure.
  const minimumMin = session?.minWorkMinutes ?? DEFAULT_MINIMUM_MIN;
  const minimumLabel = `${Math.floor(minimumMin / 60)} hours${minimumMin % 60 ? ` ${minimumMin % 60} mins` : ""}`;
  const clockIn = useClockIn();
  const clockOut = useClockOut();

  const [elapsed, setElapsed] = useState<string>("00:00:00");
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [alertOpen, setAlertOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [earlyOpen, setEarlyOpen] = useState(false);
  const [earlyReason, setEarlyReason] = useState("");

  // Tick elapsed time every second while active
  useEffect(() => {
    if (!session?.clockInAt) {
      setElapsed("00:00:00");
      setElapsedMs(0);
      return;
    }

    const start = new Date(session.clockInAt).getTime();
    
    function update() {
      const ms = Date.now() - start;
      setElapsedMs(ms);
      setElapsed(formatDuration(ms));
    }

    // Initial update
    update();

    const interval = setInterval(update, 1000);

    return () => clearInterval(interval);
  }, [session?.clockInAt]);

  if (isLoading) {
    return (
      <div className="flex h-[42px] items-center justify-center rounded-md border border-border-subtle bg-panel/50 text-text-dim">
        <Loader2 className="size-4 animate-spin" />
      </div>
    );
  }

  const isPending = clockIn.isPending || clockOut.isPending || capturing;

  // Mandatory gate, not fire-and-forget: going online/offline requires a
  // successful camera capture first. Only a denied prompt or no camera
  // support blocks the action -- a photo that captured fine but failed to
  // *upload* (network hiccup) still lets the employee through, since that's
  // not something they did wrong. See capture-login-photo.ts.
  async function requireCameraOrBlock(type: "CLOCK_IN" | "CLOCK_OUT"): Promise<boolean> {
    setCameraError(null);
    setCapturing(true);
    try {
      const result = await captureClockPhoto(type);
      if (!result.ok && result.reason !== "upload-failed") {
        setCameraError(CAMERA_ERROR_MESSAGES[result.reason]);
        return false;
      }
      return true;
    } finally {
      setCapturing(false);
    }
  }

  async function handleClockInClick() {
    if (!(await requireCameraOrBlock("CLOCK_IN"))) return;
    clockIn.mutate();
  }

  async function executeClockOut(reason?: string) {
    if (!(await requireCameraOrBlock("CLOCK_OUT"))) return;
    clockOut.mutate(reason, {
      onSuccess: () => {
        setEarlyOpen(false);
        setEarlyReason("");
      },
      // The server is the authority on "early"; if our 15s-old poll said
      // otherwise, it still tells us a reason is needed.
      onError: (err) => {
        if (/clocking out early/i.test((err as Error)?.message ?? "")) setEarlyOpen(true);
      },
    });
  }

  async function handleClockOutClick() {
    if (session?.clockOutIsEarly) {
      setEarlyOpen(true);
    } else if (elapsedMs < minimumMin * 60_000) {
      setAlertOpen(true);
    } else {
      await executeClockOut();
    }
  }

  async function handleConfirmClockOut() {
    setAlertOpen(false);
    await executeClockOut();
  }

  if (session) {
    // Online
    return (
      <>
        <Button
          variant="outline"
          onClick={handleClockOutClick}
          disabled={isPending}
          className="w-full h-auto py-2.5 px-3.5 justify-between bg-[#152347] hover:bg-[#1a2b57] text-white border border-blue-500/30 rounded-2xl transition-all shadow-md text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Wifi className="size-4 text-emerald-400 shrink-0" />
            <div className="flex flex-col items-start gap-0.5 min-w-0">
              <span className="text-xs font-extrabold text-white flex items-center gap-1.5">
                You're Online
              </span>
              <span className="text-[10px] font-medium text-emerald-400 font-mono">
                {capturing ? "Requesting camera…" : elapsed}
              </span>
            </div>
          </div>
          {isPending ? (
            <Loader2 className="size-4 animate-spin shrink-0 text-slate-300" />
          ) : (
            <Square className="size-3.5 shrink-0 text-slate-300 fill-slate-300 hover:text-white transition-colors" />
          )}
        </Button>
        <MonitoringIndicator isOnBreak={session.isOnBreak} />
        <CameraErrorNotice message={cameraError} />

        <AlertDialog open={earlyOpen} onOpenChange={setEarlyOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>You're leaving before your shift ends</AlertDialogTitle>
              <AlertDialogDescription>
                Your shift ends at {session.shiftEnd ?? "the scheduled time"}. Please tell us why you're
                clocking out early. This is shared with HR and your manager.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Textarea
              autoFocus
              rows={3}
              maxLength={500}
              value={earlyReason}
              onChange={(e) => setEarlyReason(e.target.value)}
              placeholder="Reason for clocking out early…"
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Stay online</AlertDialogCancel>
              <Button
                disabled={earlyReason.trim().length < 3 || isPending}
                onClick={() => executeClockOut(earlyReason.trim())}
              >
                Go Offline
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure you want to go offline?</AlertDialogTitle>
              <AlertDialogDescription>
                You have not completed the minimum required office hours ({minimumLabel}).
                Your current session duration is {elapsed.split(":")[0]}h {elapsed.split(":")[1]}m.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmClockOut}>
                Go Offline Anyway
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // Offline
  return (
    <>
      <Button
        variant="outline"
        onClick={handleClockInClick}
        disabled={isPending}
        className="w-full h-auto py-2.5 px-3.5 justify-between bg-[#152347] hover:bg-[#1a2b57] text-white border border-white/10 rounded-2xl transition-all shadow-md text-left group disabled:opacity-60"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Wifi className="size-4 text-slate-400 shrink-0 group-hover:text-blue-400 transition-colors" />
          <div className="flex flex-col items-start gap-0.5 min-w-0">
            <span className="text-xs font-extrabold text-white">You're Offline</span>
            <span className="text-[10px] font-medium text-slate-400 truncate">
              {capturing ? "Requesting camera…" : "Some features are limited"}
            </span>
          </div>
        </div>
        {isPending ? (
          <Loader2 className="size-4 animate-spin shrink-0 text-slate-400" />
        ) : (
          <Play className="size-3.5 shrink-0 text-slate-400 fill-slate-400 group-hover:text-white group-hover:fill-white transition-colors" />
        )}
      </Button>
      {clockIn.error && (
        <div className="flex items-start gap-1.5 text-[10px] text-destructive px-1 py-1">
          <span>{(clockIn.error as Error)?.message || "Failed to clock in"}</span>
        </div>
      )}
      <CameraErrorNotice message={cameraError} />
    </>
  );
}

function CameraErrorNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-1.5 text-[10px] text-destructive px-1 py-1">
      <Camera className="size-3 shrink-0 mt-px" />
      <span>{message}</span>
    </div>
  );
}
