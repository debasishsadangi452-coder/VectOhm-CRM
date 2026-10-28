import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { CalendarPlus, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  useAttendanceAdjustments,
  useDecideAttendanceAdjustment,
  useMyAttendanceAdjustments,
  useRequestAttendanceAdjustment,
} from "@/hooks/use-attendance-adjustments";
import type { AttendanceAdjustmentStatus } from "@/lib/api/attendance-adjustments";
import { useAuthStore } from "@/stores/auth-store";

const OWNER_EMAIL = "admin@venusglobaltech.com";
const REQUESTER_EMAIL = "jivan@venushiring.com";

const STATUS_STYLE: Record<AttendanceAdjustmentStatus, string> = {
  PENDING: "bg-amber-500/15 text-amber-600",
  APPROVED: "bg-emerald-500/15 text-emerald-600",
  DENIED: "bg-destructive/15 text-destructive",
};

function personName(p: { firstName: string; lastName: string }) {
  return `${p.firstName} ${p.lastName}`.trim();
}

// "YYYY-MM-DD" stored as midnight UTC; format it without a timezone shift.
function dayLabel(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return format(new Date(y, m - 1, d), "EEE, d MMM yyyy");
}

// Top-bar button for everyone: ask an admin to record a missed day (copying
// your most recent real session). Admins also see the requests to approve or
// deny, and the full log. Approved entries show as "Admin-approved adjustment"
// on the attendance page.
export function AttendanceAdjustmentsPanel() {
  // Only the owner account reviews requests; everyone else just sends them.
  const isAdmin = useAuthStore(
    (s) => s.user?.role.name === "ADMIN" && s.user.email.toLowerCase() === OWNER_EMAIL,
  );
  const [open, setOpen] = useState(false);
  const [forDate, setForDate] = useState("");
  const [reason, setReason] = useState("");
  const { data: mine = [] } = useMyAttendanceAdjustments();
  const { data: all = [] } = useAttendanceAdjustments(!!isAdmin);
  const request = useRequestAttendanceAdjustment();
  const decide = useDecideAttendanceAdjustment();

  const myId = useAuthStore((s) => s.user?.id);
  const canRequest = useAuthStore((s) => s.user?.email.toLowerCase() === REQUESTER_EMAIL);
  // Nobody else sees this feature at all.
  if (!canRequest && !isAdmin) return null;
  // You can't decide your own request, so another admin has to.
  const pending = all.filter((r) => r.status === "PENDING" && r.userId !== myId);
  const history = all.filter((r) => r.status !== "PENDING");
  const today = format(new Date(), "yyyy-MM-dd");

  const submit = () => {
    request.mutate(
      { forDate, reason },
      {
        onSuccess: () => {
          setForDate("");
          setReason("");
        },
      },
    );
  };

  return (
    <>
      <button
        type="button"
        aria-label="Attendance adjustments"
        title="Attendance adjustments"
        onClick={() => setOpen(true)}
        className="relative size-8 grid place-items-center rounded-md hover:bg-accent text-text-dim hover:text-foreground transition-colors"
      >
        <CalendarPlus className="size-4" strokeWidth={1.75} />
        {pending.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-[10px] font-bold text-white grid place-items-center">
            {pending.length}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Attendance adjustments</SheetTitle>
            <SheetDescription>
              Ask the owner to record a day you did not clock in, using your most recent real session. The owner
              must approve it, and the entry is always shown as an adjustment.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-6">
            {canRequest && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-dim">New request</h3>
              <Input type="date" max={today} value={forDate} onChange={(e) => setForDate(e.target.value)} />
              <Textarea
                placeholder="Reason (required)"
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <Button size="sm" disabled={!forDate || reason.trim().length < 5 || request.isPending} onClick={submit}>
                Send for approval
              </Button>
              {mine.length > 0 && (
                <ul className="divide-y divide-border-subtle pt-2">
                  {mine.map((r) => (
                    <li key={r.id} className="py-2 flex items-center justify-between gap-2">
                      <span className="text-sm">{dayLabel(r.forDate)}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status]}`}>
                        {r.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            )}

            {isAdmin && (
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
                              <div className="text-xs text-text-dim">For {dayLabel(r.forDate)}</div>
                            </div>
                            <span className="text-xs text-text-dim whitespace-nowrap">
                              {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-xs mt-2 text-text-dim">“{r.reason}”</p>
                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              disabled={decide.isPending}
                              onClick={() => decide.mutate({ id: r.id, approve: true })}
                            >
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
                              {personName(r.user)} · {dayLabel(r.forDate)}
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
