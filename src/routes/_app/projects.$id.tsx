import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, ChevronDown, Code2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CreateTaskPanel } from "@/components/create-task-panel";
import { ZohoTaskPagePanel } from "@/components/zoho-task-page-panel";
import { toast } from "sonner";
import { useDeleteProject, useProject, useUpdateProject } from "@/hooks/use-projects";
import { useUpdateTask } from "@/hooks/use-tasks";
import { useDepartmentGuard } from "@/hooks/use-department-guard";
import { useAuthStore } from "@/stores/auth-store";
import { getInitials } from "@/lib/utils";
import {
  PROJECT_STATUSES,
  type ProjectStatus,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type ProjectTask,
  type ProjectTaskUpdate,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/api/types";

const STATUS_TONE: Record<ProjectStatus, string> = {
  ACTIVE: "text-blue-600 font-bold bg-blue-50 border-blue-200",
  ON_HOLD: "text-amber-600 font-bold bg-amber-50 border-amber-200",
  COMPLETED: "text-emerald-600 font-bold bg-emerald-50 border-emerald-200",
  ARCHIVED: "text-slate-500 font-medium bg-slate-100 border-slate-200",
};

const STATUS_LABEL: Record<ProjectStatus, string> = {
  ACTIVE: "Active",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

// "2h 30m" / "45m" / "" -- same format as the Tasks page's Duration column
// (see tasks.tsx's formatDuration), duplicated locally rather than shared
// since it's a two-line pure function and these routes don't otherwise
// import from each other.
function formatDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return "";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export const Route = createFileRoute("/_app/projects/$id")({
  component: ProjectDetailPage,
});

const PRIORITY_TONE: Record<TaskPriority, string> = {
  LOW: "text-text-dim",
  MEDIUM: "text-info",
  HIGH: "text-warning",
  URGENT: "text-destructive",
};

type Columns = Record<TaskStatus, ProjectTask[]>;

function emptyColumns(): Columns {
  return {
    TODO: [],
    IN_PROGRESS: [],
    IN_REVIEW: [],
    READY_FOR_TESTING: [],
    CHANGES_REQUIRED: [],
    DONE: [],
  };
}

function groupByStatus(tasks: ProjectTask[]): Columns {
  const columns = emptyColumns();
  for (const task of tasks) {
    columns[task.status].push(task);
  }
  for (const status of TASK_STATUSES) {
    columns[status].sort((a, b) => a.position - b.position);
  }
  return columns;
}

function ProjectDetailPage() {
  const { id } = useParams({ from: "/_app/projects/$id" });
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(id);
  const updateProject = useUpdateProject();
  const deleteProjectMutation = useDeleteProject();
  const updateTask = useUpdateTask();
  const currentUser = useAuthStore((s) => s.user);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAdmin = currentUser?.role.name === "ADMIN";
  const isManager = currentUser?.role.name === "MANAGER";
  const isOwner = currentUser?.id === project?.ownerId;
  const canDeleteProject = isAdmin || isManager || isOwner;

  // Closing (or reopening) a task is a manager/admin review step -- see
  // TasksService.assertCanSetStatus, the actual enforcement. Blocking the
  // drag itself (rather than letting it drop then having the backend
  // reject it) avoids the card visually landing in Done while the update
  // silently 403s underneath it.
  const canCloseTasks = currentUser?.role.name === "ADMIN" || currentUser?.role.name === "MANAGER";

  const [columns, setColumns] = useState<Columns>(emptyColumns());
  const [activeTask, setActiveTask] = useState<ProjectTask | null>(null);
  const [showCreateTaskPanel, setShowCreateTaskPanel] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (project) {
      setColumns(groupByStatus(project.tasks));
    }
  }, [project]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function findColumnOf(taskId: string): TaskStatus | undefined {
    return TASK_STATUSES.find((s) => columns[s].some((t) => t.id === taskId));
  }

  function handleDragStart(event: DragStartEvent) {
    const taskId = String(event.active.id);
    const status = findColumnOf(taskId);
    if (status) {
      setActiveTask(columns[status].find((t) => t.id === taskId) ?? null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const sourceStatus = findColumnOf(activeId);
    if (!sourceStatus) return;

    const overId = String(over.id);
    const destStatus = (TASK_STATUSES as string[]).includes(overId)
      ? (overId as TaskStatus)
      : findColumnOf(overId);
    if (!destStatus) return;

    // Same rule as the task dialog's Status field -- only the task's designated
    // Tester (or a Manager/Admin) can close a task (drag into Done) or reopen
    // one (drag out of Done). Refusing the drop here (leaving `columns`
    // untouched) snaps the card back to its original column instead of moving
    // it optimistically and then failing server-side.
    const draggedTask = columns[sourceStatus].find((t) => t.id === activeId);
    const canCloseThisTask = canCloseTasks || draggedTask?.testerId === currentUser?.id;
    if (
      !canCloseThisTask &&
      (destStatus === "DONE" || sourceStatus === "DONE") &&
      destStatus !== sourceStatus
    ) {
      return;
    }

    setColumns((prev) => {
      const sourceList = [...prev[sourceStatus]];
      const taskIndex = sourceList.findIndex((t) => t.id === activeId);
      if (taskIndex === -1) return prev;
      const [moved] = sourceList.splice(taskIndex, 1);

      const destList = sourceStatus === destStatus ? sourceList : [...prev[destStatus]];
      const overIndex = destList.findIndex((t) => t.id === overId);
      const insertAt = overIndex === -1 ? destList.length : overIndex;
      destList.splice(insertAt, 0, { ...moved, status: destStatus });

      updateTask.mutate(
        { id: activeId, input: { status: destStatus, position: insertAt } },
        {
          onError: (err: unknown) => {
            const message =
              (err as { message?: string })?.message || "Failed to update task status";
            toast.error(message);
            if (project) {
              setColumns(groupByStatus(project.tasks));
            }
          },
        },
      );

      return { ...prev, [sourceStatus]: sourceList, [destStatus]: destList };
    });
  }

  if (isLoading || !project) {
    return <div className="p-6 text-text-dim text-sm">Loading…</div>;
  }

  if (showCreateTaskPanel) {
    return (
      <CreateTaskPanel
        defaultProjectId={project.id}
        onBack={() => setShowCreateTaskPanel(false)}
        onCreated={(taskId) => {
          setShowCreateTaskPanel(false);
          setEditingTaskId(taskId);
        }}
      />
    );
  }

  if (editingTaskId) {
    return (
      <div className="p-6 max-w-[1600px] mx-auto min-h-[calc(100vh-4rem)]">
        <ZohoTaskPagePanel taskId={editingTaskId} onClose={() => setEditingTaskId(null)} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-4">
      <Link
        to="/projects"
        className="inline-flex items-center gap-1.5 text-xs text-text-dim hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        All projects
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title="Click to change project status"
                  className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 border rounded-full font-semibold cursor-pointer hover:ring-2 hover:ring-blue-400/50 transition-all ${STATUS_TONE[project.status]}`}
                >
                  <span>{STATUS_LABEL[project.status]}</span>
                  <ChevronDown className="size-3 opacity-70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-36 text-xs bg-white border border-slate-200 shadow-lg rounded-xl p-1 z-50"
              >
                {PROJECT_STATUSES.map((st) => (
                  <DropdownMenuItem
                    key={st}
                    disabled={st === project.status || updateProject.isPending}
                    onClick={() => {
                      updateProject.mutate(
                        { id: project.id, input: { status: st } },
                        {
                          onSuccess: () =>
                            toast.success(
                              `Project status updated to ${STATUS_LABEL[st]}`,
                            ),
                          onError: (err) =>
                            toast.error(
                              err instanceof Error
                                ? err.message
                                : "Failed to update project status",
                            ),
                        },
                      );
                    }}
                    className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                      st === project.status
                        ? "bg-slate-100 font-bold text-blue-600"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <span>{STATUS_LABEL[st]}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {(() => {
            const cleanDesc = project.description
              ? project.description.split(/\*\*Key Deliverables:\*\*/i)[0]?.trim()
              : "";
            return cleanDesc ? (
              <p className="text-sm text-text-dim mt-1 max-w-2xl">{cleanDesc}</p>
            ) : null;
          })()}

          {(project.githubUrl || project.projectPassword) && (
            <div className="flex flex-wrap gap-4 mt-3 bg-panel-elevated/50 border border-border-subtle p-2.5 rounded-lg max-w-2xl text-xs">
              {project.githubUrl && (
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-text-dim uppercase tracking-wider text-[10px]">
                    Repository:
                  </span>
                  <a
                    href={project.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-semibold"
                  >
                    {project.githubUrl}
                  </a>
                </div>
              )}
              {project.projectPassword && (
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-text-dim uppercase tracking-wider text-[10px]">
                    Environment Key:
                  </span>
                  <code className="bg-canvas border border-border-subtle px-1.5 py-0.5 rounded text-[11px] font-mono text-warning">
                    {project.projectPassword}
                  </code>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canDeleteProject && (
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(true)}
              className="gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
            >
              <Trash2 className="size-4" />
              Delete Project
            </Button>
          )}
          <Link to="/dev">
            <Button variant="outline" className="gap-1.5 text-xs font-semibold">
              <Code2 className="size-4 text-primary" />
              Dev Sprints
            </Button>
          </Link>
          <Button onClick={() => setShowCreateTaskPanel(true)}>
            <Plus className="size-4" />
            New Task
          </Button>
        </div>
      </div>

      <div className="mt-4">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {TASK_STATUSES.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                tasks={columns[status]}
                onTaskClick={setEditingTaskId}
              />
            ))}
          </div>
          <DragOverlay>{activeTask && <TaskCard task={activeTask} dragging />}</DragOverlay>
        </DndContext>
      </div>

      <AlertDialog
        open={showDeleteConfirm}
        onOpenChange={(open) => !open && !isDeleting && setShowDeleteConfirm(false)}
      >
        <AlertDialogContent className="max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
                <Trash2 className="size-5" />
              </span>
              Delete Project?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600 space-y-2 mt-2">
              <p>
                Are you sure you want to permanently delete project{" "}
                <strong className="text-slate-900 font-semibold">{project.name}</strong>?
              </p>
              <p className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200/80">
                <strong>Note:</strong> Associated tasks will be detached and retained as standalone tasks. Sprints and member assignments for this project will be removed.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-5 flex items-center justify-end gap-2">
            <AlertDialogCancel
              disabled={isDeleting}
              className="text-xs font-semibold rounded-xl px-4 py-2 hover:bg-slate-100"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                setIsDeleting(true);
                deleteProjectMutation.mutate(
                  { id: project.id, permanent: true },
                  {
                    onSuccess: () => {
                      toast.success(`Project "${project.name}" deleted successfully.`);
                      setShowDeleteConfirm(false);
                      setIsDeleting(false);
                      navigate({ to: "/projects" });
                    },
                    onError: (err) => {
                      toast.error(
                        err instanceof Error ? err.message : "Failed to delete project",
                      );
                      setIsDeleting(false);
                    },
                  },
                );
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl px-4 py-2 transition-colors"
            >
              {isDeleting ? "Deleting..." : "Delete Project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function KanbanColumn({
  status,
  tasks,
  onTaskClick,
}: {
  status: TaskStatus;
  tasks: ProjectTask[];
  onTaskClick: (id: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className="bg-panel border border-border-subtle rounded-xl p-3 flex flex-col gap-2 min-h-[200px]"
    >
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold">{TASK_STATUS_LABELS[status]}</span>
        <span className="text-[10px] text-text-dim">{tasks.length}</span>
      </div>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} onClick={() => onTaskClick(task.id)} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableTaskCard({ task, onClick }: { task: ProjectTask; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={onClick}>
      <TaskCard task={task} />
    </div>
  );
}

function TaskCard({ task, dragging }: { task: ProjectTask; dragging?: boolean }) {
  const loggedMinutes = task.timeLogs.reduce((sum, l) => sum + l.minutes, 0);

  return (
    <div
      className={`bg-canvas/50 border border-border-subtle rounded-lg p-3 cursor-pointer hover:border-border transition-colors ${dragging ? "shadow-xl" : ""}`}
    >
      <p className="text-sm font-medium">{task.title}</p>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-medium ${PRIORITY_TONE[task.priority]}`}>
            {TASK_PRIORITY_LABELS[task.priority]}
          </span>
          {loggedMinutes > 0 && (
            <span className="text-[10px] text-text-dim">{formatDuration(loggedMinutes)}</span>
          )}
        </div>
        {task.assignee && (
          <Avatar className="size-5">
            <AvatarFallback className="text-[9px]">
              {getInitials(task.assignee)}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}
