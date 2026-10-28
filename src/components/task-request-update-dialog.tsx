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
import { Textarea } from "@/components/ui/textarea";
import { Bell, Loader2 } from "lucide-react";
import { useRequestTaskUpdate } from "@/hooks/use-task-communication";

interface TaskRequestUpdateDialogProps {
  taskId: string;
  taskTitle: string;
  employeeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function TaskRequestUpdateDialog({
  taskId,
  taskTitle,
  employeeName,
  open,
  onOpenChange,
  onSuccess,
}: TaskRequestUpdateDialogProps) {
  const [note, setNote] = useState("");
  const requestMutation = useRequestTaskUpdate(taskId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await requestMutation.mutateAsync({ note: note.trim() || undefined });
      setNote("");
      onOpenChange(false);
      onSuccess?.();
    } catch {
      // Error handled by mutation toast
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-2 text-amber-500">
              <div className="p-2 rounded-full bg-amber-500/10 border border-amber-500/20">
                <Bell className="size-5" />
              </div>
              <DialogTitle className="text-base font-bold">Request Task Update</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-text-dim leading-relaxed">
              Are you sure you want to request a progress update from{" "}
              <strong className="text-foreground">{employeeName || "the assigned employee"}</strong>{" "}
              regarding the task <strong className="text-foreground">"{taskTitle}"</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 space-y-2">
            <label className="text-xs font-medium text-text-dim">
              Add a note or specific question (optional):
            </label>
            <Textarea
              placeholder="e.g. Please let us know the current status and any blockers..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="text-xs resize-none h-20"
              maxLength={500}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={requestMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
              disabled={requestMutation.isPending}
            >
              {requestMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Requesting...
                </>
              ) : (
                <>
                  <Bell className="size-3.5" />
                  Request Update
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
