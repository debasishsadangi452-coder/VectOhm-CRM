import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, Loader2, Trash2 } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCreateTask, useDeleteTask, useUpdateTask, useTask } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { useTaskLists } from "@/hooks/use-task-lists";
import { useUsers } from "@/hooks/use-users";
import { useAuthStore } from "@/stores/auth-store";
import { formatRelativeDay } from "@/lib/format-relative-day";
import {
  useTaskUpdates,
  useCreateTaskUpdate,
  useDeleteTaskUpdate,
} from "@/hooks/use-task-updates";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/api/types";

const UNASSIGNED = "__unassigned__";
const NO_PROJECT = "__none__";
const NO_TASK_LIST = "__none__";

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

// Minimal shape both the flat Task list and a project's nested ProjectTask
// list can satisfy, so this dialog works for both without a shared supertype.
export interface TaskFormValue {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  projectId?: string | null;
  assigneeId: string | null;
  dueDate: string | null;
  taskListId?: string | null;
  startDate?: string | null;
  tags?: string[];
}

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: TaskFormValue;
  defaultProjectId?: string;
  lockProject?: boolean;
}

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  defaultProjectId,
  lockProject,
}: TaskFormDialogProps) {
  const isEdit = !!task;
  const { data: projects } = useProjects({}, open);
  const { data: users } = useUsers(open);
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role.name === "ADMIN";
  // Closing a task (or reopening a closed one) is a manager/admin review
  // step -- an employee can move a task up to "In Review" and no further
  // (see TasksService.assertCanSetStatus on the backend, which is the real
  // enforcement; this just keeps the UI from offering an action that would
  // be rejected).
  const canClose = isAdmin || currentUser?.role.name === "MANAGER";
  const isLockedDone = !canClose && task?.status === "DONE";
  // Filtering DONE out of the options only makes sense while it's not
  // already the current value -- once locked, DONE has to stay listed (as
  // the sole, disabled, selection) so the control still displays "Done"
  // instead of an unmatched value.
  const selectableStatuses = canClose || isLockedDone ? TASK_STATUSES : TASK_STATUSES.filter((s) => s !== "DONE");
  // Managers can also hand work to the Dev and Sales teams (e.g. Digital Marketing
  // asking for pages or leads), on top of their own department.
  const isManager = currentUser?.role.name === "MANAGER";
  const assignableUsers = isAdmin
    ? users
    : users?.filter(
        (u) =>
          u.department?.id === currentUser?.department?.id ||
          (isManager && (u.department?.name === "Dev" || u.department?.name === "Sales")),
      );
  // Sales is deal-centric and has no Projects module (see app-sidebar.tsx) --
  // showing a picker that would only ever offer "No project" is just clutter.
  const hideProjectField = currentUser?.department?.name === "Sales";
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("TODO");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [projectId, setProjectId] = useState<string>(NO_PROJECT);
  const [assigneeId, setAssigneeId] = useState<string>(UNASSIGNED);
  const [taskListId, setTaskListId] = useState<string>(NO_TASK_LIST);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("18:00");
  const [tagsInput, setTagsInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: taskLists } = useTaskLists(
    !hideProjectField && projectId !== NO_PROJECT ? projectId : undefined,
  );

  // Subtasks support
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const { data: fullTask } = useTask(isEdit ? task?.id : undefined);

  async function handleAddSubtask() {
    if (!newSubtaskTitle.trim() || !task) return;
    try {
      await createTask.mutateAsync({
        title: newSubtaskTitle.trim(),
        parentId: task.id,
        projectId: task.projectId ?? undefined,
        departmentId: currentUser?.department?.id ?? undefined,
      });
      setNewSubtaskTitle("");
    } catch (err) {
      console.error("Failed to add subtask", err);
    }
  }

  // Progress updates support -- this task's day-by-day "what I did" log,
  // browsed a week at a time (see progressSection below) instead of one
  // long scrolling list, so finding a specific day's notes is a click on
  // that day rather than a scroll.
  const [newUpdateContent, setNewUpdateContent] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const { data: taskUpdates } = useTaskUpdates(isEdit ? task?.id : undefined);
  const createTaskUpdate = useCreateTaskUpdate();
  const deleteTaskUpdate = useDeleteTaskUpdate(task?.id);

  const updatesByDateKey = useMemo(() => {
    const map = new Map<string, NonNullable<typeof taskUpdates>>();
    for (const u of taskUpdates ?? []) {
      const key = new Date(u.createdAt).toDateString();
      const existing = map.get(key);
      if (existing) existing.push(u);
      else map.set(key, [u]);
    }
    return map;
  }, [taskUpdates]);

  const weekStart = useMemo(() => startOfWeek(selectedDate), [selectedDate]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const today = new Date();
  const selectedDayUpdates = updatesByDateKey.get(selectedDate.toDateString()) ?? [];
  const isSelectedToday = isSameDay(selectedDate, today);

  async function handleAddUpdate() {
    if (!newUpdateContent.trim() || !task) return;
    try {
      await createTaskUpdate.mutateAsync({ taskId: task.id, content: newUpdateContent.trim() });
      setNewUpdateContent("");
    } catch (err) {
      console.error("Failed to post update", err);
    }
  }

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setStatus(task?.status ?? "TODO");
    setPriority(task?.priority ?? "MEDIUM");
    setProjectId(task?.projectId ?? defaultProjectId ?? NO_PROJECT);
    setAssigneeId(task?.assigneeId ?? UNASSIGNED);
    setTaskListId(task?.taskListId ?? NO_TASK_LIST);
    setStartDate(task?.startDate ? task.startDate.slice(0, 10) : "");
    setStartTime(task?.startDate && task.startDate.length >= 16 ? task.startDate.slice(11, 16) : "09:00");
    setDueDate(task?.dueDate ? task.dueDate.slice(0, 10) : "");
    setDueTime(task?.dueDate && task.dueDate.length >= 16 ? task.dueDate.slice(11, 16) : "18:00");
    setTagsInput((task?.tags ?? []).join(", "));
    setSelectedDate(new Date());
    setError(null);
  }, [open, task, defaultProjectId]);

  // Task lists are project-scoped -- switching projects invalidates whatever
  // list was previously chosen (a fresh useTaskLists(projectId) is fetched
  // above; this just clears the now-meaningless selection in the UI).
  function handleProjectChange(next: string) {
    setProjectId(next);
    setTaskListId(NO_TASK_LIST);
  }

  const saving = createTask.isPending || updateTask.isPending;
  const deleting = deleteTask.isPending;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const input = {
      title,
      description: description || null,
      status,
      priority,
      projectId: projectId === NO_PROJECT ? null : projectId,
      assigneeId: assigneeId === UNASSIGNED ? null : assigneeId,
      taskListId: projectId === NO_PROJECT || taskListId === NO_TASK_LIST ? null : taskListId,
      startDate: startDate ? new Date(`${startDate}T${startTime || "00:00"}:00`).toISOString() : null,
      dueDate: dueDate ? new Date(`${dueDate}T${dueTime || "23:59"}:00`).toISOString() : null,
      tags,
    };
    try {
      if (isEdit && task) {
        await updateTask.mutateAsync({ id: task.id, input });
      } else {
        await createTask.mutateAsync(input);
      }
      onOpenChange(false);
    } catch {
      setError("Could not save task");
    }
  }

  async function handleDelete() {
    if (!task) return;
    try {
      await deleteTask.mutateAsync({ id: task.id, projectId: task.projectId });
      onOpenChange(false);
    } catch {
      setError("Could not delete task");
    }
  }

  const detailsSection = (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="task-description">Description</Label>
        <Textarea
          id="task-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)} disabled={isLockedDone}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {selectableStatuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {TASK_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isLockedDone && (
            <p className="text-[10px] text-text-dim">Closed -- ask a manager or admin to reopen it.</p>
          )}
          {!canClose && !isLockedDone && (
            <p className="text-[10px] text-text-dim">
              Mark it "In Review" when done -- a manager or admin closes it.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Priority</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {TASK_PRIORITY_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className={hideProjectField ? "" : "grid grid-cols-2 gap-3"}>
        {!hideProjectField && (
          <div className="space-y-1.5">
            <Label>Project</Label>
            <Select value={projectId} onValueChange={handleProjectChange} disabled={lockProject}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PROJECT}>No project</SelectItem>
                {projects?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Assignee</Label>
          <Select value={assigneeId} onValueChange={setAssigneeId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
              {assignableUsers?.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.firstName} {u.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {!hideProjectField && projectId !== NO_PROJECT && (
        <div className="space-y-1.5">
          <Label>Task list</Label>
          <Select value={taskListId} onValueChange={setTaskListId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_TASK_LIST}>General (no list)</SelectItem>
              {taskLists?.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {taskLists?.length === 0 && (
            <p className="text-[10px] text-text-dim">
              No task lists yet for this project -- create one from the project page.
            </p>
          )}
        </div>
      )}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="task-start">Start date</Label>
            <Input
              id="task-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-start-time">Start time</Label>
            <Input
              id="task-start-time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="h-9 text-xs font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="task-due">Due date</Label>
            <Input
              id="task-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-due-time">Due time (Deadline)</Label>
            <Input
              id="task-due-time"
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              className="h-9 text-xs font-mono"
            />
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="task-tags">Tags</Label>
        <Input
          id="task-tags"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="comma, separated, tags"
        />
      </div>
    </div>
  );

  const subtasksSection = (
    <div className="space-y-2">
      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
        {fullTask?.subtasks && fullTask.subtasks.length > 0 ? (
          fullTask.subtasks.map((sub) => {
            const isDone = sub.status === "DONE";
            return (
              <div
                key={sub.id}
                className="flex items-center justify-between gap-2 p-1.5 rounded bg-canvas/30 border border-border-subtle"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isDone}
                    onChange={async (e) => {
                      await updateTask.mutateAsync({
                        id: sub.id,
                        input: { status: e.target.checked ? "DONE" : "TODO" },
                      });
                    }}
                    className="size-3.5 rounded border-border text-primary shrink-0 cursor-pointer"
                  />
                  <span className={`text-xs ${isDone ? "line-through text-text-dim" : "text-text"}`}>
                    {sub.title}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await deleteTask.mutateAsync({ id: sub.id });
                  }}
                  className="text-text-dim hover:text-destructive transition-colors"
                  title="Delete subtask"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            );
          })
        ) : (
          <p className="text-[10px] text-text-dim py-1">No subtasks created yet.</p>
        )}
      </div>
      {canClose && (
        <div className="flex gap-2">
          <Input
            value={newSubtaskTitle}
            onChange={(e) => setNewSubtaskTitle(e.target.value)}
            placeholder="Add subtask..."
            className="h-8 text-xs flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddSubtask();
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            onClick={handleAddSubtask}
            disabled={createTask.isPending || !newSubtaskTitle.trim()}
            className="h-8 text-xs"
          >
            {createTask.isPending ? <Loader2 className="size-3 animate-spin" /> : "Add"}
          </Button>
        </div>
      )}
    </div>
  );

  const progressSection = (
    <div className="space-y-3">
      {/* Week strip -- click any day to jump straight to it instead of
          scrolling a long combined history. Dot marks days with an entry. */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setSelectedDate(addDays(weekStart, -7))}
          className="text-text-dim hover:text-foreground transition-colors p-0.5"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-text-dim">
            {weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} –{" "}
            {addDays(weekStart, 6).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
          {!isSameDay(weekStart, startOfWeek(today)) && (
            <button
              type="button"
              onClick={() => setSelectedDate(today)}
              className="text-[10px] text-primary hover:underline"
            >
              Today
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSelectedDate(addDays(weekStart, 7))}
          className="text-text-dim hover:text-foreground transition-colors p-0.5"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day) => {
          const hasEntries = updatesByDateKey.has(day.toDateString());
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, today);
          return (
            <button
              key={day.toDateString()}
              type="button"
              onClick={() => setSelectedDate(day)}
              className={`flex flex-col items-center gap-0.5 py-1.5 rounded-lg transition-colors ${
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : isToday
                    ? "bg-canvas/60 text-foreground"
                    : "text-text-dim hover:bg-canvas/40 hover:text-foreground"
              }`}
            >
              <span className="text-[9px] uppercase opacity-80">
                {day.toLocaleDateString(undefined, { weekday: "narrow" })}
              </span>
              <span className="text-xs font-semibold">{day.getDate()}</span>
              <span
                className={`size-1 rounded-full ${
                  hasEntries ? (isSelected ? "bg-primary-foreground" : "bg-primary") : "bg-transparent"
                }`}
              />
            </button>
          );
        })}
      </div>

      <div className="border-t border-border-subtle pt-3 space-y-2">
        <p className="text-[10px] font-bold text-text-dim">{formatRelativeDay(selectedDate)}</p>
        {selectedDayUpdates.length > 0 ? (
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {selectedDayUpdates.map((u) => (
              <div
                key={u.id}
                className="flex items-start justify-between gap-2 p-2 rounded-lg bg-canvas/30 border border-border-subtle"
              >
                <div className="min-w-0">
                  <p className="text-xs text-text break-words whitespace-pre-wrap">{u.content}</p>
                  <p className="text-[9px] text-text-dim mt-0.5">
                    {u.user.firstName} {u.user.lastName} ·{" "}
                    {new Date(u.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {u.userId === currentUser?.id && (
                  <button
                    type="button"
                    onClick={() => deleteTaskUpdate.mutate(u.id)}
                    className="text-text-dim hover:text-destructive transition-colors shrink-0"
                    title="Delete update"
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-text-dim py-1">
            {isSelectedToday ? "Nothing logged yet today." : "No updates logged on this day."}
          </p>
        )}

        {isSelectedToday && (
          <div className="flex gap-2">
            <Textarea
              value={newUpdateContent}
              onChange={(e) => setNewUpdateContent(e.target.value)}
              placeholder="What did you work on today?"
              className="text-xs flex-1 min-h-[36px]"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAddUpdate();
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              onClick={handleAddUpdate}
              disabled={createTaskUpdate.isPending || !newUpdateContent.trim()}
              className="h-8 text-xs self-end"
            >
              {createTaskUpdate.isPending ? <Loader2 className="size-3 animate-spin" /> : "Post"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          {isEdit && task ? (
            <Tabs defaultValue="details">
              <TabsList className="w-full">
                <TabsTrigger value="details" className="flex-1">
                  Details
                </TabsTrigger>
                <TabsTrigger value="subtasks" className="flex-1">
                  Subtasks
                </TabsTrigger>
                <TabsTrigger value="progress" className="flex-1">
                  Progress
                </TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="mt-4">
                {detailsSection}
              </TabsContent>
              <TabsContent value="subtasks" className="mt-4">
                {subtasksSection}
              </TabsContent>
              <TabsContent value="progress" className="mt-4">
                {progressSection}
              </TabsContent>
            </Tabs>
          ) : (
            detailsSection
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2 sm:justify-between">
            {isEdit ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Delete
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : isEdit ? "Save changes" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
