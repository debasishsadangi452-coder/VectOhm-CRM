import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  ClipboardList,
  CornerDownLeft,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  User,
  Shield,
} from "lucide-react";
import { format, formatDistanceToNow, isPast } from "date-fns";
import {
  useTaskCommunication,
  useSendTaskMessage,
} from "@/hooks/use-task-communication";
import { useAuthStore } from "@/stores/auth-store";
import { TaskRequestUpdateDialog } from "./task-request-update-dialog";
import { TaskUpdateFormModal } from "./task-update-form-modal";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, type TaskStatus } from "@/lib/api/types";
import type { TaskMessage } from "@/lib/api/task-communication";

interface TaskCommunicationModalProps {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskCommunicationModal({
  taskId,
  open,
  onOpenChange,
}: TaskCommunicationModalProps) {
  const currentUser = useAuthStore((s) => s.user);
  const isManagerOrAdmin =
    currentUser?.role.name === "ADMIN" || currentUser?.role.name === "MANAGER";

  const { data, isLoading } = useTaskCommunication(taskId || undefined, open);
  const sendMessageMutation = useSendTaskMessage(taskId || "");

  const [messageText, setMessageText] = useState("");
  const [showRequestUpdateDialog, setShowRequestUpdateDialog] = useState(false);
  const [showSubmitUpdateModal, setShowSubmitUpdateModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom on message updates
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [open, data?.messages?.length]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!messageText.trim() || !taskId) return;

    try {
      await sendMessageMutation.mutateAsync({
        message: messageText.trim(),
        messageType: "REPLY",
      });
      setMessageText("");
    } catch {
      // Handled by hook toast
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!taskId) return null;

  const task = data?.task;
  const messages = data?.messages || [];

  const isOverdue =
    task?.dueDate &&
    isPast(new Date(task.dueDate)) &&
    task.status !== "DONE";

  const overdueDuration =
    isOverdue && task.dueDate
      ? formatDistanceToNow(new Date(task.dueDate), { addSuffix: false })
      : null;

  const assigneeName = task?.assignee
    ? `${task.assignee.firstName} ${task.assignee.lastName}`
    : "Unassigned";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-canvas">
          {/* Header Panel */}
          <DialogHeader className="p-4 border-b border-border bg-panel/80 flex-shrink-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1 max-w-[80%]">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-primary/10 text-primary">
                    <MessageSquare className="size-4" />
                  </div>
                  <DialogTitle className="text-base font-bold text-foreground truncate">
                    {task?.title || "Task Communication"}
                  </DialogTitle>
                </div>
                <DialogDescription className="sr-only">
                  Task communication thread and history for {task?.title || "selected task"}
                </DialogDescription>

                <div className="flex flex-wrap items-center gap-2 text-xs text-text-dim pt-1">
                  {task?.status && (
                    <Badge variant="outline" className="text-[10px] font-semibold">
                      {TASK_STATUS_LABELS[task.status]}
                    </Badge>
                  )}

                  {task?.priority && (
                    <Badge variant="secondary" className="text-[10px]">
                      {TASK_PRIORITY_LABELS[task.priority]}
                    </Badge>
                  )}

                  {task?.assignee && (
                    <span className="flex items-center gap-1">
                      <User className="size-3 text-text-dim" />
                      {task.assignee.firstName} {task.assignee.lastName}
                    </span>
                  )}

                  {task?.dueDate && (
                    <span className="flex items-center gap-1 font-medium">
                      <Clock className="size-3" />
                      Due: {format(new Date(task.dueDate), "PP p")}
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2">
                {isManagerOrAdmin && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowRequestUpdateDialog(true)}
                    className="text-xs gap-1.5 border-amber-500/30 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400"
                  >
                    <Bell className="size-3.5" />
                    Request Update
                  </Button>
                )}

                <Button
                  type="button"
                  size="sm"
                  onClick={() => setShowSubmitUpdateModal(true)}
                  className="text-xs gap-1.5 bg-primary text-primary-foreground"
                >
                  <ClipboardList className="size-3.5" />
                  Provide Update
                </Button>
              </div>
            </div>

            {/* Overdue Warning Alert Banner */}
            {isOverdue && (
              <div className="mt-3 flex items-center justify-between rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>
                    <strong>⚠️ Task Deadline Missed:</strong> Overdue by {overdueDuration}. Task is
                    currently {TASK_STATUS_LABELS[task.status]}.
                  </span>
                </div>
              </div>
            )}
          </DialogHeader>

          {/* Conversation Timeline */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-text-dim gap-2">
                <Loader2 className="size-5 animate-spin" />
                <span className="text-xs">Loading conversation history...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-text-dim space-y-2 py-12">
                <MessageSquare className="size-10 opacity-30" />
                <p className="text-sm font-medium">No messages on this task yet</p>
                <p className="text-xs max-w-sm">
                  Send a message or request an update below. All communications automatically sync to
                  Team Chat and notify recipients.
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <TaskMessageItem
                  key={msg.id}
                  message={msg}
                  isCurrentUser={msg.senderId === currentUser?.id}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Message Input Bar */}
          <div className="p-3 border-t border-border bg-panel flex-shrink-0">
            <form onSubmit={handleSendMessage} className="space-y-2">
              <div className="relative">
                <Textarea
                  placeholder="Type a message or response... (Enter to send, Shift+Enter for newline)"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="min-h-[64px] max-h-[140px] text-xs resize-none pr-20 bg-background/80"
                  disabled={sendMessageMutation.isPending}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!messageText.trim() || sendMessageMutation.isPending}
                  className="absolute right-2 bottom-2 text-xs gap-1.5 h-8 px-3"
                >
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <>
                      <Send className="size-3.5" />
                      Send
                    </>
                  )}
                </Button>
              </div>
              <div className="flex items-center justify-between text-[10px] text-text-dim px-1">
                <span className="flex items-center gap-1">
                  <Sparkles className="size-3 text-primary" />
                  Automatically posted to Team Chat and dispatched via notification
                </span>
                <span>Press Enter ↵ to send</span>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Request Update Dialog */}
      {task && (
        <TaskRequestUpdateDialog
          taskId={task.id}
          taskTitle={task.title}
          employeeName={assigneeName}
          open={showRequestUpdateDialog}
          onOpenChange={setShowRequestUpdateDialog}
        />
      )}

      {/* Structured Update Form Modal */}
      {task && (
        <TaskUpdateFormModal
          taskId={task.id}
          taskTitle={task.title}
          initialStatus={task.status}
          open={showSubmitUpdateModal}
          onOpenChange={setShowSubmitUpdateModal}
        />
      )}
    </>
  );
}

