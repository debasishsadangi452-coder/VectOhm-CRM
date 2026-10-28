import { useState } from "react";
import { CalendarDays, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAttendanceCalendar, useCreateHoliday, useDeleteHoliday } from "@/hooks/use-work-session";
import { fmtDayKey } from "@/lib/attendance-view";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Admin/HR manage the company holiday calendar. Nobody is marked late or absent
 * on a holiday, and it is shown on the Attendance page so a gap is explained.
 */
export function HolidayManagerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: calendar, isLoading } = useAttendanceCalendar();
  const create = useCreateHoliday();
  const remove = useDeleteHoliday();
  const [date, setDate] = useState("");
  const [name, setName] = useState("");

  const holidays = calendar?.holidays ?? [];
  const weeklyOff = (calendar?.weeklyOffDays ?? []).map((d) => WEEKDAYS[d]).join(" and ");
  const canAdd = !!date && name.trim().length >= 2 && !create.isPending;

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!canAdd) return;
    create.mutate(
      { date, name: name.trim() },
      {
        onSuccess: () => {
          setDate("");
          setName("");
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="size-4 text-primary" />
            Company holidays
          </DialogTitle>
          <DialogDescription>
            No one is marked late or absent on these days.
            {weeklyOff ? ` Every ${weeklyOff} is already a day off.` : ""}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={add} className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="holiday-date" className="text-xs">Date</Label>
            <Input
              id="holiday-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 w-[150px]"
            />
          </div>
          <div className="min-w-[140px] flex-1 space-y-1.5">
            <Label htmlFor="holiday-name" className="text-xs">Name</Label>
            <Input
              id="holiday-name"
              value={name}
              maxLength={100}
              placeholder="e.g. Diwali"
              onChange={(e) => setName(e.target.value)}
              className="h-9"
            />
          </div>
          <Button type="submit" size="sm" className="h-9" disabled={!canAdd}>
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : "Add"}
          </Button>
        </form>
        {create.isError && (
          <p className="text-xs text-destructive">{(create.error as Error)?.message || "Could not add the holiday."}</p>
        )}

        <div className="max-h-[260px] divide-y divide-border-subtle overflow-y-auto rounded-lg border border-border-subtle">
          {isLoading && (
            <div className="grid place-items-center py-6 text-text-dim">
              <Loader2 className="size-4 animate-spin" />
            </div>
          )}
          {!isLoading && holidays.length === 0 && (
            <p className="py-6 text-center text-sm text-text-dim">No holidays added yet.</p>
          )}
          {holidays.map((h) => (
            <div key={h.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{h.name}</div>
                <div className="text-xs text-text-dim">{fmtDayKey(h.date)}</div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 text-text-dim hover:text-destructive"
                title={`Remove ${h.name}`}
                disabled={remove.isPending}
                onClick={() => remove.mutate(h.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
        {remove.isError && (
          <p className="text-xs text-destructive">{(remove.error as Error)?.message || "Could not remove the holiday."}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
