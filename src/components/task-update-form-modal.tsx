import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Loader2, Send } from "lucide-react";
import { useSubmitTaskUpdate } from "@/hooks/use-task-communication";
import { TASK_STATUS_LABELS, type TaskStatus } from "@/lib/api/types";

interface TaskUpdateFormModalProps {
  taskId: string;
  taskTitle: string;
  initialStatus?: TaskStatus;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function TaskUpdateFormModal({
  taskId,
  taskTitle,
  initialStatus = "IN_PROGRESS",
  open,
  onOpenChange,
  onSuccess,
}: TaskUpdateFormModalProps) {
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [progress, setProgress] = useState<number>(50);
  const [workCompleted, setWorkCompleted] = useState("");
  const [currentWork, setCurrentWork] = useState("");
  const [blockers, setBlockers] = useState("");
  const [expectedCompletion, setExpectedCompletion] = useState("");
  const [additionalMessage, setAdditionalMessage] = useState("");

  const submitMutation = useSubmitTaskUpdate(taskId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await submitMutation.mutateAsync({
        status,
        progress,
        workCompleted: workCompleted.trim() || undefined,
        currentWork: currentWork.trim() || undefined,
        blockers: blockers.trim() || undefined,
        expectedCompletion: expectedCompletion ? new Date(expectedCompletion).toISOString() : undefined,
        additionalMessage: additionalMessage.trim() || undefined,
      });

      // Clear fields
      setWorkCompleted("");
      setCurrentWork("");
      setBlockers("");
      setExpectedCompletion("");
      setAdditionalMessage("");
      onOpenChange(false);
      onSuccess?.();
    } catch {
      // Error handled by mutation toast
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary">
              <ClipboardList className="size-5" />
              <DialogTitle className="text-base font-bold">Submit Task Progress Update</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-text-dim">
              Provide structured progress information for{" "}
              <strong className="text-foreground">"{taskTitle}"</strong>. This will update task
              history and sync to Team Chat.
            </DialogDescription>
          </DialogHeader>

          {/* Readonly Task Reference */}
          <div className="rounded-lg bg-panel-elevated/60 p-3 border border-border-subtle space-y-1">
            <span className="text-[10px] uppercase font-bold text-text-dim tracking-wider">
              Task Reference
            </span>
            <p className="text-xs font-semibold text-foreground truncate">{taskTitle}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Current Status Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Current Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="TODO">Not Started (TODO)</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="READY_FOR_TESTING">Ready for Review / Testing</option>
                <option value="CHANGES_REQUIRED">Changes Required</option>
                <option value="DONE">Completed</option>
              </select>
            </div>

            {/* Expected Completion Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Expected Completion</label>
              <Input
                type="datetime-local"
                value={expectedCompletion}
                onChange={(e) => setExpectedCompletion(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          {/* Progress Slider (0% - 100%) */}
          <div className="space-y-2 rounded-lg bg-card border border-border p-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">Progress Completion</label>
              <Badge variant="outline" className="font-mono text-xs font-bold text-primary">
                {progress}%
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <Slider
                value={[progress]}
                onValueChange={(vals) => setProgress(vals[0])}
                min={0}
                max={100}
                step={5}
                className="flex-1"
              />
              <Input
                type="number"
                min={0}
                max={100}
                value={progress}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) setProgress(Math.max(0, Math.min(100, val)));
                }}
                className="w-16 text-center text-xs h-8 font-mono"
              />
            </div>
          </div>

          {/* Work Completed */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Work Completed</label>
            <Textarea
              placeholder="What have you completed so far?"
              value={workCompleted}
              onChange={(e) => setWorkCompleted(e.target.value)}
              className="text-xs resize-none h-16"
            />
          </div>

          {/* Current Work */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Current Work / What I'm Working On
            </label>
            <Textarea
              placeholder="What specific part are you currently focused on?"
              value={currentWork}
              onChange={(e) => setCurrentWork(e.target.value)}
              className="text-xs resize-none h-16"
            />
          </div>

          {/* Blockers / Issues */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-amber-500">Blockers / Issues (if any)</label>
            <Textarea
              placeholder="Are you blocked by credentials, API, design, or another team member?"
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              className="text-xs resize-none h-16 border-amber-500/30 focus:border-amber-500"
            />
          </div>

          {/* Additional Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-dim">Additional Notes / Message</label>
            <Textarea
              placeholder="Any other details for your Manager/Admin..."
              value={additionalMessage}
              onChange={(e) => setAdditionalMessage(e.target.value)}
              className="text-xs resize-none h-14"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-primary text-primary-foreground gap-1.5"
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="size-3.5" />
                  Send Update
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
