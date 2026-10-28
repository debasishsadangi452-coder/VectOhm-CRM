import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateTimeLog, useUpdateTimeLog } from "@/hooks/use-time-logs";
import { useTasks } from "@/hooks/use-tasks";
import type { TimeLog } from "@/lib/api/types";

interface TimeLogFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log?: TimeLog;
  defaultTaskId?: string;
}

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TimeLogFormDialog({ open, onOpenChange, log, defaultTaskId }: TimeLogFormDialogProps) {
  const isEdit = !!log;
  const { data: tasks } = useTasks({}, open && !isEdit);
  const createTimeLog = useCreateTimeLog();
  const updateTimeLog = useUpdateTimeLog();

  const [taskId, setTaskId] = useState("");
  const [date, setDate] = useState(todayISODate());
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("0");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTaskId(log?.taskId ?? defaultTaskId ?? "");
    setDate(log?.date ? log.date.slice(0, 10) : todayISODate());
    setHours(log ? String(Math.floor(log.minutes / 60)) : "0");
    setMinutes(log ? String(log.minutes % 60) : "0");
    setNote(log?.note ?? "");
    setError(null);
  }, [open, log, defaultTaskId]);

  const saving = createTimeLog.isPending || updateTimeLog.isPending;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const totalMinutes = Number(hours) * 60 + Number(minutes);
    if (totalMinutes <= 0) {
      setError("Log at least a few minutes.");
      return;
    }
    try {
      if (isEdit && log) {
        await updateTimeLog.mutateAsync({
          id: log.id,
          input: { date, minutes: totalMinutes, note: note || null },
        });
      } else {
        if (!taskId) {
          setError("Choose a task.");
          return;
        }
        await createTimeLog.mutateAsync({ taskId, date, minutes: totalMinutes, note: note || undefined });
      }
      onOpenChange(false);
    } catch {
      setError("Could not save this time log");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit time log" : "Log time"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEdit && (
            <div className="space-y-1.5">
              <Label>Task</Label>
              <Select value={taskId} onValueChange={setTaskId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a task" />
                </SelectTrigger>
                <SelectContent>
                  {tasks?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.project ? `${t.project.name} — ` : ""}
                      {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="tl-date">Date</Label>
            <Input id="tl-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tl-hours">Hours</Label>
              <Input
                id="tl-hours"
                type="number"
                min={0}
                max={24}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tl-minutes">Minutes</Label>
              <Input
                id="tl-minutes"
                type="number"
                min={0}
                max={59}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tl-note">Note (optional)</Label>
            <Textarea id="tl-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : isEdit ? "Save changes" : "Log time"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
