import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bell,
  Bug as BugIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Filter,
  Flag,
  FolderKanban,
  Layers,
  LayoutDashboard,
  ListFilter,
  ListTodo,
  MessageSquare,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { toast } from "sonner";
import { ZohoTaskPagePanel } from "@/components/zoho-task-page-panel";
import { CreateTaskPanel } from "@/components/create-task-panel";
import { TaskCommunicationModal } from "@/components/task-communication-modal";
import { TaskRequestUpdateDialog } from "@/components/task-request-update-dialog";
import { TaskDeadlineBadge } from "@/components/task-deadline-badge";
import { useTasks, useDeleteTask } from "@/hooks/use-tasks";
import { useNow } from "@/hooks/use-now";
import { getDeadlineInfo, formatDueDate } from "@/lib/task-deadline";
import { useBugs } from "@/hooks/use-bugs";
import { useProjects } from "@/hooks/use-projects";
import { useUsers } from "@/hooks/use-users";
import { useAuthStore } from "@/stores/auth-store";
import {
  BUG_STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  type Bug,
  type ProjectTaskDetail,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/api/types";

export const Route = createFileRoute("/_app/tasks")({
  validateSearch: (search: Record<string, unknown>): { taskId?: string; modal?: string } => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
    modal: typeof search.modal === "string" ? search.modal : undefined,
  }),
  component: TasksPage,
});

type SortField =
  | "taskNumber"
  | "dueDate"
  | "createdAt"
  | "project"
  | "assignee"
  | "priority"
  | "status"
  | "title";

type SortDirection = "asc" | "desc";

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const configs: Record<TaskPriority, { label: string; icon: typeof Flag; className: string }> = {
    URGENT: {
      label: "Urgent",
      icon: AlertCircle,
      className: "border-rose-500/30 bg-rose-500/10 text-rose-400 font-semibold",
    },
    HIGH: {
      label: "High",
      icon: Flag,
      className: "border-amber-500/30 bg-amber-500/10 text-amber-400 font-semibold",
    },
    MEDIUM: {
      label: "Medium",
      icon: Flag,
      className: "border-blue-500/30 bg-blue-500/10 text-blue-400 font-medium",
    },
    LOW: {
      label: "Low",
      icon: Flag,
      className: "border-border/60 bg-muted/40 text-text-dim font-normal",
    },
  };

  const config = configs[priority] || configs.MEDIUM;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border ${config.className}`}
    >
      <Icon className="size-2.5 shrink-0" />
      <span>{config.label}</span>
    </span>
  );
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const configs: Record<TaskStatus, { label: string; className: string; dotColor: string }> = {
    TODO: {
      label: TASK_STATUS_LABELS.TODO || "To Do",
      className: "border-border/60 bg-muted/30 text-text-dim",
      dotColor: "bg-slate-400",
    },
    IN_PROGRESS: {
      label: TASK_STATUS_LABELS.IN_PROGRESS || "In Progress",
      className: "border-blue-500/30 bg-blue-500/10 text-blue-400 font-medium",
      dotColor: "bg-blue-400",
    },
    IN_REVIEW: {
      label: TASK_STATUS_LABELS.IN_REVIEW || "In Review",
      className: "border-amber-500/30 bg-amber-500/10 text-amber-300 font-medium",
      dotColor: "bg-amber-400",
    },
    READY_FOR_TESTING: {
      label: TASK_STATUS_LABELS.READY_FOR_TESTING || "Ready for Review",
      className: "border-purple-500/30 bg-purple-500/10 text-purple-300 font-medium",
      dotColor: "bg-purple-400",
    },
    CHANGES_REQUIRED: {
      label: TASK_STATUS_LABELS.CHANGES_REQUIRED || "Changes Required",
      className: "border-rose-500/30 bg-rose-500/10 text-rose-300 font-medium",
      dotColor: "bg-rose-400",
    },
    DONE: {
      label: TASK_STATUS_LABELS.DONE || "Completed",
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-semibold",
      dotColor: "bg-emerald-400",
    },
  };

  const config = configs[status] || {
    label: status,
    className: "border-border/60 bg-muted/30 text-text-dim",
    dotColor: "bg-slate-400",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] border ${config.className}`}
    >
      <span className={`size-1.5 rounded-full ${config.dotColor}`} />
      <span>{config.label}</span>
    </span>
  );
}

function SortableHeader({
  label,
  field,
  currentSort,
  currentDirection,
  onSort,
  className = "",
}: {
  label: string;
  field: SortField;
  currentSort: SortField;
  currentDirection: SortDirection;
  onSort: (field: SortField) => void;
  className?: string;
}) {
  const isActive = currentSort === field;
  return (
    <th className={`px-3.5 py-3 select-none whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-text-dim ${className}`}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`group inline-flex items-center gap-1.5 transition-colors cursor-pointer hover:text-text whitespace-nowrap ${
          isActive ? "text-primary font-bold" : "text-text-dim"
        }`}
        title={`Sort by ${label} (${isActive ? (currentDirection === "asc" ? "Ascending" : "Descending") : "click to sort"})`}
      >
        <span>{label}</span>
        {isActive ? (
          currentDirection === "asc" ? (
            <ArrowUp className="size-3 text-primary shrink-0 transition-transform" />
          ) : (
            <ArrowDown className="size-3 text-primary shrink-0 transition-transform" />
          )
        ) : (
          <ArrowUpDown className="size-3 text-text-dim/40 shrink-0 group-hover:text-text-dim transition-colors" />
        )}
      </button>
    </th>
  );
}

function getPageNumbers(currentPage: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages];
  }
  if (currentPage >= totalPages - 3) {
    return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
}

function TasksPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const currentUser = useAuthStore((s) => s.user);
  // Ticks every minute so deadlines flip to Overdue on screen without a reload.
  const now = useNow();
  const isManagerOrAdmin =
    currentUser?.role.name === "ADMIN" || currentUser?.role.name === "MANAGER";

  const { data: tasks = [], isLoading } = useTasks();
  const { data: bugs = [] } = useBugs();
  const { data: projects = [] } = useProjects();
  const { data: users = [] } = useUsers();

  const [activeViewTab, setActiveViewTab] = useState<
    "all" | "manager_dashboard" | "employee_dashboard" | "tester_dashboard"
  >("all");

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    search?.modal !== "communication" ? search?.taskId || null : null,
  );
  const [selectedTaskTab, setSelectedTaskTab] = useState<
    "overview" | "timelogs" | "activity" | "review"
  >("overview");

  // Review sub-filter inside tester_dashboard
  const [reviewSubFilter, setReviewSubFilter] = useState<
    "ALL" | "READY_FOR_TESTING" | "IN_REVIEW" | "CHANGES_REQUIRED" | "PENDING_TIMELOGS" | "OPEN_BUGS"
  >("ALL");

  // Communication modal state (also triggered by notification deep-link)
  const [commTaskId, setCommTaskId] = useState<string | null>(
    search?.modal === "communication" && search?.taskId ? search.taskId : null,
  );
  const [showCommModal, setShowCommModal] = useState<boolean>(
    search?.modal === "communication" && !!search?.taskId,
  );

  // Request update dialog state
  const [reqUpdateTask, setReqUpdateTask] = useState<{ id: string; title: string; assigneeName: string } | null>(null);

  // Task delete dialog state
  const deleteTaskMutation = useDeleteTask();
  const [taskToDelete, setTaskToDelete] = useState<ProjectTaskDetail | null>(null);
  const [isDeletingTask, setIsDeletingTask] = useState(false);

  useEffect(() => {
    if (search?.modal === "communication" && search?.taskId) {
      setCommTaskId(search.taskId);
      setShowCommModal(true);
    } else if (search?.taskId) {
      setSelectedTaskId(search.taskId);
    }
  }, [search?.taskId, search?.modal]);

  const [showCreateTaskPanel, setShowCreateTaskPanel] = useState(false);

  // Filters & Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("ALL");
  const [employeeFilter, setEmployeeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");

  // Sorting State
  const [sortBy, setSortBy] = useState<SortField>("taskNumber");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Pagination State
  const [pageSize, setPageSize] = useState<number | "ALL">(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const taskList = useMemo(
    () => (Array.isArray(tasks) ? (tasks as unknown as ProjectTaskDetail[]) : []),
    [tasks],
  );
  const projectList = useMemo(() => (Array.isArray(projects) ? projects : []), [projects]);
  const bugList = useMemo(() => (Array.isArray(bugs) ? (bugs as unknown as Bug[]) : []), [bugs]);

  // Unique Employees options (from users hook + task assignees)
  const employeeOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();

    (users || []).forEach((u) => {
      if (u?.id) {
        const fullName = `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email;
        map.set(u.id, { id: u.id, name: fullName });
      }
    });

    taskList.forEach((t) => {
      if (t.assignee?.id && !map.has(t.assignee.id)) {
        const name = `${t.assignee.firstName || ""} ${t.assignee.lastName || ""}`.trim() || "Assignee";
        map.set(t.assignee.id, { id: t.assignee.id, name });
      }
      t.assignees?.forEach((a) => {
        if (a.user?.id && !map.has(a.user.id)) {
          const name = `${a.user.firstName || ""} ${a.user.lastName || ""}`.trim() || "Assignee";
          map.set(a.user.id, { id: a.user.id, name });
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [users, taskList]);

  // Unique Projects options
  const projectOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    projectList.forEach((p) => {
      if (p?.id) map.set(p.id, { id: p.id, name: p.name });
    });
    taskList.forEach((t) => {
      if (t.project?.id && !map.has(t.project.id)) {
        map.set(t.project.id, { id: t.project.id, name: t.project.name });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [projectList, taskList]);

  // Filter tasks with view tab awareness and all active filters
  const filteredTasks = useMemo(() => {
    return taskList.filter((t) => {
      if (!t) return false;

      // View tab filtering
      if (activeViewTab === "employee_dashboard") {
        const isAssigned =
          t.assigneeId === currentUser?.id ||
          t.assignee?.id === currentUser?.id ||
          t.assignees?.some((a) => a?.userId === currentUser?.id || a?.user?.id === currentUser?.id);
        if (!isAssigned) return false;
      } else if (activeViewTab === "tester_dashboard") {
        const hasPendingLogs = t.timeLogs?.some((l) => l.status === "PENDING" || !l.status);
        const hasOpenBugs =
          (t.bugs?.some((b) => b.status !== "CLOSED" && b.status !== "FIXED")) ||
          t.subtasks?.some((st) => st.bugs?.some((b) => b.status !== "CLOSED" && b.status !== "FIXED"));

        const isReviewQueueItem =
          t.testerId === currentUser?.id ||
          t.status === "READY_FOR_TESTING" ||
          t.status === "IN_REVIEW" ||
          (isManagerOrAdmin && t.status === "CHANGES_REQUIRED") ||
          (isManagerOrAdmin && hasPendingLogs);
        if (!isReviewQueueItem) return false;

        // Apply sub-filter if selected
        if (reviewSubFilter === "READY_FOR_TESTING" && t.status !== "READY_FOR_TESTING") return false;
        if (reviewSubFilter === "IN_REVIEW" && t.status !== "IN_REVIEW") return false;
        if (reviewSubFilter === "CHANGES_REQUIRED" && t.status !== "CHANGES_REQUIRED") return false;
        if (reviewSubFilter === "PENDING_TIMELOGS" && !hasPendingLogs) return false;
        if (reviewSubFilter === "OPEN_BUGS" && !hasOpenBugs) return false;
      }

      // 1. Multi-field Search
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const taskNumStr = String(t.taskNumber || "");
        const numMatches = taskNumStr === q || taskNumStr.includes(q) || (`#${taskNumStr}`).includes(q);
        const titleMatches = (t.title || "").toLowerCase().includes(q);
        const projectMatches = (t.project?.name || "general / standalone").toLowerCase().includes(q);
        const descMatches = (t.description || "").toLowerCase().includes(q);
        const priorityMatches = (TASK_PRIORITY_LABELS[t.priority] || "").toLowerCase().includes(q);
        const statusMatches = (TASK_STATUS_LABELS[t.status] || "").toLowerCase().includes(q);
        const tagMatches = t.tags?.some((tag) => tag.toLowerCase().includes(q)) ?? false;

        const primaryAssigneeName = `${t.assignee?.firstName || ""} ${t.assignee?.lastName || ""}`.toLowerCase();
        const primaryAssigneeEmail = (t.assignee?.email || "").toLowerCase();
        const assigneeMatches =
          primaryAssigneeName.includes(q) ||
          primaryAssigneeEmail.includes(q) ||
          (t.assignees?.some((a) => {
            const name = `${a.user?.firstName || ""} ${a.user?.lastName || ""}`.toLowerCase();
            const email = (a.user?.email || "").toLowerCase();
            return name.includes(q) || email.includes(q);
          }) ?? false);

        if (
          !numMatches &&
          !titleMatches &&
          !projectMatches &&
          !descMatches &&
          !priorityMatches &&
          !statusMatches &&
          !tagMatches &&
          !assigneeMatches
        ) {
          return false;
        }
      }

      // 2. Project Filter
      if (projectFilter !== "ALL") {
        if (projectFilter === "NO_PROJECT") {
          if (t.projectId || t.project?.id) return false;
        } else {
          if (t.projectId !== projectFilter && t.project?.id !== projectFilter) return false;
        }
      }

      // 3. Employee Filter
      if (employeeFilter !== "ALL") {
        if (employeeFilter === "UNASSIGNED") {
          const hasAssignee =
            !!t.assigneeId || !!t.assignee || (t.assignees && t.assignees.length > 0);
          if (hasAssignee) return false;
        } else if (employeeFilter === "ME") {
          const isMe =
            t.assigneeId === currentUser?.id ||
            t.assignee?.id === currentUser?.id ||
            t.assignees?.some((a) => a?.userId === currentUser?.id || a?.user?.id === currentUser?.id);
          if (!isMe) return false;
        } else {
          const isThisEmployee =
            t.assigneeId === employeeFilter ||
            t.assignee?.id === employeeFilter ||
            t.assignees?.some((a) => a?.userId === employeeFilter || a?.user?.id === employeeFilter);
          if (!isThisEmployee) return false;
        }
      }

      // 4. Status Filter
      const deadlineState = getDeadlineInfo(t, now).state;
      if (statusFilter !== "ALL") {
        if (statusFilter === "OVERDUE") {
          if (deadlineState !== "overdue") return false;
        } else if (statusFilter === "DUE_SOON") {
          if (deadlineState !== "due_soon") return false;
        } else {
          if (t.status !== statusFilter) return false;
        }
      }

      // 5. Priority Filter
      if (priorityFilter !== "ALL") {
        if (t.priority !== priorityFilter) return false;
      }

      return true;
    });
  }, [
    taskList,
    activeViewTab,
    reviewSubFilter,
    currentUser?.id,
    isManagerOrAdmin,
    searchQuery,
    projectFilter,
    employeeFilter,
    statusFilter,
    priorityFilter,
    now,
  ]);

  // Sort tasks by chosen field & direction
  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      // 1. Task Number Sort (Pure numeric comparison)
      if (sortBy === "taskNumber") {
        const numA = Number(a.taskNumber) || 0;
        const numB = Number(b.taskNumber) || 0;
        return sortDirection === "asc" ? numA - numB : numB - numA;
      }

      // 2. Date Sort: Due Date (Overdue/earliest first or latest first)
      if (sortBy === "dueDate") {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1; // Tasks without due date placed at bottom
        if (!b.dueDate) return -1;
        const timeA = new Date(a.dueDate).getTime();
        const timeB = new Date(b.dueDate).getTime();
        return sortDirection === "asc" ? timeA - timeB : timeB - timeA;
      }

      // 3. Date Sort: Created Date
      if (sortBy === "createdAt") {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return sortDirection === "asc" ? timeA - timeB : timeB - timeA;
      }

      // 4. Project Sort
      if (sortBy === "project") {
        const projA = (a.project?.name || "General / Standalone").trim().toLowerCase();
        const projB = (b.project?.name || "General / Standalone").trim().toLowerCase();
        const cmp = projA.localeCompare(projB);
        return sortDirection === "asc" ? cmp : -cmp;
      }

      // 5. Employee / Assignee Sort
      if (sortBy === "assignee") {
        const getAssigneeText = (task: ProjectTaskDetail) => {
          if (task.assignee?.firstName || task.assignee?.lastName) {
            return `${task.assignee.firstName || ""} ${task.assignee.lastName || ""}`.trim().toLowerCase();
          }
          if (task.assignees && task.assignees.length > 0) {
            const u = task.assignees[0]?.user;
            if (u?.firstName || u?.lastName) {
              return `${u.firstName || ""} ${u.lastName || ""}`.trim().toLowerCase();
            }
          }
          return "zzz_unassigned";
        };
        const nameA = getAssigneeText(a);
        const nameB = getAssigneeText(b);
        const cmp = nameA.localeCompare(nameB);
        return sortDirection === "asc" ? cmp : -cmp;
      }

      // 6. Priority Sort
      if (sortBy === "priority") {
        const weights: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        const wA = weights[a.priority] ?? 0;
        const wB = weights[b.priority] ?? 0;
        return sortDirection === "asc" ? wA - wB : wB - wA;
      }

      // 7. Status Sort (workflow order)
      if (sortBy === "status") {
        const order: Record<string, number> = {
          URGENT: 1,
          IN_PROGRESS: 2,
          READY_FOR_TESTING: 3,
          IN_REVIEW: 4,
          CHANGES_REQUIRED: 5,
          TODO: 6,
          DONE: 7,
        };
        const oA = order[a.status] ?? 99;
        const oB = order[b.status] ?? 99;
        return sortDirection === "asc" ? oA - oB : oB - oA;
      }

      // 8. Title Sort
      if (sortBy === "title") {
        const tA = (a.title || "").trim().toLowerCase();
        const tB = (b.title || "").trim().toLowerCase();
        const cmp = tA.localeCompare(tB);
        return sortDirection === "asc" ? cmp : -cmp;
      }

      return 0;
    });
  }, [filteredTasks, sortBy, sortDirection]);

  // Reset pagination to page 1 whenever any filter, search, view tab, or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchQuery,
    projectFilter,
    employeeFilter,
    statusFilter,
    priorityFilter,
    activeViewTab,
    reviewSubFilter,
    sortBy,
    sortDirection,
  ]);

  // Pagination computations
  const totalItems = sortedTasks.length;
  const numericPageSize = pageSize === "ALL" ? totalItems || 1 : pageSize;
  const totalPages = pageSize === "ALL" ? 1 : Math.max(1, Math.ceil(totalItems / numericPageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = pageSize === "ALL" ? 0 : (safeCurrentPage - 1) * numericPageSize;
  const endIndex = pageSize === "ALL" ? totalItems : Math.min(startIndex + numericPageSize, totalItems);

  const paginatedTasks = useMemo(() => {
    if (pageSize === "ALL") return sortedTasks;
    return sortedTasks.slice(startIndex, endIndex);
  }, [sortedTasks, pageSize, startIndex, endIndex]);

  const pageNumbers = useMemo(() => {
    return getPageNumbers(safeCurrentPage, totalPages);
  }, [safeCurrentPage, totalPages]);

  // Handler for column header clicking
  const handleColumnSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      // Default natural directions:
      // Numbers, Dates, Priority default to desc (highest/latest first) or asc for overdue
      if (field === "dueDate" || field === "title" || field === "project" || field === "assignee") {
        setSortDirection("asc");
      } else {
        setSortDirection("desc");
      }
    }
  };

  // Metrics for Dashboards
  const totalTasks = taskList.length;
  const activeProjectsCount = projectList.filter((p) => p?.status === "ACTIVE").length;
  const pendingTestingCount = taskList.filter(
    (t) => t?.status === "READY_FOR_TESTING" || t?.status === "IN_REVIEW",
  ).length;
  const inProgressCount = taskList.filter((t) => t?.status === "IN_PROGRESS").length;
  const completedTasksCount = taskList.filter((t) => t?.status === "DONE").length;
  const overdueCount = taskList.filter((t) => t && getDeadlineInfo(t, now).state === "overdue").length;
  const dueSoonCount = taskList.filter((t) => t && getDeadlineInfo(t, now).state === "due_soon").length;
  const unassignedCount = taskList.filter(
    (t) => !t.assigneeId && !t.assignee && (!t.assignees || t.assignees.length === 0),
  ).length;

  const openBugs = bugList.filter((b) => b?.status !== "CLOSED");
  const criticalBugs = bugList.filter(
    (b) => b?.status !== "CLOSED" && (b?.severity === "CRITICAL" || b?.severity === "HIGH"),
  );

  const myTasks = taskList.filter(
    (t) =>
      t?.assigneeId === currentUser?.id ||
      t?.assignee?.id === currentUser?.id ||
      t?.assignees?.some((a) => a?.userId === currentUser?.id || a?.user?.id === currentUser?.id),
  );

  const myBugs = bugList.filter((b) => b?.assigneeId === currentUser?.id && b?.status !== "CLOSED");

  // Comprehensive Review Queue Metrics
  const reviewReadyTasks = useMemo(
    () => taskList.filter((t) => t?.status === "READY_FOR_TESTING"),
    [taskList],
  );
  const inReviewTasks = useMemo(
    () => taskList.filter((t) => t?.status === "IN_REVIEW"),
    [taskList],
  );
  const changesRequiredTasks = useMemo(
    () => taskList.filter((t) => t?.status === "CHANGES_REQUIRED"),
    [taskList],
  );
  const tasksWithPendingTimeLogs = useMemo(
    () => taskList.filter((t) => t?.timeLogs?.some((l) => l.status === "PENDING" || !l.status)),
    [taskList],
  );
  const tasksWithOpenBugs = useMemo(
    () =>
      taskList.filter(
        (t) =>
          (t?.status === "READY_FOR_TESTING" || t?.status === "IN_REVIEW") &&
          ((t?.bugs?.some((b) => b.status !== "CLOSED" && b.status !== "FIXED")) ||
            t?.subtasks?.some((st) =>
              st.bugs?.some((b) => b.status !== "CLOSED" && b.status !== "FIXED"),
            )),
      ),
    [taskList],
  );

  const testingQueue = useMemo(() => {
    return taskList.filter(
      (t) =>
        t?.testerId === currentUser?.id ||
        t?.status === "READY_FOR_TESTING" ||
        t?.status === "IN_REVIEW" ||
        (isManagerOrAdmin && t?.status === "CHANGES_REQUIRED") ||
        (isManagerOrAdmin && t?.timeLogs?.some((l) => l.status === "PENDING" || !l.status)),
    );
  }, [taskList, currentUser?.id, isManagerOrAdmin]);

  // Check if any filter is actively applied
  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    projectFilter !== "ALL" ||
    employeeFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    priorityFilter !== "ALL";

  const handleResetFilters = () => {
    setSearchQuery("");
    setProjectFilter("ALL");
    setEmployeeFilter("ALL");
    setStatusFilter("ALL");
    setPriorityFilter("ALL");
  };

  if (showCreateTaskPanel) {
    return (
      <CreateTaskPanel
        onBack={() => setShowCreateTaskPanel(false)}
        onCreated={(taskId) => {
          setShowCreateTaskPanel(false);
          setSelectedTaskId(taskId);
        }}
      />
    );
  }

  if (selectedTaskId) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] w-full min-h-0 overflow-hidden bg-background text-text">
        <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-card">
          <ZohoTaskPagePanel
            taskId={selectedTaskId}
            initialTab={selectedTaskTab}
            initialOpenCommunication={search?.modal === "communication"}
            onClose={() => {
              setSelectedTaskId(null);
              setSelectedTaskTab("overview");
              navigate({ to: "/tasks", search: { taskId: undefined, modal: undefined }, replace: true });
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-h-0 overflow-hidden bg-background text-text">
      {/* ── Main Task Workspace ── */}
      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto w-full">
        {/* Workspace Header */}
        <div className="border-b border-border bg-card/75 p-6 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="text-xs text-primary font-mono bg-primary/5 border-primary/20 px-2 py-0.5"
                >
                  <Sparkles className="size-3 mr-1 inline" />
                  Recruitment & Operations Engine
                </Badge>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-text mt-1">
                Tasks & Activities Workspace
              </h1>
              <p className="text-xs text-text-dim mt-0.5">
                Centralized task tracking, assignee workflows, deadlines, and deliverables
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                onClick={() => setShowCreateTaskPanel(true)}
                className="gap-2 font-semibold shadow-md cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="h-4 w-4" />
                New Task
              </Button>
            </div>
          </div>

          {/* Dashboards & View Selector Tabs */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3">
            <div className="inline-flex p-1 bg-muted/60 rounded-xl border border-border/60 gap-1 flex-wrap">
              {isManagerOrAdmin ? (
                <>
                  <button
                    onClick={() => setActiveViewTab("all")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeViewTab === "all"
                        ? "bg-card text-text shadow-xs border border-border/60"
                        : "text-text-dim hover:text-text hover:bg-card/40"
                    }`}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    All Tasks & Projects
                    <span
                      className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        activeViewTab === "all"
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-text-dim"
                      }`}
                    >
                      {taskList.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveViewTab("manager_dashboard")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeViewTab === "manager_dashboard"
                        ? "bg-card text-text shadow-xs border border-border/60"
                        : "text-text-dim hover:text-text hover:bg-card/40"
                    }`}
                  >
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    Manager Dashboard
                  </button>

                  <button
                    onClick={() => setActiveViewTab("employee_dashboard")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeViewTab === "employee_dashboard"
                        ? "bg-card text-text shadow-xs border border-border/60"
                        : "text-text-dim hover:text-text hover:bg-card/40"
                    }`}
                  >
                    <User className="h-3.5 w-3.5" />
                    My Workload
                    <span
                      className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        activeViewTab === "employee_dashboard"
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-text-dim"
                      }`}
                    >
                      {myTasks.length}
                    </span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setActiveViewTab("all")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeViewTab === "all" || activeViewTab === "employee_dashboard"
                      ? "bg-card text-text shadow-xs border border-border/60"
                      : "text-text-dim hover:text-text hover:bg-card/40"
                  }`}
                >
                  <User className="h-3.5 w-3.5" />
                  My Assigned Tasks
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/15 text-primary">
                    {taskList.length}
                  </span>
                </button>
              )}

              <button
                onClick={() => setActiveViewTab("tester_dashboard")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeViewTab === "tester_dashboard"
                    ? "bg-purple-600 text-white shadow-xs font-bold"
                    : "text-text-dim hover:text-text hover:bg-card/40"
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Review & Approval Queue
                <span
                  className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    activeViewTab === "tester_dashboard"
                      ? "bg-white/20 text-white"
                      : "bg-muted text-text-dim"
                  }`}
                >
                  {testingQueue.length}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Views Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* MANAGER DASHBOARD EXECUTIVE VIEW */}
          {activeViewTab === "manager_dashboard" && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-text flex items-center gap-2">
                <LayoutDashboard className="size-4 text-primary" />
                Manager Executive Summary
              </h2>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("OVERDUE");
                    setActiveViewTab("all");
                  }}
                  className={`rounded-xl border p-4 text-left shadow-sm cursor-pointer transition-all ${
                    overdueCount > 0
                      ? "border-destructive/40 bg-destructive/10 hover:bg-destructive/15"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <span className="text-xs text-text-dim font-medium flex items-center justify-between">
                    Overdue Tasks
                    {overdueCount > 0 && <AlertTriangle className="size-3.5 text-destructive" />}
                  </span>
                  <p
                    className={`text-2xl font-bold font-mono mt-1 ${
                      overdueCount > 0 ? "text-destructive" : "text-text"
                    }`}
                  >
                    {overdueCount}
                  </p>
                  <span className="text-[10px] text-text-dim block mt-0.5">
                    {dueSoonCount} due within 1 hour
                  </span>
                </button>

                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <span className="text-xs text-text-dim font-medium">Active Projects</span>
                  <p className="text-2xl font-bold text-text font-mono mt-1">
                    {activeProjectsCount}
                  </p>
                  <span className="text-[10px] text-text-dim block mt-0.5">
                    {projectList.length} total accounts
                  </span>
                </div>

                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <span className="text-xs text-text-dim font-medium">Pending Review</span>
                  <p className="text-2xl font-bold text-purple-400 font-mono mt-1">
                    {pendingTestingCount}
                  </p>
                  <span className="text-[10px] text-text-dim block mt-0.5">
                    Ready for verification
                  </span>
                </div>

                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <span className="text-xs text-text-dim font-medium">Action Items</span>
                  <p className="text-2xl font-bold text-amber-400 font-mono mt-1">
                    {openBugs.length}
                  </p>
                  <span className="text-[10px] text-text-dim block mt-0.5">
                    Open escalations & bugs
                  </span>
                </div>

                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <span className="text-xs text-text-dim font-medium">Critical Priorities</span>
                  <p className="text-2xl font-bold text-rose-400 font-mono mt-1">
                    {criticalBugs.length}
                  </p>
                  <span className="text-[10px] text-text-dim block mt-0.5">
                    Immediate resolution needed
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* EMPLOYEE / RECRUITER DASHBOARD VIEW */}
          {activeViewTab === "employee_dashboard" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-text flex items-center gap-2">
                  <User className="size-4 text-primary" />
                  My Assigned Tasks & Deliverables
                </h2>
                <Badge variant="outline" className="text-xs font-semibold text-primary">
                  {myTasks.length} Active Item{myTasks.length === 1 ? "" : "s"}
                </Badge>
              </div>
              {myBugs.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    {myBugs.length} Action Item(s) Requiring Attention
                  </div>
                  <div className="divide-y divide-amber-500/20">
                    {myBugs.map((b) => (
                      <div key={b.id} className="py-2 flex items-center justify-between text-xs">
                        <span className="font-semibold text-text">
                          Action #{b.bugNumber}: {b.title}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {BUG_STATUS_LABELS[b.status]}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* REVIEW / VERIFICATION QUEUE EXECUTIVE VIEW */}
          {activeViewTab === "tester_dashboard" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-5 text-purple-400" />
                    <h2 className="text-base font-bold text-text">
                      Quality Gate & Review Operations Center
                    </h2>
                    <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-300 border-purple-500/30">
                      Signoff Authority
                    </Badge>
                  </div>
                  <p className="text-xs text-text-dim mt-0.5">
                    Centralized review workstation to audit deliverables, verify candidate status, inspect time logs, and approve final signoffs
                  </p>
                </div>

                {reviewSubFilter !== "ALL" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setReviewSubFilter("ALL")}
                    className="h-7 text-xs text-purple-400 hover:bg-purple-500/10 cursor-pointer"
                  >
                    Reset Review Filter
                  </Button>
                )}
              </div>

              {/* 5 Executive Review Metric Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {/* 1. Ready for Signoff */}
                <button
                  type="button"
                  onClick={() =>
                    setReviewSubFilter((prev) =>
                      prev === "READY_FOR_TESTING" ? "ALL" : "READY_FOR_TESTING",
                    )
                  }
                  className={`rounded-xl border p-3.5 text-left shadow-xs transition-all cursor-pointer ${
                    reviewSubFilter === "READY_FOR_TESTING"
                      ? "border-purple-500 bg-purple-500/15 ring-1 ring-purple-500/40"
                      : "border-border bg-card hover:border-purple-500/40 hover:bg-card/80"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-text-dim font-medium">
                    <span>Ready for Signoff</span>
                    <ShieldCheck className="size-3.5 text-purple-400" />
                  </div>
                  <p className="text-2xl font-bold font-mono text-purple-400 mt-1">
                    {reviewReadyTasks.length}
                  </p>
                  <span className="text-[10px] text-text-dim block mt-0.5">
                    Ready for evaluator validation
                  </span>
                </button>

                {/* 2. Active Under Review */}
                <button
                  type="button"
                  onClick={() =>
                    setReviewSubFilter((prev) =>
                      prev === "IN_REVIEW" ? "ALL" : "IN_REVIEW",
                    )
                  }
                  className={`rounded-xl border p-3.5 text-left shadow-xs transition-all cursor-pointer ${
                    reviewSubFilter === "IN_REVIEW"
                      ? "border-amber-500 bg-amber-500/15 ring-1 ring-amber-500/40"
                      : "border-border bg-card hover:border-amber-500/40 hover:bg-card/80"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-text-dim font-medium">
                    <span>Under Active Review</span>
                    <Clock className="size-3.5 text-amber-400" />
                  </div>
                  <p className="text-2xl font-bold font-mono text-amber-400 mt-1">
                    {inReviewTasks.length}
                  </p>
                  <span className="text-[10px] text-text-dim block mt-0.5">
                    Evaluations currently in flight
                  </span>
                </button>

                {/* 3. Changes Requested */}
                <button
                  type="button"
                  onClick={() =>
                    setReviewSubFilter((prev) =>
                      prev === "CHANGES_REQUIRED" ? "ALL" : "CHANGES_REQUIRED",
                    )
                  }
                  className={`rounded-xl border p-3.5 text-left shadow-xs transition-all cursor-pointer ${
                    reviewSubFilter === "CHANGES_REQUIRED"
                      ? "border-rose-500 bg-rose-500/15 ring-1 ring-rose-500/40"
                      : "border-border bg-card hover:border-rose-500/40 hover:bg-card/80"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-text-dim font-medium">
                    <span>Changes Requested</span>
                    <AlertTriangle className="size-3.5 text-rose-400" />
                  </div>
                  <p className="text-2xl font-bold font-mono text-rose-400 mt-1">
                    {changesRequiredTasks.length}
                  </p>
                  <span className="text-[10px] text-text-dim block mt-0.5">
                    Awaiting employee rework
                  </span>
                </button>

                {/* 4. Pending Time Approval */}
                <button
                  type="button"
                  onClick={() =>
                    setReviewSubFilter((prev) =>
                      prev === "PENDING_TIMELOGS" ? "ALL" : "PENDING_TIMELOGS",
                    )
                  }
                  className={`rounded-xl border p-3.5 text-left shadow-xs transition-all cursor-pointer ${
                    reviewSubFilter === "PENDING_TIMELOGS"
                      ? "border-emerald-500 bg-emerald-500/15 ring-1 ring-emerald-500/40"
                      : "border-border bg-card hover:border-emerald-500/40 hover:bg-card/80"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-text-dim font-medium">
                    <span>Pending Time Logs</span>
                    <Clock className="size-3.5 text-emerald-400" />
                  </div>
                  <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                    {tasksWithPendingTimeLogs.length}
                  </p>
                  <span className="text-[10px] text-text-dim block mt-0.5">
                    Tasks awaiting time log audit
                  </span>
                </button>

                {/* 5. Blocked by Defects */}
                <button
                  type="button"
                  onClick={() =>
                    setReviewSubFilter((prev) =>
                      prev === "OPEN_BUGS" ? "ALL" : "OPEN_BUGS",
                    )
                  }
                  className={`rounded-xl border p-3.5 text-left shadow-xs transition-all cursor-pointer ${
                    reviewSubFilter === "OPEN_BUGS"
                      ? "border-destructive bg-destructive/15 ring-1 ring-destructive/40"
                      : "border-border bg-card hover:border-destructive/40 hover:bg-card/80"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-text-dim font-medium">
                    <span>Blocked by Defects</span>
                    <BugIcon className="size-3.5 text-destructive" />
                  </div>
                  <p className="text-2xl font-bold font-mono text-destructive mt-1">
                    {tasksWithOpenBugs.length}
                  </p>
                  <span className="text-[10px] text-text-dim block mt-0.5">
                    Open bugs blocking signoff
                  </span>
                </button>
              </div>

              {/* Review Filter Pills Strip */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs text-text-dim font-medium mr-1">Filter Queue:</span>
                {[
                  { id: "ALL", label: `All In Review Queue (${testingQueue.length})` },
                  { id: "READY_FOR_TESTING", label: `Ready for Signoff (${reviewReadyTasks.length})` },
                  { id: "IN_REVIEW", label: `Active Review (${inReviewTasks.length})` },
                  { id: "CHANGES_REQUIRED", label: `Revisions Requested (${changesRequiredTasks.length})` },
                  { id: "PENDING_TIMELOGS", label: `Pending Time Logs (${tasksWithPendingTimeLogs.length})` },
                  { id: "OPEN_BUGS", label: `Blocked by Defects (${tasksWithOpenBugs.length})` },
                ].map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setReviewSubFilter(pill.id as any)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all border ${
                      reviewSubFilter === pill.id
                        ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                        : "bg-card text-text-dim border-border hover:bg-card-hover hover:text-text"
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sleek Overdue / Due Soon Alert Strip */}
          {(overdueCount > 0 || dueSoonCount > 0) && (
            <div
              className={`flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-xs border shadow-xs transition-all ${
                overdueCount > 0
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-500"
              }`}
            >
              <div className="flex items-center gap-2.5 font-medium">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      overdueCount > 0 ? "bg-destructive" : "bg-amber-500"
                    }`}
                  />
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      overdueCount > 0 ? "bg-destructive" : "bg-amber-500"
                    }`}
                  />
                </span>
                <AlertTriangle className="size-4 shrink-0" />
                <span>
                  {overdueCount > 0 ? (
                    <>
                      <strong className="font-semibold">
                        {overdueCount} task{overdueCount === 1 ? " is" : "s are"} overdue
                      </strong>{" "}
                      and require immediate completion
                      {dueSoonCount > 0 && (
                        <span className="opacity-80 hidden md:inline font-normal">
                          {" "}
                          ({dueSoonCount} more due within 1 hour)
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <strong className="font-semibold">
                        {dueSoonCount} task{dueSoonCount === 1 ? " is" : "s are"}
                      </strong>{" "}
                      due within the next hour
                    </>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant={statusFilter === "OVERDUE" ? "default" : "outline"}
                  className={`h-7 px-3 text-[11px] font-semibold cursor-pointer gap-1.5 transition-all ${
                    statusFilter === "OVERDUE"
                      ? "bg-destructive text-destructive-foreground shadow-xs"
                      : "border-destructive/30 hover:bg-destructive/15 text-destructive"
                  }`}
                  onClick={() => setStatusFilter((prev) => (prev === "OVERDUE" ? "ALL" : "OVERDUE"))}
                >
                  <AlertTriangle className="size-3" />
                  {statusFilter === "OVERDUE" ? "Showing Overdue" : `Show Overdue (${overdueCount})`}
                </Button>
              </div>
            </div>
          )}

          {/* Quick Filter Status Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("ALL");
                  setPriorityFilter("ALL");
                  setEmployeeFilter("ALL");
                }}
                className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all border ${
                  statusFilter === "ALL" && priorityFilter === "ALL" && employeeFilter === "ALL"
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-card text-text-dim border-border hover:bg-card-hover hover:text-text"
                }`}
              >
                All Tasks ({taskList.length})
              </button>

              {overdueCount > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter((prev) => (prev === "OVERDUE" ? "ALL" : "OVERDUE"))}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all border ${
                    statusFilter === "OVERDUE"
                      ? "bg-destructive text-destructive-foreground border-destructive shadow-xs"
                      : "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20"
                  }`}
                >
                  <AlertTriangle className="size-3" />
                  Overdue ({overdueCount})
                </button>
              )}

              {dueSoonCount > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter((prev) => (prev === "DUE_SOON" ? "ALL" : "DUE_SOON"))}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all border ${
                    statusFilter === "DUE_SOON"
                      ? "bg-amber-500 text-white border-amber-500 shadow-xs"
                      : "bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20"
                  }`}
                >
                  <Clock className="size-3" />
                  Due in 1h ({dueSoonCount})
                </button>
              )}

              <button
                type="button"
                onClick={() => setEmployeeFilter((prev) => (prev === "ME" ? "ALL" : "ME"))}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all border ${
                  employeeFilter === "ME"
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-card text-text-dim border-border hover:bg-card-hover hover:text-text"
                }`}
              >
                <User className="size-3" />
                My Tasks ({myTasks.length})
              </button>

              {taskList.some((t) => t.priority === "URGENT") && (
                <button
                  type="button"
                  onClick={() => setPriorityFilter((prev) => (prev === "URGENT" ? "ALL" : "URGENT"))}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all border ${
                    priorityFilter === "URGENT"
                      ? "bg-rose-500 text-white border-rose-500 shadow-xs"
                      : "bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20"
                  }`}
                >
                  <AlertCircle className="size-3" />
                  Urgent ({taskList.filter((t) => t.priority === "URGENT").length})
                </button>
              )}

              {unassignedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setEmployeeFilter((prev) => (prev === "UNASSIGNED" ? "ALL" : "UNASSIGNED"))}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all border ${
                    employeeFilter === "UNASSIGNED"
                      ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                      : "bg-card text-text-dim border-border hover:bg-card-hover hover:text-text"
                  }`}
                >
                  <Users className="size-3" />
                  Unassigned ({unassignedCount})
                </button>
              )}
            </div>

            <div className="text-xs text-text-dim font-medium hidden sm:flex items-center gap-2">
              <span>
                Total <strong className="text-text font-bold">{totalItems}</strong> matching tasks
              </span>
            </div>
          </div>

          {/* Unified Search, Filters & Sorting Toolbar Card */}
          <div className="rounded-xl border border-border/80 bg-card/75 p-2.5 shadow-xs backdrop-blur-sm space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {/* Comprehensive Search Input */}
              <div className="relative flex-1 min-w-[240px] max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-text-dim" />
                <Input
                  placeholder="Search by task #, title, project, employee, tag..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-7 text-xs h-8.5 bg-background/80 border-border hover:border-primary/50 focus:border-primary rounded-lg transition-colors shadow-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-text-dim hover:text-text rounded-full hover:bg-muted cursor-pointer transition-colors"
                    title="Clear search"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>

              {/* Filter Controls Group */}
              <div className="flex flex-wrap items-center gap-1.5 flex-1 justify-start sm:justify-end">
                {/* Project Filter */}
                <div className="flex items-center gap-1.5 bg-background/80 border border-border rounded-lg px-2.5 py-1 text-xs hover:border-primary/40 transition-colors h-8.5 shadow-none">
                  <FolderKanban className="size-3.5 text-text-dim shrink-0" />
                  <select
                    value={projectFilter}
                    onChange={(e) => setProjectFilter(e.target.value)}
                    className="bg-transparent text-xs text-text focus:outline-none cursor-pointer max-w-[130px] sm:max-w-[160px] truncate"
                    title="Filter by Project"
                  >
                    <option value="ALL">All Projects</option>
                    <option value="NO_PROJECT">Standalone Tasks</option>
                    {projectOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Employee / Assignee Filter */}
                <div className="flex items-center gap-1.5 bg-background/80 border border-border rounded-lg px-2.5 py-1 text-xs hover:border-primary/40 transition-colors h-8.5 shadow-none">
                  <Users className="size-3.5 text-text-dim shrink-0" />
                  <select
                    value={employeeFilter}
                    onChange={(e) => setEmployeeFilter(e.target.value)}
                    className="bg-transparent text-xs text-text focus:outline-none cursor-pointer max-w-[120px] sm:max-w-[150px] truncate"
                    title="Filter by Assignee"
                  >
                    <option value="ALL">All Assignees</option>
                    <option value="ME">Assigned to Me</option>
                    <option value="UNASSIGNED">Unassigned Only</option>
                    {employeeOptions.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-1.5 bg-background/80 border border-border rounded-lg px-2.5 py-1 text-xs hover:border-primary/40 transition-colors h-8.5 shadow-none">
                  <CheckCircle2 className="size-3.5 text-text-dim shrink-0" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-transparent text-xs text-text focus:outline-none cursor-pointer max-w-[110px] sm:max-w-[135px] truncate"
                    title="Filter by Status"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="OVERDUE">⚠️ Overdue ({overdueCount})</option>
                    <option value="DUE_SOON">⏰ Due in 1h ({dueSoonCount})</option>
                    {TASK_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {TASK_STATUS_LABELS[st]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority Filter */}
                <div className="flex items-center gap-1.5 bg-background/80 border border-border rounded-lg px-2.5 py-1 text-xs hover:border-primary/40 transition-colors h-8.5 shadow-none">
                  <Flag className="size-3.5 text-text-dim shrink-0" />
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="bg-transparent text-xs text-text focus:outline-none cursor-pointer max-w-[105px] sm:max-w-[125px] truncate"
                    title="Filter by Priority"
                  >
                    <option value="ALL">All Priorities</option>
                    <option value="URGENT">🔥 Urgent</option>
                    <option value="HIGH">⚡ High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>

                {/* Sort Dropdown Selector */}
                <div className="flex items-center gap-1.5 bg-background/80 border border-border rounded-lg px-2.5 py-1 text-xs hover:border-primary/40 transition-colors h-8.5 shadow-none">
                  <ArrowUpDown className="size-3.5 text-primary shrink-0" />
                  <select
                    value={`${sortBy}-${sortDirection}`}
                    onChange={(e) => {
                      const [field, dir] = e.target.value.split("-") as [SortField, SortDirection];
                      setSortBy(field);
                      setSortDirection(dir);
                    }}
                    className="bg-transparent text-xs text-text focus:outline-none cursor-pointer max-w-[135px] sm:max-w-[155px] truncate pr-1"
                    title="Sort Tasks"
                  >
                    <option value="taskNumber-desc">Task # (High → Low)</option>
                    <option value="taskNumber-asc">Task # (Low → High)</option>
                    <option value="dueDate-asc">Due Date (Earliest first)</option>
                    <option value="dueDate-desc">Due Date (Latest first)</option>
                    <option value="project-asc">Project (A → Z)</option>
                    <option value="project-desc">Project (Z → A)</option>
                    <option value="assignee-asc">Employee (A → Z)</option>
                    <option value="assignee-desc">Employee (Z → A)</option>
                    <option value="priority-desc">Priority (Highest first)</option>
                    <option value="priority-asc">Priority (Lowest first)</option>
                    <option value="createdAt-desc">Date Created (Newest first)</option>
                    <option value="title-asc">Title (A → Z)</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
                    className="p-0.5 rounded hover:bg-card-hover text-text-dim hover:text-text cursor-pointer transition-colors"
                    title={`Current: ${sortDirection === "asc" ? "Ascending" : "Descending"}. Click to reverse.`}
                  >
                    {sortDirection === "asc" ? (
                      <ArrowUp className="size-3.5 text-primary" />
                    ) : (
                      <ArrowDown className="size-3.5 text-primary" />
                    )}
                  </button>
                </div>

                {/* Reset Filters Button */}
                {hasActiveFilters && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleResetFilters}
                    className="h-8.5 px-2.5 text-xs gap-1 text-rose-500 hover:text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 cursor-pointer shadow-none rounded-lg"
                    title="Reset all search & filter settings"
                  >
                    <RotateCcw className="size-3" />
                    <span className="hidden sm:inline">Reset</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Active Filters Display Chips */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/50 text-xs text-text-dim">
                <span className="text-[11px] font-semibold text-text-dim mr-1">Active filters:</span>
                {searchQuery.trim() && (
                  <Badge
                    variant="secondary"
                    className="gap-1 text-[11px] bg-primary/10 text-primary border border-primary/20"
                  >
                    Search: "{searchQuery.trim()}"
                    <X
                      className="size-3 cursor-pointer hover:text-primary-foreground"
                      onClick={() => setSearchQuery("")}
                    />
                  </Badge>
                )}
                {projectFilter !== "ALL" && (
                  <Badge variant="secondary" className="gap-1 text-[11px] bg-card border border-border">
                    Project:{" "}
                    {projectFilter === "NO_PROJECT"
                      ? "Standalone"
                      : projectOptions.find((p) => p.id === projectFilter)?.name || projectFilter}
                    <X className="size-3 cursor-pointer hover:text-text" onClick={() => setProjectFilter("ALL")} />
                  </Badge>
                )}
                {employeeFilter !== "ALL" && (
                  <Badge variant="secondary" className="gap-1 text-[11px] bg-card border border-border">
                    Employee:{" "}
                    {employeeFilter === "ME"
                      ? "My Tasks"
                      : employeeFilter === "UNASSIGNED"
                      ? "Unassigned"
                      : employeeOptions.find((e) => e.id === employeeFilter)?.name || employeeFilter}
                    <X className="size-3 cursor-pointer hover:text-text" onClick={() => setEmployeeFilter("ALL")} />
                  </Badge>
                )}
                {statusFilter !== "ALL" && (
                  <Badge variant="secondary" className="gap-1 text-[11px] bg-card border border-border">
                    Status:{" "}
                    {statusFilter === "OVERDUE"
                      ? "Overdue"
                      : statusFilter === "DUE_SOON"
                      ? "Due in 1h"
                      : TASK_STATUS_LABELS[statusFilter as TaskStatus] || statusFilter}
                    <X className="size-3 cursor-pointer hover:text-text" onClick={() => setStatusFilter("ALL")} />
                  </Badge>
                )}
                {priorityFilter !== "ALL" && (
                  <Badge variant="secondary" className="gap-1 text-[11px] bg-card border border-border">
                    Priority: {TASK_PRIORITY_LABELS[priorityFilter as TaskPriority] || priorityFilter}
                    <X className="size-3 cursor-pointer hover:text-text" onClick={() => setPriorityFilter("ALL")} />
                  </Badge>
                )}
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-[11px] text-rose-400 hover:text-rose-300 hover:underline cursor-pointer ml-1 font-semibold"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* Tasks Master Table */}
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[1100px] border-collapse text-left text-xs">
                <thead className="bg-muted/50 border-b border-border/80 text-text-dim uppercase font-semibold text-[11px] tracking-wider">
                  <tr>
                    <SortableHeader
                      label="Task #"
                      field="taskNumber"
                      currentSort={sortBy}
                      currentDirection={sortDirection}
                      onSort={handleColumnSort}
                      className="w-[90px]"
                    />
                    <SortableHeader
                      label="Title & Project"
                      field="title"
                      currentSort={sortBy}
                      currentDirection={sortDirection}
                      onSort={handleColumnSort}
                      className="min-w-[280px]"
                    />
                    <SortableHeader
                      label="Assignees"
                      field="assignee"
                      currentSort={sortBy}
                      currentDirection={sortDirection}
                      onSort={handleColumnSort}
                      className="w-[180px]"
                    />
                    <SortableHeader
                      label="Priority"
                      field="priority"
                      currentSort={sortBy}
                      currentDirection={sortDirection}
                      onSort={handleColumnSort}
                      className="w-[115px]"
                    />
                    <SortableHeader
                      label="Status"
                      field="status"
                      currentSort={sortBy}
                      currentDirection={sortDirection}
                      onSort={handleColumnSort}
                      className="w-[140px]"
                    />
                    <SortableHeader
                      label="Due Date"
                      field="dueDate"
                      currentSort={sortBy}
                      currentDirection={sortDirection}
                      onSort={handleColumnSort}
                      className="w-[150px]"
                    />
                    <th className="px-3.5 py-3 text-text-dim uppercase font-semibold text-[11px] tracking-wider whitespace-nowrap w-[170px]">
                      Deliverables / Notes
                    </th>
                    <th className="px-4 py-3 text-right text-text-dim uppercase font-semibold text-[11px] tracking-wider whitespace-nowrap w-[170px]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {paginatedTasks.length > 0 ? (
                    paginatedTasks.map((t) => {
                      const isSelected = t.id === selectedTaskId;
                      const taskBugsCount =
                        (t.bugs?.length ?? 0) +
                        (t.subtasks ?? []).reduce((acc, st) => acc + (st.bugs?.length ?? 0), 0);
                      const openBugs =
                        (t.bugs?.filter((b) => b.status !== "CLOSED" && b.status !== "FIXED").length ?? 0) +
                        (t.subtasks ?? []).reduce(
                          (acc, st) =>
                            acc + (st.bugs?.filter((b) => b.status !== "CLOSED" && b.status !== "FIXED").length ?? 0),
                          0,
                        );

                      const deadline = getDeadlineInfo(t, now);
                      const assigneeDisplayName = t.assignee
                        ? `${t.assignee.firstName} ${t.assignee.lastName}`
                        : t.assignees?.[0]?.user
                        ? `${t.assignees[0].user.firstName} ${t.assignees[0].user.lastName}`
                        : "Assigned employee";

                      return (
                        <tr
                          key={t.id}
                          onClick={() => setSelectedTaskId(t.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-primary/15 font-medium border-l-4 border-l-primary"
                              : deadline.state === "overdue"
                              ? "bg-destructive/[0.04] border-l-4 border-l-destructive hover:bg-destructive/[0.08]"
                              : deadline.state === "due_soon"
                              ? "border-l-4 border-l-amber-500 hover:bg-card-hover/50"
                              : t.status === "DONE"
                              ? "border-l-4 border-l-emerald-500/50 hover:bg-card-hover/50 opacity-90"
                              : "border-l-4 border-l-transparent hover:bg-card-hover/50"
                          }`}
                        >
                          {/* Task Number */}
                          <td className="px-3.5 py-3 whitespace-nowrap">
                            <span className="font-mono font-bold text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-md border border-primary/20">
                              #{t.taskNumber}
                            </span>
                          </td>

                          {/* Title & Project */}
                          <td className="px-3.5 py-3">
                            <div className="space-y-0.5 max-w-md">
                              <span className="font-semibold text-text block hover:text-primary transition-colors">
                                {t.title}
                              </span>
                              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-text-dim">
                                <span className="inline-flex items-center gap-1 text-text-dim font-medium">
                                  <FolderKanban className="size-3 text-text-dim/80" />
                                  {t.project?.name ?? "General / Standalone"}
                                </span>
                                {t.subtasks && t.subtasks.length > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] px-1.5 py-0 text-purple-400 border-purple-400/30 bg-purple-500/10 font-semibold"
                                  >
                                    {t.subtasks.length} subtask{t.subtasks.length === 1 ? "" : "s"}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Assignees */}
                          <td className="px-3.5 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {t.assignees && t.assignees.length > 0 ? (
                                <div className="flex items-center -space-x-1.5 hover:space-x-1 transition-all">
                                  {t.assignees.slice(0, 3).map((a) => {
                                    const name = `${a.user?.firstName || ""} ${a.user?.lastName || ""}`.trim() || "User";
                                    const initials = (
                                      a.user?.firstName?.[0] ||
                                      a.user?.lastName?.[0] ||
                                      "?"
                                    ).toUpperCase();
                                    return (
                                      <Avatar
                                        key={a.id}
                                        className="h-6 w-6 border-2 border-card ring-1 ring-border/50 text-[10px]"
                                        title={name}
                                      >
                                        <AvatarImage src={a.user?.avatarUrl || undefined} alt={name} />
                                        <AvatarFallback className="text-[9px] bg-primary/20 text-primary font-bold">
                                          {initials}
                                        </AvatarFallback>
                                      </Avatar>
                                    );
                                  })}
                                  {t.assignees.length > 3 && (
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted border border-border text-[9px] font-bold text-text-dim">
                                      +{t.assignees.length - 3}
                                    </span>
                                  )}
                                </div>
                              ) : t.assignee ? (
                                <div className="flex items-center gap-1.5">
                                  <Avatar className="h-6 w-6 border border-border text-[10px]">
                                    <AvatarImage src={t.assignee.avatarUrl || undefined} alt={assigneeDisplayName} />
                                    <AvatarFallback className="text-[9px] bg-primary/20 text-primary font-bold">
                                      {(
                                        t.assignee?.firstName?.[0] ||
                                        t.assignee?.lastName?.[0] ||
                                        "?"
                                      ).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs text-text truncate max-w-[120px]" title={assigneeDisplayName}>
                                    {assigneeDisplayName}
                                  </span>
                                </div>
                              ) : (
                                <span className="italic text-text-dim text-[11px] bg-muted/30 px-2 py-0.5 rounded border border-border/40">
                                  Unassigned
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Priority */}
                          <td className="px-3.5 py-3 whitespace-nowrap">
                            <PriorityBadge priority={t.priority} />
                          </td>

                          {/* Status */}
                          <td className="px-3.5 py-3 whitespace-nowrap">
                            <StatusBadge status={t.status} />
                          </td>

                          {/* Due Date */}
                          <td className="px-3.5 py-3 whitespace-nowrap">
                            <TaskDeadlineBadge task={t} now={now} />
                          </td>

                          {/* Deliverables / Notes */}
                          <td className="px-3.5 py-3 whitespace-nowrap">
                            <div className="flex flex-col gap-0.5">
                              {taskBugsCount > 0 ? (
                                <span
                                  className={`font-mono font-semibold text-[11px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded border w-fit ${
                                    openBugs > 0
                                      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                  }`}
                                >
                                  <BugIcon className="size-3" />
                                  {openBugs} Open / {taskBugsCount} Items
                                </span>
                              ) : (
                                <span className="text-text-dim text-[11px]">No open issues</span>
                              )}
                              {t.subtasks && t.subtasks.length > 0 && (
                                <span className="text-[10px] text-purple-400/90 font-medium">
                                  {t.subtasks.filter((st) => st.status === "DONE").length} / {t.subtasks.length} subtasks done
                                </span>
                              )}
                              {t.timeLogs?.some((l) => l.status === "PENDING" || !l.status) && (
                                <span className="inline-flex items-center gap-1 font-semibold text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded w-fit">
                                  <Clock className="size-2.5" />
                                  Time Log Review
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {(isManagerOrAdmin ||
                                t.testerId === currentUser?.id ||
                                t.status === "READY_FOR_TESTING" ||
                                t.status === "IN_REVIEW" ||
                                t.status === "CHANGES_REQUIRED") && (
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTaskTab("review");
                                    setSelectedTaskId(t.id);
                                  }}
                                  className={`h-7 px-2.5 text-xs font-semibold gap-1.5 cursor-pointer shadow-xs transition-all ${
                                    t.status === "READY_FOR_TESTING"
                                      ? "bg-purple-600 hover:bg-purple-700 text-white animate-pulse"
                                      : t.status === "CHANGES_REQUIRED"
                                      ? "bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30"
                                      : "bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30"
                                  }`}
                                  title="Open Quality Review & Signoff Workstation"
                                >
                                  <ShieldCheck className="size-3.5" />
                                  <span>Review</span>
                                </Button>
                              )}
                              {isManagerOrAdmin && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReqUpdateTask({
                                      id: t.id,
                                      title: t.title,
                                      assigneeName: assigneeDisplayName,
                                    });
                                  }}
                                  className={`h-7 px-2 text-xs gap-1 cursor-pointer transition-colors ${
                                    deadline.state === "overdue" || deadline.state === "due_soon"
                                      ? "bg-amber-500 text-white hover:bg-amber-600 hover:text-white"
                                      : "text-amber-500 hover:bg-amber-500/10 hover:text-amber-400"
                                  }`}
                                  title="Request Progress Update from Employee"
                                >
                                  <Bell className="size-3.5" />
                                  <span className="hidden xl:inline">Update</span>
                                </Button>
                              )}

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCommTaskId(t.id);
                                  setShowCommModal(true);
                                }}
                                className="h-7 px-2 text-xs text-primary hover:bg-primary/10 gap-1 cursor-pointer"
                                title="Open Task Communication Thread"
                              >
                                <MessageSquare className="size-3.5" />
                                <span className="hidden xl:inline">Thread</span>
                                {(t.updates?.length ?? 0) > 0 && (
                                  <span className="ml-0.5 rounded-full bg-primary/20 text-primary px-1 text-[9px] font-bold">
                                    {t.updates?.length}
                                  </span>
                                )}
                              </Button>

                              {(isManagerOrAdmin || t.creatorId === currentUser?.id) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTaskToDelete(t);
                                  }}
                                  className="h-7 w-7 p-0 text-text-dim hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer transition-colors"
                                  title="Delete Task"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              )}

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedTaskId(t.id)}
                                className="h-7 w-7 p-0 text-text-dim hover:text-text hover:bg-card-hover cursor-pointer"
                                title="Open Details Panel"
                              >
                                <ChevronRight className="size-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-xs">
                        <div className="flex flex-col items-center justify-center gap-2.5 max-w-sm mx-auto">
                          <div className="p-3 rounded-full bg-muted/60 text-text-dim">
                            <ListTodo className="size-8" />
                          </div>
                          <h3 className="font-semibold text-text text-sm">No tasks found</h3>
                          <p className="text-text-dim text-xs">
                            {hasActiveFilters
                              ? "No tasks match your current search and filter criteria. Try adjusting your query or resetting filters."
                              : isManagerOrAdmin
                              ? 'No tasks created yet. Click "New Task" above to add your first task.'
                              : "No tasks assigned to you yet."}
                          </p>
                          {hasActiveFilters && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleResetFilters}
                              className="mt-2 text-xs gap-1.5 cursor-pointer"
                            >
                              <RotateCcw className="size-3.5" />
                              Reset All Filters
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer / Pagination & Count Bar */}
            <div className="border-t border-border/70 bg-card/60 px-4 py-3 flex flex-wrap items-center justify-between gap-4 text-xs text-text-dim">
              {/* Left: Summary Count & Page Size Selector */}
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  {totalItems > 0 ? (
                    <span>
                      Showing <strong className="text-text font-semibold">{startIndex + 1}–{endIndex}</strong> of{" "}
                      <strong className="text-text font-semibold">{totalItems}</strong> tasks
                      {totalItems !== taskList.length && (
                        <span className="text-[11px] text-text-dim/80 ml-1">
                          ({taskList.length - totalItems} filtered out)
                        </span>
                      )}
                    </span>
                  ) : (
                    <span>No tasks to display</span>
                  )}
                </div>

                {/* Page Size Selector */}
                <div className="flex items-center gap-1.5 pl-3 border-l border-border/60">
                  <span className="text-[11px] text-text-dim">Show:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      const val = e.target.value === "ALL" ? "ALL" : Number(e.target.value);
                      setPageSize(val);
                      setCurrentPage(1);
                    }}
                    className="bg-card border border-border rounded px-2 py-1 text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer hover:border-primary/50 transition-colors"
                  >
                    <option value={10}>10 / page</option>
                    <option value={25}>25 / page</option>
                    <option value={50}>50 / page</option>
                    <option value={100}>100 / page</option>
                    <option value="ALL">All ({totalItems})</option>
                  </select>
                </div>
              </div>

              {/* Center: Pagination Controls */}
              {pageSize !== "ALL" && totalPages > 1 && (
                <div className="flex items-center gap-1">
                  {/* First Page */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage(1)}
                    disabled={safeCurrentPage === 1}
                    className="h-7 w-7 p-0 text-text-dim hover:text-text cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    title="First Page"
                  >
                    <ChevronsLeft className="size-3.5" />
                  </Button>

                  {/* Previous Page */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safeCurrentPage === 1}
                    className="h-7 w-7 p-0 text-text-dim hover:text-text cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Previous Page"
                  >
                    <ChevronLeft className="size-3.5" />
                  </Button>

                  {/* Numbered Page Buttons */}
                  {pageNumbers.map((p, idx) =>
                    p === "..." ? (
                      <span key={`ellipsis-${idx}`} className="px-1 text-text-dim text-xs select-none">
                        ...
                      </span>
                    ) : (
                      <Button
                        key={`page-${p}`}
                        size="sm"
                        variant={safeCurrentPage === p ? "default" : "outline"}
                        onClick={() => setCurrentPage(p as number)}
                        className={`h-7 w-7 p-0 text-xs font-semibold cursor-pointer ${
                          safeCurrentPage === p
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-text-dim hover:text-text"
                        }`}
                      >
                        {p}
                      </Button>
                    ),
                  )}

                  {/* Next Page */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safeCurrentPage === totalPages}
                    className="h-7 w-7 p-0 text-text-dim hover:text-text cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Next Page"
                  >
                    <ChevronRight className="size-3.5" />
                  </Button>

                  {/* Last Page */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={safeCurrentPage === totalPages}
                    className="h-7 w-7 p-0 text-text-dim hover:text-text cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Last Page"
                  >
                    <ChevronsRight className="size-3.5" />
                  </Button>
                </div>
              )}

              {/* Right: Active Sort & Reset Filters */}
              <div className="flex items-center gap-3">
                <span className="text-[11px] hidden xl:inline">
                  Sorted by:{" "}
                  <strong className="text-text font-semibold">
                    {sortBy === "taskNumber"
                      ? `Task # (${sortDirection === "asc" ? "Low → High" : "High → Low"})`
                      : sortBy === "dueDate"
                      ? `Due Date (${sortDirection === "asc" ? "Earliest first" : "Latest first"})`
                      : sortBy === "project"
                      ? `Project (${sortDirection === "asc" ? "A → Z" : "Z → A"})`
                      : sortBy === "assignee"
                      ? `Employee (${sortDirection === "asc" ? "A → Z" : "Z → A"})`
                      : sortBy === "priority"
                      ? `Priority (${sortDirection === "asc" ? "Lowest first" : "Highest first"})`
                      : sortBy === "createdAt"
                      ? `Date Created (${sortDirection === "asc" ? "Oldest first" : "Newest first"})`
                      : sortBy === "status"
                      ? `Status (${sortDirection === "asc" ? "Workflow order" : "Reverse order"})`
                      : `Title (${sortDirection === "asc" ? "A → Z" : "Z → A"})`}
                  </strong>
                </span>

                {hasActiveFilters && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleResetFilters}
                    className="h-6 px-2 text-[11px] text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 cursor-pointer"
                  >
                    Reset filters
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Task Communication Modal */}
      {showCommModal && commTaskId && (
        <TaskCommunicationModal
          taskId={commTaskId}
          open={showCommModal}
          onOpenChange={(isOpen) => {
            setShowCommModal(isOpen);
            if (!isOpen) {
              setCommTaskId(null);
              if (search?.modal === "communication") {
                navigate({ to: "/tasks", search: { taskId: undefined, modal: undefined }, replace: true });
              }
            }
          }}
        />
      )}

      {/* Manager Update Request Dialog */}
      {reqUpdateTask && (
        <TaskRequestUpdateDialog
          taskId={reqUpdateTask.id}
          taskTitle={reqUpdateTask.title}
          employeeName={reqUpdateTask.assigneeName}
          open={!!reqUpdateTask}
          onOpenChange={(isOpen) => {
            if (!isOpen) setReqUpdateTask(null);
          }}
        />
      )}

      {/* Task Delete Confirmation Dialog */}
      {taskToDelete && (
        <AlertDialog open={!!taskToDelete} onOpenChange={(open) => !open && setTaskToDelete(null)}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-rose-500">
                <Trash2 className="size-5" />
                Delete Task #{taskToDelete.taskNumber}?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-text-dim space-y-2">
                <span>Are you sure you want to permanently delete:</span>
                <span className="block font-semibold text-text text-sm p-2.5 bg-muted/40 rounded-lg border border-border">
                  {taskToDelete.title}
                </span>
                <span className="block text-rose-400 font-medium text-[11px]">
                  This action cannot be undone. All checklists, subtasks, time logs, and history for this task will be permanently removed.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingTask} className="cursor-pointer text-xs">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={isDeletingTask}
                onClick={async (e) => {
                  e.preventDefault();
                  setIsDeletingTask(true);
                  try {
                    await deleteTaskMutation.mutateAsync({
                      id: taskToDelete.id,
                      projectId: taskToDelete.projectId,
                    });
                    toast.success(`Task #${taskToDelete.taskNumber} deleted successfully`);
                    if (selectedTaskId === taskToDelete.id) {
                      setSelectedTaskId(null);
                    }
                    setTaskToDelete(null);
                  } catch (err: unknown) {
                    toast.error(
                      (err as { message?: string })?.message || "Failed to delete task",
                    );
                  } finally {
                    setIsDeletingTask(false);
                  }
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white cursor-pointer text-xs font-semibold gap-1.5"
              >
                {isDeletingTask ? "Deleting..." : "Delete Task"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
