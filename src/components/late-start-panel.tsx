import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { AlarmClockPlus, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDecideLateStart, useLateStartRequests, useRequestLateStart, useTodayLateStart } from "@/hooks/use-late-start";
import type { LateStartStatus } from "@/lib/api/late-start-requests";
import { useAuthStore } from "@/stores/auth-store";

const OWNER_EMAIL = "admin@venusglobaltech.com";
const REQUESTER_EMAIL = "jivan@venushiring.com";
// Local hour the "will you be late?" prompt opens.
const PROMPT_HOUR = 17;
const DISMISS_KEY = "late-start-prompt-dismissed";

const STATUS_STYLE: Record<LateStartStatus, string> = {
  PENDING: "bg-amber-500/15 text-amber-600",
  APPROVED: "bg-emerald-500/15 text-emerald-600",
  DENIED: "bg-destructive/15 text-destructive",
};

const personName = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`.trim();
const todayLocal = () => new Date().toLocaleDateString("en-CA");

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === todayLocal();
  } catch {
    return false;
  }
}
function writeDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, todayLocal());
  } catch {
    /* the prompt just reopens next load */
  }
}

// Jivan: from 5 pm asks "will you be late today?"; "Yes" asks how many minutes
// and sends it to the owner. The owner (only) sees the requests and decides.
// An approved late start excuses a late clock-in within that time; the day still
// shows as late-but-approved, and no footage is ever added -- recording simply
// goes live when work starts.
export function LateStartPanel() {
  const email = useAuthStore((s) => s.user?.email.toLowerCase());
  const isRequester = email === REQUESTER_EMAIL;
  const isOwner = email === OWNER_EMAIL;
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState("");
  const { data: today } = useTodayLateStart(isRequester);
  const { data: all = [] } = useLateStartRequests(isOwner);
  const request = useRequestLateStart();
  const decide = useDecideLateStart();

  // Open the prompt once, from 5 pm, if there is no request for today yet.
  useEffect(() => {
    if (!isRequester || today === undefined || today !== null) return;
    const check = () => {
      if (new Date().getHours() >= PROMPT_HOUR && !readDismissed()) setOpen(true);
    };
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, [isRequester, today]);

  if (!isRequester && !isOwner) return null;

  const pending = all.filter((r) => r.status === "PENDING");
  const history = all.filter((r) => r.status !== "PENDING");
  const mins = Number(minutes);
  const validMins = Number.isInteger(mins) && mins >= 1 && mins <= 360;

  const close = (next: boolean) => {
    setOpen(next);
    if (!next && isRequester) writeDismissed();
  };

  return (
    <>
      <button
        type="button"
        aria-label="Late start"
        title="Late start"
        onClick={() => setOpen(true)}
        className="relative size-8 grid place-items-center rounded-md hover:bg-accent text-text-dim hover:text-foreground transition-colors"
      >
        <AlarmClockPlus className="size-4" strokeWidth={1.75} />
        {isOwner && pending.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-[10px] font-bold text-white grid place-items-center">
            {pending.length}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={close}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Late start</SheetTitle>
            <SheetDescription>
              {isOwner
                ? "Approve or deny a late start. An approved one excuses a late clock-in within the time given. The day still shows as an approved late start."
                : "Will you be late today? The owner has to approve it. Recording starts live when you start working."}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-6">
            {isRequester && (
              <section className="space-y-2">
                {today ? (
                  <div className="flex items-center justify-between rounded-lg border border-border-subtle p-3">
                    <span className="text-sm">Late by about {today.expectedLateMin} min today</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[today.status]}`}>
                      {today.status}
                    </span>
                  </div>
                ) : (
                  <>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-text-dim">
                      Are you going to be late today?
                    </h3>
                    <Input
                      type="number"
                      min={1}
                      max={360}
                      placeholder="How many minutes late?"
                      value={minutes}
                      onChange={(e) => setMinutes(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={!validMins || request.isPending}
                        onClick={() => request.mutate(mins)}
                      >
                        Yes, send for approval
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => close(false)}>
                        No, I'll be on time
                      </Button>
                    </div>
                  </>
                )}
              </section>
            )}

            {isOwner && (
              <>
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-text-dim mb-2">
                    Waiting for you ({pending.length})
                  </h3>
                  {pending.length === 0 ? (
                    <p className="text-sm text-text-dim py-4">No pending requests.</p>
                  ) : (
                    <ul className="space-y-2">
                      {pending.map((r) => (
                        <li key={r.id} className="rounded-lg border border-border-subtle p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{personName(r.user)}</div>
                              <div className="text-xs text-text-dim">
                                Late by about {r.expectedLateMin} min · {r.forDay}
                              </div>
                            </div>
                            <span className="text-xs text-text-dim whitespace-nowrap">
                              {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, approve: true })}>
                              <Check className="size-3.5 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={decide.isPending}
                              onClick={() => decide.mutate({ id: r.id, approve: false })}
                            >
                              <X className="size-3.5 mr-1" /> Deny
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-text-dim mb-2">Log</h3>
                  {history.length === 0 ? (
                    <p className="text-sm text-text-dim py-4">Nothing decided yet.</p>
                  ) : (
                    <ul className="divide-y divide-border-subtle">
                      {history.map((r) => (
                        <li key={r.id} className="py-2.5 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm truncate">
                              {personName(r.user)} · {r.forDay} · {r.expectedLateMin} min
                            </div>
                            <div className="text-xs text-text-dim">
                              {r.decidedBy && `Decided by ${personName(r.decidedBy)}`}
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status]}`}>
                            {r.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