function TaskMessageItem({
  message,
  isCurrentUser,
}: {
  message: TaskMessage;
  isCurrentUser: boolean;
}) {
  const senderRole = message.sender?.role?.name;
  const isSystemOrOverdue = message.messageType === "OVERDUE_MESSAGE" || !message.senderId;
  const isUpdateRequest = message.messageType === "UPDATE_REQUEST";
  const isTaskUpdate = message.messageType === "TASK_UPDATE";

  // Overdue Alert Banner
  if (isSystemOrOverdue) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
        <AlertTriangle className="size-4 shrink-0 text-destructive" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold">{message.message}</p>
          <span className="text-[10px] text-destructive/70 mt-0.5 block">
            {format(new Date(message.createdAt), "PP p")}
          </span>
        </div>
      </div>
    );
  }

  // Update Request Card
  if (isUpdateRequest) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-500">
            <Bell className="size-4" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Task Update Requested
            </span>
          </div>
          <span className="text-[10px] text-text-dim">
            {format(new Date(message.createdAt), "PP p")}
          </span>
        </div>

        <div className="flex items-start gap-2.5 pt-1">
          <Avatar className="size-6 shrink-0">
            <AvatarImage src={message.sender?.avatarUrl || undefined} />
            <AvatarFallback className="text-[10px]">
              {(message.sender?.firstName?.[0] || "?").toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground">
              {message.sender?.firstName} {message.sender?.lastName}{" "}
              <Badge variant="outline" className="text-[9px] py-0 ml-1">
                {senderRole === "ADMIN" ? "Admin" : "Manager"}
              </Badge>
            </p>
            <p className="text-xs text-text-dim italic leading-relaxed">
              "{message.message}"
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Structured Task Update Card
  if (isTaskUpdate) {
    return (
      <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <div className="flex items-center gap-2">
            <Avatar className="size-6">
              <AvatarImage src={message.sender?.avatarUrl || undefined} />
              <AvatarFallback className="text-[10px]">
                {(message.sender?.firstName?.[0] || "?").toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <span className="text-xs font-bold text-foreground">
                {message.sender?.firstName} {message.sender?.lastName}
              </span>
              <span className="text-[10px] text-text-dim ml-2">submitted a progress update</span>
            </div>
          </div>
          <span className="text-[10px] text-text-dim">
            {format(new Date(message.createdAt), "PP p")}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          {message.status && (
            <div className="space-y-0.5">
              <span className="text-[10px] text-text-dim uppercase font-bold">Status</span>
              <div>
                <Badge variant="outline" className="text-[10px]">
                  {TASK_STATUS_LABELS[message.status]}
                </Badge>
              </div>
            </div>
          )}

          {message.progress !== null && message.progress !== undefined && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-text-dim uppercase font-bold">Progress</span>
                <span className="font-mono font-bold text-primary text-[11px]">
                  {message.progress}%
                </span>
              </div>
              <Progress value={message.progress} className="h-2" />
            </div>
          )}
        </div>

        {message.workCompleted && (
          <div className="space-y-0.5 text-xs bg-muted/40 p-2.5 rounded-lg border border-border/40">
            <span className="text-[10px] font-bold text-text-dim uppercase">Work Completed</span>
            <p className="text-foreground whitespace-pre-wrap">{message.workCompleted}</p>
          </div>
        )}

        {message.currentWork && (
          <div className="space-y-0.5 text-xs bg-muted/40 p-2.5 rounded-lg border border-border/40">
            <span className="text-[10px] font-bold text-text-dim uppercase">Current Work</span>
            <p className="text-foreground whitespace-pre-wrap">{message.currentWork}</p>
          </div>
        )}

        {message.blockers && (
          <div className="space-y-0.5 text-xs bg-destructive/10 p-2.5 rounded-lg border border-destructive/20 text-destructive">
            <span className="text-[10px] font-bold uppercase flex items-center gap-1">
              <AlertTriangle className="size-3" /> Blockers / Issues
            </span>
            <p className="whitespace-pre-wrap">{message.blockers}</p>
          </div>
        )}

        {message.expectedCompletion && (
          <div className="text-[11px] text-text-dim flex items-center gap-1.5">
            <Clock className="size-3.5 text-primary" />
            <span>Expected Completion:</span>
            <strong className="text-foreground">
              {format(new Date(message.expectedCompletion), "PP p")}
            </strong>
          </div>
        )}

        {message.message && message.message !== "Task update submitted" && (
          <div className="pt-1 text-xs text-text-dim border-t border-border/40">
            <span className="font-semibold text-foreground">Note: </span>
            {message.message}
          </div>
        )}
      </div>
    );
  }

  // Standard Chat Message Bubble
  return (
    <div
      className={`flex items-start gap-2.5 ${
        isCurrentUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      <Avatar className="size-7 shrink-0 mt-0.5">
        <AvatarImage src={message.sender?.avatarUrl || undefined} />
        <AvatarFallback className="text-[10px]">
          {(message.sender?.firstName?.[0] || "?").toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div
        className={`max-w-[80%] rounded-2xl p-3 text-xs space-y-1 ${
          isCurrentUser
            ? "bg-primary text-primary-foreground rounded-tr-none shadow-sm"
            : "bg-card border border-border text-foreground rounded-tl-none shadow-sm"
        }`}
      >
        <div className="flex items-center justify-between gap-2 pb-0.5">
          <div className="flex items-center gap-1.5 font-semibold text-[11px]">
            <span>
              {message.sender?.firstName} {message.sender?.lastName}
            </span>
            {senderRole && (
              <Badge
                variant="outline"
                className={`text-[9px] px-1 py-0 h-4 ${
                  isCurrentUser
                    ? "border-primary-foreground/30 text-primary-foreground"
                    : "border-border text-text-dim"
                }`}
              >
                {senderRole === "ADMIN" ? "Admin" : senderRole === "MANAGER" ? "Manager" : "Employee"}
              </Badge>
            )}
          </div>
          <span
            className={`text-[9px] ${
              isCurrentUser ? "text-primary-foreground/70" : "text-text-dim"
            }`}
          >
            {format(new Date(message.createdAt), "p")}
          </span>
        </div>

        <p className="whitespace-pre-wrap leading-relaxed">{message.message}</p>
      </div>
    </div>
  );
}
