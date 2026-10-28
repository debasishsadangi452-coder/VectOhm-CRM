import { useState } from "react";
import {
  Calendar,
  Clock,
  Check,
  X,
  User,
  MessageSquareQuote,
  ShieldCheck,
  Building2,
  CalendarDays,
  FileText,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { getInitials } from "@/lib/utils";
import {
  LEAVE_TYPE_LABELS,
  LEAVE_TYPE_COLORS,
  LEAVE_STATUS_LABELS,
  type LeaveRequest,
  type Department,
} from "@/lib/api/types";

const STATUS_BADGE_STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200 ring-1 ring-amber-500/20",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200 ring-1 ring-emerald-500/20",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-200 ring-1 ring-rose-500/20",
  CANCELLED: "bg-slate-50 text-slate-700 border-slate-200 ring-1 ring-slate-500/20",
};

interface LeaveRequestDetailsDialogProps {
  leave: LeaveRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canReview?: boolean;
  onAction?: (id: string, action: "APPROVED" | "REJECTED", note?: string) => Promise<void>;
  isActionPending?: boolean;
  departments?: Department[];
}

export function LeaveRequestDetailsDialog({
  leave,
  open,
  onOpenChange,
  canReview = false,
  onAction,
  isActionPending = false,
  departments,
}: LeaveRequestDetailsDialogProps) {
  const [reviewNote, setReviewNote] = useState("");
  const [activeAction, setActiveAction] = useState<"APPROVED" | "REJECTED" | null>(null);

  if (!leave) return null;

  const start = new Date(leave.startDate);
  const end = new Date(leave.endDate);
  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const submittedAt = new Date(leave.createdAt).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const departmentName = departments?.find(
    (d) => d.id === (leave.user as { departmentId?: string }).departmentId
  )?.name;

  async function handleReview(action: "APPROVED" | "REJECTED") {
    if (!onAction) return;
    try {
      setActiveAction(action);
      await onAction(leave!.id, action, reviewNote.trim() || undefined);
      setReviewNote("");
      onOpenChange(false);
    } finally {
      setActiveAction(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden rounded-2xl bg-white border-slate-200 shadow-2xl">
        {/* Header Header */}
        <div className="bg-slate-50/90 border-b border-slate-100 p-6 pb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Avatar className="size-12 border-2 border-white shadow-sm ring-1 ring-slate-200">
                {leave.user.avatarUrl && <AvatarImage src={leave.user.avatarUrl} />}
                <AvatarFallback className="text-sm font-bold bg-blue-100 text-blue-700">
                  {getInitials(leave.user)}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  {leave.user.firstName} {leave.user.lastName}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 font-medium flex items-center gap-2 mt-0.5">
                  {departmentName ? (
                    <span className="inline-flex items-center gap-1 text-slate-600">
                      <Building2 className="size-3 text-slate-400" />
                      {departmentName}
                    </span>
                  ) : (
                    <span>Employee Leave Request</span>
                  )}
                  <span>•</span>
                  <span>Submitted {submittedAt}</span>
                </DialogDescription>
              </div>
            </div>

            <span
              className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border shadow-2xs ${
                STATUS_BADGE_STYLES[leave.status] ?? STATUS_BADGE_STYLES.PENDING
              }`}
            >
              {leave.status === "PENDING" && <Clock className="size-3.5 animate-pulse" />}
              {leave.status === "APPROVED" && <Check className="size-3.5" />}
              {leave.status === "REJECTED" && <X className="size-3.5" />}
              {LEAVE_STATUS_LABELS[leave.status] ?? leave.status}
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[68vh] overflow-y-auto">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Leave Type
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="size-2.5 rounded-full shrink-0 shadow-xs"
                  style={{ backgroundColor: LEAVE_TYPE_COLORS[leave.type] }}
                />
                <span className="text-xs font-bold text-slate-900">
                  {LEAVE_TYPE_LABELS[leave.type] ?? leave.type}
                </span>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Total Duration
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <CalendarDays className="size-3.5 text-blue-600" />
                <span className="text-xs font-bold text-slate-900">
                  {days} {days === 1 ? "Day" : "Days"}
                </span>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-slate-50 border border-slate-200/80 rounded-xl p-3">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Dates
              </span>
              <span className="text-xs font-bold text-slate-900 mt-1 block">
                {start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} –{" "}
                {end.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
          </div>

          {/* Employee's Note / Message */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <MessageSquareQuote className="size-4 text-blue-600" />
                Employee's Reason & Message
              </label>
            </div>
            <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-4 text-slate-800 text-xs leading-relaxed whitespace-pre-wrap break-words font-medium shadow-2xs">
              {leave.reason && leave.reason.trim().length > 0 ? (
                leave.reason
              ) : (
                <span className="text-slate-400 italic">No specific reason provided by employee.</span>
              )}
            </div>
          </div>

          {/* Review Details (if reviewed) */}
          {leave.reviewedBy && (
            <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-900">Review Decision</span>
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                    STATUS_BADGE_STYLES[leave.status]
                  }`}
                >
                  {LEAVE_STATUS_LABELS[leave.status]}
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Reviewed by <strong className="text-slate-800">{leave.reviewedBy.firstName} {leave.reviewedBy.lastName}</strong>
                {leave.reviewedAt && (
                  <span className="text-slate-400 ml-1">
                    on {new Date(leave.reviewedAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </p>
              {leave.reviewNote && (
                <div className="mt-2 text-xs bg-white border border-blue-200/60 rounded-lg p-2.5 text-slate-700">
                  <span className="font-semibold text-slate-900 block mb-0.5">Note from reviewer:</span>
                  <p className="whitespace-pre-wrap">{leave.reviewNote}</p>
                </div>
              )}
            </div>
          )}

          {/* Admin Review Action Box (if Pending and canReview) */}
          {leave.status === "PENDING" && canReview && onAction && (
            <div className="border border-amber-200/80 bg-amber-50/40 rounded-xl p-4 space-y-3">
              <label className="text-xs font-bold text-slate-800 block">
                Review Decision & Response Note
              </label>
              <Textarea
                placeholder="Optional message or instructions for the employee..."
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                rows={2}
                className="text-xs bg-white border-slate-200 rounded-xl focus-visible:ring-blue-500"
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isActionPending}
                  onClick={() => handleReview("REJECTED")}
                  className="text-xs font-bold h-8 px-3 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 gap-1.5 cursor-pointer"
                >
                  {activeAction === "REJECTED" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <X className="size-3.5" />
                  )}
                  Reject Request
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isActionPending}
                  onClick={() => handleReview("APPROVED")}
                  className="text-xs font-bold h-8 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 cursor-pointer shadow-sm"
                >
                  {activeAction === "APPROVED" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                  Approve Request
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="bg-slate-50 border-t border-slate-100 p-4 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs font-semibold rounded-xl border-slate-200 cursor-pointer"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
