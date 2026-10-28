import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, Loader2, UserPlus, Square, CheckSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSequence, useEnrollContacts, useStopEnrollment } from "@/hooks/use-sequences";
import { useContacts } from "@/hooks/use-contacts";
import { useEmailConnectionStatus } from "@/hooks/use-email-connections";
import { ApiError } from "@/lib/api/client";
import type { Sequence } from "@/lib/api/types";

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-primary/15 text-primary border-primary/20",
  COMPLETED: "bg-success/15 text-success border-success/20",
  STOPPED: "bg-muted text-text-dim border-border-subtle",
};

interface SequenceEnrollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sequence?: Sequence;
}

export function SequenceEnrollDialog({ open, onOpenChange, sequence }: SequenceEnrollDialogProps) {
  const { data: fullSequence } = useSequence(sequence?.id);
  const { data: contacts } = useContacts();
  const { data: emailConnection } = useEmailConnectionStatus();
  const enrollContacts = useEnrollContacts();
  const stopEnrollment = useStopEnrollment();

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const smtpReady = !!emailConnection?.connected && !!emailConnection?.verified;
  // A shared HTTP sender (Resend/SendGrid) can stand in when SMTP isn't
  // connected/verified -- see EmailConnectionsService.requireSendable on the
  // backend. Enrolling is only actually blocked when neither is available.
  const senderReady = smtpReady || !!emailConnection?.httpFallbackAvailable;

  const enrolledContactIds = useMemo(
    () => new Set((fullSequence?.enrollments ?? []).map((e) => e.contactId)),
    [fullSequence],
  );
  const availableContacts = (contacts ?? []).filter((c) => c.email && !enrolledContactIds.has(c.id));

  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[id]), [selected]);

  async function handleEnroll() {
    if (!sequence || selectedIds.length === 0) return;
    setNotice(null);
    setError(null);
    try {
      const results = await enrollContacts.mutateAsync({ sequenceId: sequence.id, contactIds: selectedIds });
      const enrolled = results.filter((r) => r.enrolled).length;
      setNotice(`Enrolled ${enrolled} of ${results.length} selected contact${results.length !== 1 ? "s" : ""}.`);
      setSelected({});
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not enroll contacts");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enroll contacts — {sequence?.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!senderReady && (
            <div className="flex items-center gap-2 text-xs text-warning bg-warning/5 border border-warning/30 rounded-lg px-3 py-2">
              <AlertCircle className="size-3.5 shrink-0" />
              <span>
                Steps send from your own mailbox --{" "}
                <Link to="/account" className="text-primary hover:underline">
                  connect it in your profile
                </Link>{" "}
                before enrolling.
              </span>
            </div>
          )}
          {!smtpReady && senderReady && (
            <div className="flex items-center gap-2 text-xs text-text-dim bg-canvas/30 border border-border-subtle rounded-lg px-3 py-2">
              <AlertCircle className="size-3.5 shrink-0" />
              <span>
                No mailbox connected yet -- steps will send from a shared address for now (replies
                route back to you).{" "}
                <Link to="/account" className="text-primary hover:underline">
                  Connect your own mailbox
                </Link>{" "}
                to send as yourself instead.
              </span>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-text-dim mb-2">Currently enrolled</p>
            {fullSequence?.enrollments && fullSequence.enrollments.length > 0 ? (
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {fullSequence.enrollments.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between gap-2 p-1.5 rounded bg-canvas/30 border border-border-subtle"
                  >
                    <span className="text-xs">
                      {e.contact.firstName} {e.contact.lastName}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full border ${STATUS_STYLES[e.status]}`}
                      >
                        {e.status}
                      </span>
                      {e.status === "ACTIVE" && (
                        <button
                          type="button"
                          onClick={() =>
                            stopEnrollment.mutate({
                              sequenceId: sequence!.id,
                              enrollmentId: e.id,
                              reason: "Stopped manually",
                            })
                          }
                          className="text-[10px] text-text-dim hover:text-destructive"
                        >
                          Stop
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-text-dim">No one enrolled yet.</p>
            )}
          </div>

          <div className="border-t border-border-subtle pt-3">
            <p className="text-xs font-semibold text-text-dim mb-2">Add contacts (with an email on file)</p>
            <ScrollArea className="h-48 border border-border-subtle rounded-lg">
              <div className="p-1.5 space-y-0.5">
                {availableContacts.length === 0 ? (
                  <p className="text-[10px] text-text-dim p-2">
                    No eligible contacts — everyone with an email is already enrolled.
                  </p>
                ) : (
                  availableContacts.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-canvas/40 cursor-pointer text-xs"
                    >
                      <Checkbox
                        checked={!!selected[c.id]}
                        onCheckedChange={(checked) =>
                          setSelected((prev) => ({ ...prev, [c.id]: !!checked }))
                        }
                      />
                      <span className="flex-1 truncate">
                        {c.firstName} {c.lastName}
                      </span>
                      <span className="text-text-dim truncate max-w-[140px]">{c.email}</span>
                    </label>
                  ))
                )}
              </div>
            </ScrollArea>
            <div className="flex items-center justify-between mt-2">
              <button
                type="button"
                onClick={() =>
                  setSelected(
                    Object.fromEntries(availableContacts.map((c) => [c.id, selectedIds.length !== availableContacts.length])),
                  )
                }
                className="text-[10px] text-text-dim hover:text-foreground flex items-center gap-1"
              >
                {selectedIds.length === availableContacts.length && availableContacts.length > 0 ? (
                  <CheckSquare className="size-3" />
                ) : (
                  <Square className="size-3" />
                )}
                Select all
              </button>
              <Button
                size="sm"
                onClick={handleEnroll}
                disabled={selectedIds.length === 0 || enrollContacts.isPending || !senderReady}
                className="gap-1.5"
              >
                {enrollContacts.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <UserPlus className="size-3.5" />
                )}
                Enroll {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
              </Button>
            </div>
          </div>

          {notice && <p className="text-xs text-success">{notice}</p>}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
