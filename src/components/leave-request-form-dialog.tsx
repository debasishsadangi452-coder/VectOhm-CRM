import { useState, type FormEvent } from "react";
import { CalendarDays, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateLeaveRequest } from "@/hooks/use-leave-requests";
import {
  LEAVE_TYPES,
  LEAVE_TYPE_LABELS,
  LEAVE_TYPE_COLORS,
  type LeaveType,
} from "@/lib/api/types";
import { ApiError } from "@/lib/api/client";

interface LeaveRequestFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function countWorkingDays(start: Date, end: Date): number {
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function LeaveRequestFormDialog({ open, onOpenChange }: LeaveRequestFormDialogProps) {
  const [leaveType, setLeaveType] = useState<LeaveType>("ANNUAL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createLeave = useCreateLeaveRequest();

  const workingDays =
    startDate && endDate && endDate >= startDate
      ? countWorkingDays(new Date(startDate), new Date(endDate))
      : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!startDate || !endDate) {
      setError("Please select start and end dates.");
      return;
    }
    if (endDate < startDate) {
      setError("End date must be on or after start date.");
      return;
    }

    try {
      await createLeave.mutateAsync({
        type: leaveType,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        reason: reason.trim() || undefined,
      });
      // Reset and close
      setStartDate("");
      setEndDate("");
      setReason("");
      setLeaveType("ANNUAL");
      setError(null);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit leave request");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="size-5 text-primary" strokeWidth={1.75} />
            Request Leave
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Leave Type */}
          <div className="space-y-1.5">
            <Label htmlFor="leave-type">Leave Type</Label>
            <Select value={leaveType} onValueChange={(v) => setLeaveType(v as LeaveType)}>
              <SelectTrigger id="leave-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAVE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: LEAVE_TYPE_COLORS[t] }}
                      />
                      {LEAVE_TYPE_LABELS[t]}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="leave-start">Start Date</Label>
              <input
                id="leave-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="leave-end">End Date</Label>
              <input
                id="leave-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || new Date().toISOString().split("T")[0]}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                required
              />
            </div>
          </div>

          {/* Working days summary */}
          {workingDays !== null && (
            <div className="flex items-center gap-2 rounded-md bg-primary/10 border border-primary/20 px-3 py-2 text-sm">
              <CalendarDays className="size-4 text-primary shrink-0" />
              <span>
                <span className="font-semibold text-primary">{workingDays}</span>
                {" "}working day{workingDays !== 1 ? "s" : ""} requested
              </span>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-1.5">
            <Label htmlFor="leave-reason">Reason <span className="text-text-dim">(optional)</span></Label>
            <Textarea
              id="leave-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Brief description…"
              rows={3}
              maxLength={500}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createLeave.isPending}>
              {createLeave.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Submit Request"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
