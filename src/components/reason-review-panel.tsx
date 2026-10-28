import { useState } from "react";
import { Check, Loader2, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useReviewReason } from "@/hooks/use-work-session";
import { reviewLabel } from "@/lib/attendance-view";
import { fmtTime } from "@/lib/attendance-view";
import type { ReasonReviewStatus } from "@/lib/api/types";

const DECISION_STYLE: Record<ReasonReviewStatus, string> = {
  EXCUSED: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  REJECTED: "bg-red-500/10 text-red-500 border-red-500/30",
};

/** The decision on a reason, as a small badge. */
export function ReviewBadge({ status }: { status?: ReasonReviewStatus | null }) {
  const label = reviewLabel(status);
  if (!status || !label) return null;
  return <span className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${DECISION_STYLE[status]}`}>{label}</span>;
}

/**
 * Admin / HR / the person's manager decides whether a late or early reason is
 * accepted. "Excused" stops it counting against the person; "Not accepted" keeps
 * it counting and needs a note. Anyone else just sees the decision.
 */
export function ReasonReviewPanel({
  sessionId,
  kind,
  status,
  note,
  reviewedAt,
  canReview,
  hasReason,
}: {
  sessionId: string;
  kind: "LATE" | "EARLY";
  status?: ReasonReviewStatus | null;
  note?: string | null;
  reviewedAt?: string | null;
  /** The signed-in user may decide on this one (not their own). */
  canReview: boolean;
  /** The employee has actually given a reason. */
  hasReason: boolean;
}) {
  const review = useReviewReason();
  const [draft, setDraft] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const error = review.isError ? (review.error as Error)?.message || "Couldn't save that." : null;

  function decide(next: "EXCUSED" | "REJECTED" | "PENDING", withNote?: string) {
    review.mutate(
      { sessionId, kind, status: next, note: withNote?.trim() || undefined },
      {
        onSuccess: () => {
          setRejecting(false);
          setDraft("");
        },
      },
    );
  }

  // Nothing decided and nobody who can decide: nothing to show.
  if (!status && !canReview) return null;

  return (
    <div className="space-y-2 border-t border-border-subtle pt-2">
      {status ? (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <ReviewBadge status={status} />
            {reviewedAt && <span className="text-xs text-text-dim">{fmtTime(reviewedAt)}</span>}
          </div>
          {note && <p className="text-xs text-text-dim">{note}</p>}
          {canReview && (
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" disabled={review.isPending} onClick={() => decide("PENDING")}>
              <Undo2 className="size-3" />
              Change decision
            </Button>
          )}
        </div>
      ) : (
        canReview && (
          <div className="space-y-2">
            {!hasReason && <p className="text-xs italic text-text-dim">No reason given yet. You can still decide.</p>}
            {rejecting ? (
              <div className="space-y-2">
                <Textarea
                  autoFocus
                  rows={2}
                  maxLength={300}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Why isn't this accepted? (shown to the employee)"
                />
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setRejecting(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 gap-1 bg-red-600 text-xs hover:bg-red-700"
                    disabled={draft.trim().length < 3 || review.isPending}
                    onClick={() => decide("REJECTED", draft)}
                  >
                    {review.isPending ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
                    Not accepted
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" className="h-7 gap-1 bg-emerald-600 text-xs hover:bg-emerald-700" disabled={review.isPending} onClick={() => decide("EXCUSED")}>
                  {review.isPending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                  Excuse
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={review.isPending} onClick={() => setRejecting(true)}>
                  <X className="size-3" />
                  Not accepted
                </Button>
              </div>
            )}
          </div>
        )
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
