import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Check, LogOut, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDecideSignOutRequest, useSignOutRequests } from "@/hooks/use-signout-requests";
import type { SignOutRequestRow } from "@/lib/api/signout-requests";
import { useAuthStore } from "@/stores/auth-store";

const STATUS_STYLE: Record<SignOutRequestRow["status"], string> = {
  PENDING: "bg-amber-500/15 text-amber-600",
  APPROVED: "bg-emerald-500/15 text-emerald-600",
  DENIED: "bg-destructive/15 text-destructive",
};

function personName(p: { firstName: string; lastName: string }) {
  return `${p.firstName} ${p.lastName}`.trim();
}

// Admin-only top-bar button (with a pending count) that opens the list of
// sign-out requests: pending ones to approve or deny, then the full log.
export function SignOutRequestsPanel() {
  const isAdmin = useAuthStore((s) => s.user?.role.name === "ADMIN");
  const [open, setOpen] = useState(false);
  const { data: requests = [] } = useSignOutRequests(!!isAdmin);
  const decide = useDecideSignOutRequest();
  if (!isAdmin) return null;

  const pending = requests.filter((r) => r.status === "PENDING");
  const history = requests.filter((r) => r.status !== "PENDING");

  return (
    <>
      <button
        type="button"
        aria-label="Sign-out requests"
        title="Sign-out requests"
        onClick={() => setOpen(true)}
        className="relative size-8 grid place-items-center rounded-md hover:bg-accent text-text-dim hover:text-foreground transition-colors"
      >
        <LogOut className="size-4" strokeWidth={1.75} />
        {pending.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-[10px] font-bold text-white grid place-items-center">
            {pending.length}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Sign-out requests</SheetTitle>
            <SheetDescription>
              Employees cannot sign out on their own. Approving signs them out of the CRM and the desktop
              app; denying keeps them signed in and recording.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-6">
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
                          <div className="text-xs text-text-dim truncate">
                            {r.user.department?.name ?? "No department"} · {r.user.email}
                          </div>
                        </div>
                        <span className="text-xs text-text-dim whitespace-nowrap">
                          {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      {r.reason && <p className="text-xs mt-2 text-text-dim">“{r.reason}”</p>}
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          disabled={decide.isPending}
                          onClick={() => decide.mutate({ id: r.id, approve: true })}
                        >
                          <Check className="size-3.5 mr-1" /> Approve sign out
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
                        <div className="text-sm truncate">{personName(r.user)}</div>
                        <div className="text-xs text-text-dim">
                          Asked {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                          {r.decidedBy && ` · by ${personName(r.decidedBy)}`}
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status]}`}
                      >
                        {r.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
