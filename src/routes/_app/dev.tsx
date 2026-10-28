import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Code2,
  GitPullRequest,
  Plus,
  Loader2,
  CheckCircle2,
  Bug,
  Settings,
  AlertCircle,
  Calendar,
  TrendingUp,
  GitFork,
  ChevronLeft,
  ChevronRight,
  Play,
  Check,
  CheckSquare,
  Wrench,
  RefreshCw,
  GitCommit as GitCommitIcon,
  MessageSquare,
  Folder,
  Sparkles,
  Zap,
  Layers,
  Maximize2,
  Search,
  Rocket,
  Clock,
  Flame,
  Target,
  Activity,
  ArrowRight,
  Filter,
  Bot,
  Cpu,
} from "lucide-react";

import { useAuthStore } from "@/stores/auth-store";
import { useUsers, useUpdateGithubUsername } from "@/hooks/use-users";
import { useAnalyticsSummary } from "@/hooks/use-analytics";
import { useEpics, useCreateEpic } from "@/hooks/use-epics";
import { useReleases, useCreateRelease } from "@/hooks/use-releases";
import { useProjects, useCreateProject } from "@/hooks/use-projects";
import { useTasks, useUpdateTask, useCreateTask } from "@/hooks/use-tasks";
import { useBugs } from "@/hooks/use-bugs";
import {
  useSprints,
  useCreateSprint,
  useUpdateSprint,
  useAssignTasksToSprint,
} from "@/hooks/use-sprints";
import { useCommits, useCreateCommit, useMergePR, useDeclinePR } from "@/hooks/use-commits";
import { useSprintTaskUpdates } from "@/hooks/use-task-updates";
import { toast } from "sonner";
import { TaskFormDialog } from "@/components/task-form-dialog";
import { ZohoTaskPagePanel } from "@/components/zoho-task-page-panel";
import { DevBugsPanel } from "@/components/dev-bugs-panel";
import { AiTokenMonitorWidget } from "@/components/ai-token-monitor-widget";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getInitials } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDepartmentGuard } from "@/hooks/use-department-guard";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_TYPES,
  TASK_TYPE_LABELS,
  type GitCommit,
  type SprintTaskUpdate,
  type Task,
  type TaskStatus,
  type TaskType,
} from "@/lib/api/types";
import { formatRelativeDay } from "@/lib/format-relative-day";

export const Route = createFileRoute("/_app/dev")({
  component: DevPage,
});

function DevPage() {
  useDepartmentGuard("Dev");
  const navigate = useNavigate();

  const currentUser = useAuthStore((s) => s.user);
  const { data: users } = useUsers();
  const updateGithubUsername = useUpdateGithubUsername();

  // CurrentUser (the auth session) deliberately doesn't carry githubUsername --
  // look it up from the full user record instead.
  const currentUserFull = useMemo(
    () => users?.find((u) => u.id === currentUser?.id),
    [users, currentUser],
  );

  const [githubDialogOpen, setGithubDialogOpen] = useState(false);
  const [githubUsernameInput, setGithubUsernameInput] = useState(
    currentUserFull?.githubUsername || "",
  );

  // Project Scope Filter
  const [selectedProjectId, setSelectedProjectId] = useState<string>("ALL_PROJECTS");

  // Scoped tasks for Dev department (Admins monitor all tasks)
  const isAdmin = currentUser?.role.name === "ADMIN";
  const { data: tasks, isLoading: tasksLoading } = useTasks({
    departmentId: isAdmin ? undefined : currentUser?.department?.id,
  });

  const { data: sprints, isLoading: sprintsLoading } = useSprints(
    selectedProjectId === "ALL_PROJECTS" ? undefined : selectedProjectId,
  );
  const { data: commits, isLoading: commitsLoading } = useCommits();
  const { data: analytics } = useAnalyticsSummary();
  const devMetrics = analytics?.dev;
  const { data: epics } = useEpics(isAdmin ? undefined : currentUser?.department?.id);
  const { data: releases } = useReleases(isAdmin ? undefined : currentUser?.department?.id);
  const { data: projects } = useProjects(
    isAdmin ? {} : { departmentId: currentUser?.department?.id },
  );

  // Filter tasks dynamically by selected project
  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    if (selectedProjectId === "ALL_PROJECTS") return tasks;
    return tasks.filter(
      (t) => t.projectId === selectedProjectId || t.project?.id === selectedProjectId,
    );
  }, [tasks, selectedProjectId]);

  // Mutations
  const createProject = useCreateProject();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const createSprint = useCreateSprint();
  const updateSprint = useUpdateSprint();
  const assignTasksToSprint = useAssignTasksToSprint();
  const createCommit = useCreateCommit();
  const mergePR = useMergePR();
  const declinePR = useDeclinePR();

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    "board" | "backlog" | "bugs" | "projects" | "calendar" | "ai-tokens"
  >("board");

  const [reportBugTaskId, setReportBugTaskId] = useState<string | null>(null);

  // Bugs query for dev sprint tab badge & scoping
  const isEmployeeRole = currentUser?.role?.name === "EMPLOYEE";
  const { data: devBugs = [] } = useBugs({
    projectId: selectedProjectId !== "ALL_PROJECTS" ? selectedProjectId : undefined,
    assigneeId: isEmployeeRole && currentUser ? currentUser.id : undefined,
  });
  const activeBugsCount = devBugs.filter(
    (b) => b.status !== "CLOSED" && b.status !== "FIXED",
  ).length;

  // Create Sprint Dialog State
  const [createSprintOpen, setCreateSprintOpen] = useState(false);
  const [sprintName, setSprintName] = useState("");
  const [sprintStart, setSprintStart] = useState("");
  const [sprintEnd, setSprintEnd] = useState("");
  const [sprintProjectId, setSprintProjectId] = useState("none");

  // Create Task Dialog State
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskType, setTaskTypeState] = useState<TaskType>("FEATURE");
  const [taskSP, setTaskSP] = useState("1");
  const [taskAssigneeId, setTaskAssigneeId] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskProjectId, setTaskProjectId] = useState("none");
  const [taskParentId, setTaskParentId] = useState("none");

  // Create Project Dialog State
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [projectDue, setProjectDue] = useState("");

  // Filter open Pull Requests
  const openPRs = useMemo(() => {
    return commits?.filter((c) => c.isPR && c.prStatus === "OPEN") || [];
  }, [commits]);

  // Get active sprint
  const activeSprint = useMemo(() => {
    return sprints?.find((s) => s.status === "ACTIVE") || null;
  }, [sprints]);

  // Real per-task progress updates across the active sprint
  const { data: sprintTaskUpdates, isLoading: sprintUpdatesLoading } = useSprintTaskUpdates(
    activeSprint?.id,
  );

  // Task detail dialog (opened from a sprint board card)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);

  // Sprint stats
  const sprintStats = useMemo(() => {
    if (!activeSprint) return { totalTasks: 0, completedTasks: 0, totalSP: 0, completedSP: 0 };
    const sprintTasks = filteredTasks.filter((t) => t.sprintId === activeSprint.id);
    const completed = sprintTasks.filter((t) => t.status === "DONE");

    const totalSP = sprintTasks.reduce((acc, t) => acc + (t.storyPoints ?? 0), 0);
    const completedSP = completed.reduce((acc, t) => acc + (t.storyPoints ?? 0), 0);

    return {
      totalTasks: sprintTasks.length,
      completedTasks: completed.length,
      totalSP,
      completedSP,
    };
  }, [activeSprint, filteredTasks]);

  // Dev teammates (for assignee lists)
  const devTeammates = useMemo(() => {
    if (!users || !currentUser) return [];
    return users.filter((u) => u.department?.id === currentUser.department?.id);
  }, [users, currentUser]);

  // Filter tasks in active sprint vs backlog
  const sprintTasks = useMemo(() => {
    if (!activeSprint) return [];
    return filteredTasks.filter((t) => t.sprintId === activeSprint.id);
  }, [activeSprint, filteredTasks]);

  const backlogTasks = useMemo(() => {
    return filteredTasks.filter((t) => t.sprintId === null);
  }, [filteredTasks]);

  // All Activity Modal State
  const [allActivityModalOpen, setAllActivityModalOpen] = useState(false);
  const [activityFilter, setActivityFilter] = useState<"ALL" | "TASKS" | "COMMITS" | "BUGS" | "UPDATES">("ALL");
  const [activitySearch, setActivitySearch] = useState("");

  // Group activities by date for Daily Updates
  const dailyUpdates = useMemo(() => {
    const items: Array<{
      id: string;
      type: "commit" | "task" | "update" | "bug";
      date: string;
      title: string;
      actionLabel: string;
      actionTone: string;
      user: { firstName?: string; lastName?: string; avatarUrl?: string | null };
      task?: Task;
      bug?: any;
      commit?: any;
    }> = [];

    // 1. Commits & Pull Requests
    commits?.forEach((c) => {
      items.push({
        id: `commit-${c.id}`,
        type: "commit",
        date: c.createdAt,
        title: c.isPR ? `PR #${c.prNumber || ''}: ${c.message}` : c.message,
        actionLabel: c.isPR ? "pull request" : "committed code",
        actionTone: "bg-slate-100 text-slate-700 border-slate-200",
        user: c.author || { firstName: "Git", lastName: "Author" },
        commit: c,
      });
    });

    // 2. Tasks & Status changes
    tasks?.forEach((t) => {
      let actionLabel = "created task";
      let actionTone = "bg-blue-50 text-blue-700 border-blue-200";
      if (t.status === "DONE") {
        actionLabel = "completed task";
        actionTone = "bg-emerald-50 text-emerald-700 border-emerald-200";
      } else if (t.status === "READY_FOR_TESTING") {
        actionLabel = "ready for QA";
        actionTone = "bg-purple-50 text-purple-700 border-purple-200";
      } else if (t.status === "IN_REVIEW") {
        actionLabel = "in review";
        actionTone = "bg-indigo-50 text-indigo-700 border-indigo-200";
      } else if (t.status === "IN_PROGRESS") {
        actionLabel = "started working";
        actionTone = "bg-amber-50 text-amber-700 border-amber-200";
      }

      const taskUser = t.assignee || t.creator || { firstName: "Dev", lastName: "Member" };
      items.push({
        id: `task-${t.id}`,
        type: "task",
        date: t.updatedAt || t.createdAt,
        title: `DEV-${t.taskNumber}: ${t.title}`,
        actionLabel,
        actionTone,
        user: taskUser,
        task: t,
      });

      t.updates?.forEach((u) => {
        items.push({
          id: `update-${u.id}`,
          type: "update",
          date: u.createdAt,
          title: `DEV-${t.taskNumber}: ${t.title}`,
          actionLabel: "posted update",
          actionTone: "bg-sky-50 text-sky-700 border-sky-200",
          user: u.user || taskUser,
          task: t,
        });
      });
    });

    // 3. Dev Bugs
    devBugs?.forEach((b) => {
      const isFixed = b.status === "FIXED" || b.status === "CLOSED";
      items.push({
        id: `bug-${b.id}`,
        type: "bug",
        date: b.updatedAt || b.createdAt,
        title: b.title,
        actionLabel: isFixed ? "resolved bug" : "reported bug",
        actionTone: isFixed ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200",
        user: b.reporter || b.assignee || { firstName: "QA", lastName: "Tester" },
        bug: b,
      });
    });

    // 4. Sprint Task Updates
    sprintTaskUpdates?.forEach((u) => {
      const matchingTask = tasks?.find((t) => t.id === u.taskId);
      items.push({
        id: `sprint-update-${u.id}`,
        type: "update",
        date: u.createdAt,
        title: matchingTask ? `DEV-${matchingTask.taskNumber}: ${matchingTask.title}` : (u.content || "Sprint update"),
        actionLabel: "sprint update",
        actionTone: "bg-blue-50 text-blue-700 border-blue-200",
        user: u.user || { firstName: "Sprint", lastName: "Member" },
        task: matchingTask,
      });
    });

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const groups: Array<{ date: string; items: typeof items }> = [];
    items.forEach((item) => {
      const dateKey = formatRelativeDay(item.date);
      let group = groups.find((g) => g.date === dateKey);
      if (!group) {
        group = { date: dateKey, items: [] };
        groups.push(group);
      }
      group.items.push(item);
    });

    return groups;
  }, [commits, tasks, devBugs, sprintTaskUpdates]);

  // Interactive Calendar State & Calculations
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [calendarViewMode, setCalendarViewMode] = useState<"month" | "agenda">("month");

  // Large-scale expanded column modal state
  const [expandedStatusColumn, setExpandedStatusColumn] = useState<TaskStatus | null>(null);
  const [expandedColumnSearch, setExpandedColumnSearch] = useState("");

  const calendarNav = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const cells: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    const todayStr = new Date().toDateString();

    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const date = new Date(year, month - 1, d);
      cells.push({
        dateStr: date.toDateString(),
        dayNum: d,
        isCurrentMonth: false,
        isToday: date.toDateString() === todayStr,
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      cells.push({
        dateStr: date.toDateString(),
        dayNum: d,
        isCurrentMonth: true,
        isToday: date.toDateString() === todayStr,
      });
    }

    const targetLength = cells.length > 35 ? 42 : 35;
    const remaining = targetLength - cells.length;
    for (let n = 1; n <= remaining; n++) {
      const date = new Date(year, month + 1, n);
      cells.push({
        dateStr: date.toDateString(),
        dayNum: n,
        isCurrentMonth: false,
        isToday: date.toDateString() === todayStr,
      });
    }

    return {
      year,
      monthName: monthNames[month],
      cells,
    };
  }, [calendarDate]);

  // Due dates are stored as UTC midnight for a calendar day (e.g.
  // "2026-08-25T00:00:00.000Z" means "due Aug 25", not a specific moment).
  // Grid cells are keyed by toDateString() on a LOCAL Date, so keying an
  // event via `new Date(iso).toDateString()` would first convert that UTC
  // instant to the viewer's local time -- for anyone west of UTC that lands
  // on the previous local day, one cell off from the actual due date. Read
  // the UTC calendar-day components directly instead, so the key matches
  // regardless of the viewer's timezone.
  const dateKeyFromISO = (iso: string) => {
    const d = new Date(iso);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()).toDateString();
  };

  const calendarEventsByDate = useMemo(() => {
    type CalendarEvent = {
      id: string;
      title: string;
      type: "TASK_BUG" | "TASK_REFACTOR" | "TASK_FEATURE" | "TASK_CHORE" | "SPRINT_START" | "SPRINT_END" | "PROJECT_RELEASE";
      taskKey?: string;
      taskId?: string;
    };
    const map = new Map<string, CalendarEvent[]>();

    const addEvent = (dateStr: string, evt: CalendarEvent) => {
      if (!map.has(dateStr)) map.set(dateStr, []);
      map.get(dateStr)!.push(evt);
    };

    filteredTasks.forEach((t) => {
      if (t.dueDate) {
        const dStr = dateKeyFromISO(t.dueDate);
        let evtType: "TASK_BUG" | "TASK_REFACTOR" | "TASK_FEATURE" | "TASK_CHORE" = "TASK_FEATURE";
        if (t.type === "BUG") evtType = "TASK_BUG";
        else if (t.type === "REFACTOR") evtType = "TASK_REFACTOR";
        else if (t.type === "CHORE") evtType = "TASK_CHORE";

        addEvent(dStr, {
          id: `task-${t.id}`,
          title: t.title,
          type: evtType,
          taskKey: `DEV-${t.taskNumber}`,
          taskId: t.id,
        });
      }
    });

    if (activeSprint) {
      if (activeSprint.startDate) {
        addEvent(dateKeyFromISO(activeSprint.startDate), {
          id: `sprint-start-${activeSprint.id}`,
          title: `Start ${activeSprint.name}`,
          type: "SPRINT_START",
        });
      }
      if (activeSprint.endDate) {
        addEvent(dateKeyFromISO(activeSprint.endDate), {
          id: `sprint-end-${activeSprint.id}`,
          title: `End ${activeSprint.name}`,
          type: "SPRINT_END",
        });
      }
    }

    projects?.forEach((p) => {
      if (p.dueDate) {
        addEvent(dateKeyFromISO(p.dueDate), {
          id: `project-${p.id}`,
          title: `Release: ${p.name}`,
          type: "PROJECT_RELEASE",
        });
      }
    });

    return map;
  }, [filteredTasks, activeSprint, projects]);

  // Backlog selections for sprint planning
  const [selectedBacklogTaskIds, setSelectedBacklogTaskIds] = useState<Record<string, boolean>>({});

  const handleCreateSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sprintName.trim() || !sprintStart || !sprintEnd) {
      toast.error("Please provide a name, start date, and end date for the sprint.");
      return;
    }
    try {
      await createSprint.mutateAsync({
        name: sprintName.trim(),
        startDate: new Date(sprintStart).toISOString(),
        endDate: new Date(sprintEnd).toISOString(),
        status: "ACTIVE", // Automatically start the created sprint
        projectId: sprintProjectId !== "none" ? sprintProjectId : undefined,
        departmentId: currentUser?.department?.id ?? undefined,
      });
      toast.success(`Sprint "${sprintName}" launched successfully!`);
      setCreateSprintOpen(false);
      setSprintName("");
      setSprintStart("");
      setSprintEnd("");
      setSprintProjectId("none");
    } catch (err: unknown) {
      console.error(err);
      toast.error((err as { message?: string })?.message || "Failed to create sprint.");
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) {
      toast.error("Task title is required.");
      return;
    }
    try {
      await createTask.mutateAsync({
        title: taskTitle.trim(),
        description: taskDesc.trim() || undefined,
        type: taskType,
        storyPoints: parseInt(taskSP, 10) || 1,
        assigneeId: taskAssigneeId || undefined,
        departmentId: currentUser?.department?.id ?? undefined,
        sprintId: activeSprint?.id || undefined,
        dueDate: taskDueDate ? new Date(taskDueDate).toISOString() : undefined,
        projectId: taskProjectId !== "none" ? taskProjectId : undefined,
        parentId: taskParentId !== "none" ? taskParentId : undefined,
      });
      toast.success(`Task "${taskTitle}" created!`);
      setCreateTaskOpen(false);
      setTaskTitle("");
      setTaskDesc("");
      setTaskTypeState("FEATURE");
      setTaskSP("1");
      setTaskAssigneeId("");
      setTaskDueDate("");
      setTaskProjectId("none");
      setTaskParentId("none");
    } catch (err: unknown) {
      console.error(err);
      toast.error((err as { message?: string })?.message || "Failed to create task.");
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) {
      toast.error("Project name is required.");
      return;
    }
    try {
      await createProject.mutateAsync({
        name: projectName.trim(),
        description: projectDesc || undefined,
        dueDate: projectDue ? new Date(projectDue).toISOString() : undefined,
        departmentId: currentUser?.department?.id ?? undefined,
        status: "ACTIVE",
      });
      toast.success(`Project "${projectName}" created!`);
      setCreateProjectOpen(false);
      setProjectName("");
      setProjectDesc("");
      setProjectDue("");
    } catch (err: unknown) {
      console.error(err);
      toast.error((err as { message?: string })?.message || "Failed to create project.");
    }
  };

  const handleMoveTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await updateTask.mutateAsync({
        id: taskId,
        input: { status: newStatus },
      });
      toast.success(`Task updated to ${TASK_STATUS_LABELS[newStatus]}`);
    } catch (err: unknown) {
      console.error(err);
      toast.error((err as { message?: string })?.message || "Failed to update task status.");
    }
  };

  const handleCompleteSprint = async () => {
    if (!activeSprint) return;
    try {
      await updateSprint.mutateAsync({
        id: activeSprint.id,
        input: { status: "COMPLETED" },
      });
      toast.success(`Sprint "${activeSprint.name}" marked as completed!`);
    } catch (err: unknown) {
      console.error(err);
      toast.error((err as { message?: string })?.message || "Failed to complete sprint.");
    }
  };

  const handleAddToSprint = async () => {
    if (!activeSprint) {
      toast.error("No active sprint found. Please start a sprint first.");
      return;
    }
    const taskIds = Object.keys(selectedBacklogTaskIds).filter((id) => selectedBacklogTaskIds[id]);
    if (taskIds.length === 0) {
      toast.info("Please select at least one task to add to the sprint.");
      return;
    }
    try {
      await assignTasksToSprint.mutateAsync({
        sprintId: activeSprint.id,
        taskIds,
      });
      toast.success(`Added ${taskIds.length} task(s) to ${activeSprint.name}!`);
      setSelectedBacklogTaskIds({});
    } catch (err: unknown) {
      console.error(err);
      toast.error((err as { message?: string })?.message || "Failed to assign tasks to sprint.");
    }
  };

  // Burndown chart calculation
  const burndownData = useMemo(() => {
    if (!activeSprint) return null;
    const start = new Date(activeSprint.startDate).getTime();
    const end = new Date(activeSprint.endDate).getTime();
    const totalDays = Math.max(1, Math.round((end - start) / (24 * 3600 * 1000)));

    // Total story points assigned in sprint
    const totalSP = sprintTasks.reduce((acc, t) => acc + (t.storyPoints ?? 0), 0);

    // Compute ideal burndown points
    const idealPoints = Array.from({ length: totalDays + 1 }, (_, i) => {
      const val = Math.max(0, totalSP - (i * totalSP) / totalDays);
      return { day: i, val };
    });

    // Compute actual burndown points
    const completedTasks = sprintTasks.filter((t) => t.status === "DONE");
    const completedSPPerDay = new Array(totalDays + 1).fill(0);
    completedTasks.forEach((t) => {
      const closedTime = t.updatedAt ? new Date(t.updatedAt).getTime() : Date.now();
      const dayIndex = Math.min(
        totalDays,
        Math.max(0, Math.floor((closedTime - start) / (24 * 3600 * 1000))),
      );
      completedSPPerDay[dayIndex] += t.storyPoints ?? 0;
    });

    const actualPoints: { day: number; val: number }[] = [];
    let remainingSP = totalSP;
    const todayIndex = Math.min(
      totalDays,
      Math.max(0, Math.floor((Date.now() - start) / (24 * 3600 * 1000))),
    );

    for (let i = 0; i <= totalDays; i++) {
      if (i <= todayIndex) {
        remainingSP = Math.max(0, remainingSP - completedSPPerDay[i]);
        actualPoints.push({ day: i, val: remainingSP });
      }
    }

    return {
      totalDays,
      totalSP,
      ideal: idealPoints,
      actual: actualPoints,
    };
  }, [activeSprint, sprintTasks]);

  const getTaskTypeIcon = (type: TaskType) => {
    switch (type) {
      case "BUG":
        return <Bug className="size-3.5 text-red-600" />;
      case "REFACTOR":
        return <TrendingUp className="size-3.5 text-orange-600" />;
      case "CHORE":
        return <Wrench className="size-3.5 text-slate-500" />;
      default:
        return <Code2 className="size-3.5 text-blue-600" />;
    }
  };

  const getTaskTypeBadge = (type: TaskType) => {
    switch (type) {
      case "BUG":
        return "bg-red-50 text-red-600 border-red-200 font-bold";
      case "REFACTOR":
        return "bg-orange-50 text-orange-600 border-orange-200 font-bold";
      case "CHORE":
        return "bg-slate-100 text-slate-600 border-slate-200 font-medium";
      default:
        return "bg-blue-50 text-blue-700 border-blue-200 font-bold";
    }
  };

  // Dedicated Full-Page Status Column Panel View
  if (expandedStatusColumn) {
    const columnTasks = sprintTasks.filter((t) => t.status === expandedStatusColumn && !t.parentId);
    const filteredExpandedTasks = columnTasks.filter((t) =>
      t.title.toLowerCase().includes(expandedColumnSearch.toLowerCase()) ||
      `DEV-${t.taskNumber}`.toLowerCase().includes(expandedColumnSearch.toLowerCase())
    );
    const totalSP = columnTasks.reduce((acc, t) => acc + (t.storyPoints ?? 0), 0);

    const getStatusStyles = (st: TaskStatus) => {
      switch (st) {
        case "TODO":
          return { dot: "bg-blue-600", badge: "bg-blue-50 text-blue-700 border-blue-200" };
        case "IN_PROGRESS":
          return { dot: "bg-orange-500", badge: "bg-orange-50 text-orange-700 border-orange-200" };
        case "IN_REVIEW":
          return { dot: "bg-indigo-600", badge: "bg-indigo-50 text-indigo-700 border-indigo-200" };
        case "READY_FOR_TESTING":
          return { dot: "bg-sky-600", badge: "bg-sky-50 text-sky-700 border-sky-200" };
        case "CHANGES_REQUIRED":
          return { dot: "bg-red-600", badge: "bg-red-50 text-red-700 border-red-200" };
        case "DONE":
        default:
          return { dot: "bg-blue-700", badge: "bg-blue-50 text-blue-800 border-blue-200" };
      }
    };

    const style = getStatusStyles(expandedStatusColumn);

    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200 select-none">
        {/* Full-Page Header */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpandedStatusColumn(null)}
                className="gap-2 text-xs font-bold rounded-xl border-slate-200 hover:bg-slate-50 hover:text-blue-600 text-slate-700 shadow-2xs"
              >
                <ChevronLeft className="size-4" />
                Back to Development Workspace
              </Button>
              <span className="text-slate-300 hidden sm:inline">|</span>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`size-3.5 rounded-full shrink-0 ${style.dot}`} />
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight uppercase">
                  {TASK_STATUS_LABELS[expandedStatusColumn]}
                </h1>
                <span className="text-xs bg-slate-100 border border-slate-200 px-3 py-1 rounded-full font-bold text-slate-700">
                  {columnTasks.length} {columnTasks.length === 1 ? "Task" : "Tasks"}
                </span>
                <span className={`text-xs border px-3 py-1 rounded-full font-bold font-mono ${style.badge}`}>
                  {totalSP} SP Total
                </span>
              </div>
            </div>

            {/* Filter Search Input */}
            <div className="relative w-full sm:w-80">
              <Search className="size-4 text-slate-400 absolute left-3.5 top-2.5" />
              <Input
                placeholder={`Search tasks in ${TASK_STATUS_LABELS[expandedStatusColumn]}...`}
                value={expandedColumnSearch}
                onChange={(e) => setExpandedColumnSearch(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl border-slate-200 focus:border-blue-500 shadow-2xs"
              />
            </div>
          </div>

          <p className="text-xs text-slate-500 font-medium">
            Dedicated full-page workspace for <span className="font-bold text-slate-900">{TASK_STATUS_LABELS[expandedStatusColumn]}</span> tasks in active sprint <span className="font-bold text-blue-700 font-mono">{activeSprint?.name || "Global Scope"}</span>.
          </p>
        </div>

        {/* Task Grid in Full-Page Panel */}
        {filteredExpandedTasks.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 rounded-2xl p-16 text-center flex flex-col items-center justify-center gap-3 bg-white shadow-xs">
            <div className="size-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center shadow-2xs">
              <CheckCircle2 className="size-7 text-blue-600" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No tasks found in {TASK_STATUS_LABELS[expandedStatusColumn]}</h3>
            <p className="text-xs text-slate-500 max-w-md">
              {columnTasks.length === 0
                ? `There are currently no tasks allocated to ${TASK_STATUS_LABELS[expandedStatusColumn]} for this active sprint.`
                : "No tasks match your search query."}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpandedStatusColumn(null)}
              className="mt-2 text-xs font-bold rounded-xl border-slate-200 text-slate-700 hover:text-blue-600 shadow-2xs"
            >
              Back to Development Workspace
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredExpandedTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => {
                  setSelectedTask(task);
                  setTaskDialogOpen(true);
                }}
                className="bg-white border border-slate-200/90 hover:border-blue-500/50 rounded-2xl p-5 shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer group space-y-4"
              >
                {/* Meta Header */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {getTaskTypeIcon(task.type)}
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                      DEV-{task.taskNumber}
                    </span>
                    <span className={`px-2 py-0.5 border rounded-md text-[9px] font-bold font-mono uppercase ${getTaskTypeBadge(task.type)}`}>
                      {TASK_TYPE_LABELS[task.type]}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-mono">
                      {task.storyPoints ?? 0} SP
                    </span>
                  </div>

                  {task.dueDate && (
                    <span className={`text-xs font-semibold flex items-center gap-1.5 ${new Date(task.dueDate) < new Date() ? "text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg font-bold" : "text-slate-500"}`}>
                      <Calendar className="size-3" />
                      Due {new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  )}
                </div>

                {/* Title & Description */}
                <div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {task.title}
                  </h3>
                  {task.description && (
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                      {task.description}
                    </p>
                  )}
                </div>

                {/* Bottom Info & Status Move Controls */}
                <div className="flex flex-wrap items-center justify-between pt-3 border-t border-slate-100 gap-3">
                  <div className="flex items-center gap-3">
                    {task.assignee && (
                      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl">
                        <Avatar className="size-5 shrink-0 bg-blue-50 border border-blue-200">
                          <AvatarFallback className="text-[8px] font-bold text-blue-700">
                            {getInitials(task.assignee)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-semibold text-slate-800">
                          {task.assignee.firstName} {task.assignee.lastName}
                        </span>
                      </div>
                    )}
                    {task.subtasks && task.subtasks.length > 0 && (
                      <span className="text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-xl">
                        Subtasks: {task.subtasks.filter((s) => s.status === "DONE").length} / {task.subtasks.length}
                      </span>
                    )}
                    {task._count.updates > 0 && (
                      <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-xl flex items-center gap-1">
                        <MessageSquare className="size-3" /> {task._count.updates} Update{task._count.updates !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {/* Move Status Buttons */}
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Move:</span>
                    <div className="flex flex-wrap items-center gap-1">
                      {TASK_STATUSES.filter((s) => s !== expandedStatusColumn).map((st) => (
                        <Button
                          key={st}
                          size="sm"
                          variant="outline"
                          className="h-6 text-[9px] font-bold px-2 rounded-lg border-slate-200 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 whitespace-nowrap shadow-2xs"
                          onClick={async () => {
                            await handleMoveTaskStatus(task.id, st);
                          }}
                        >
                          → {TASK_STATUS_LABELS[st]}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 select-none font-sans">
      {/* Top Header & 4 KPI Cards */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0 shadow-2xs">
              <Rocket className="size-5" />
            </div>
            <h1 className="text-2.5xl font-extrabold text-slate-900 tracking-tight">
              Dev Sprints
            </h1>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Agile sprints, backlog planning, and developer productivity — all in one place.
          </p>
        </div>

        {/* 4 KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {/* Card 1: Total Tasks */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 flex items-center gap-3.5 shadow-2xs hover:shadow-sm transition-all min-w-[130px]">
            <div className="size-10 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 shrink-0">
              <Target className="size-5" />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                Total Tasks
              </span>
              <span className="text-lg font-extrabold text-slate-900">
                {filteredTasks.length}
              </span>
            </div>
          </div>

          {/* Card 2: In Progress */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 flex items-center gap-3.5 shadow-2xs hover:shadow-sm transition-all min-w-[130px]">
            <div className="size-10 rounded-xl bg-orange-50 border border-orange-200/80 flex items-center justify-center text-orange-600 shrink-0">
              <Flame className="size-5" />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                In Progress
              </span>
              <span className="text-lg font-extrabold text-slate-900">
                {filteredTasks.filter((t) => t.status === "IN_PROGRESS").length}
              </span>
            </div>
          </div>

          {/* Card 3: Pending PRs */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 flex items-center gap-3.5 shadow-2xs hover:shadow-sm transition-all min-w-[130px]">
            <div className="size-10 rounded-xl bg-purple-50 border border-purple-200/80 flex items-center justify-center text-purple-600 shrink-0">
              <GitPullRequest className="size-5" />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                Pending PRs
              </span>
              <span className="text-lg font-extrabold text-slate-900">
                {openPRs.length}
              </span>
            </div>
          </div>

          {/* Card 4: Projects */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 flex items-center gap-3.5 shadow-2xs hover:shadow-sm transition-all min-w-[130px]">
            <div className="size-10 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shrink-0">
              <Folder className="size-5" />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                Projects
              </span>
              <span className="text-lg font-extrabold text-slate-900">
                {projects?.length ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Section */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Sprints Board, Backlog & AI Tokens */}
        <div className={activeTab === "ai-tokens" ? "lg:col-span-4 space-y-6" : "lg:col-span-3 space-y-6"}>
          {/* PR Approvals Queue */}
          {openPRs.length > 0 && (
            <div className="rounded-xl border border-orange-300 bg-gradient-to-r from-red-50/70 via-orange-50/70 to-amber-50/70 p-4 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 select-none border-b border-orange-200/80 pb-2">
                <GitPullRequest className="size-4 text-orange-600 animate-pulse" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-orange-700">
                  Pending PR Reviews & Merge Queue ({openPRs.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {openPRs.map((pr) => (
                  <div
                    key={pr.id}
                    className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between gap-3 shadow-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[9px] text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">PR #{pr.prNumber}</span>
                          {pr.buildStatus === "SUCCESS" && (
                            <CheckCircle2 className="size-3 text-blue-600" />
                          )}
                          {pr.buildStatus === "FAILURE" && (
                            <AlertCircle className="size-3 text-red-600" />
                          )}
                          {pr.buildStatus === "PENDING" && (
                            <Loader2 className="size-3 text-orange-500 animate-spin" />
                          )}
                        </div>
                        <span className="font-semibold text-slate-700">
                          by {pr.author.firstName} {pr.author.lastName}
                        </span>
                      </div>
                      <h3 className="text-xs font-semibold leading-snug mt-1.5 truncate text-slate-900">
                        {pr.message}
                      </h3>
                      <div className="flex items-center gap-1 mt-1.5 text-[9px] text-slate-500 font-mono">
                        <GitFork className="size-2.5 text-blue-600" />
                        <span>
                          branch: <span className="text-blue-700 font-semibold">{pr.branch}</span>
                        </span>
                      </div>
                      {pr.task && (
                        <p className="text-[10px] text-slate-600 mt-1.5 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg truncate">
                          Linked Task:{" "}
                          <span className="font-mono font-semibold text-blue-700 mr-1">
                            DEV-{pr.task.taskNumber}
                          </span>
                          <span className="font-semibold text-slate-900">{pr.task.title}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[10px] text-slate-500 hover:text-red-600 font-medium"
                        onClick={async () => {
                          try {
                            await declinePR.mutateAsync(pr.id);
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        disabled={declinePR.isPending || mergePR.isPending}
                      >
                        Decline
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-[10px] bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg shadow-xs"
                        onClick={async () => {
                          try {
                            await mergePR.mutateAsync(pr.id);
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        disabled={declinePR.isPending || mergePR.isPending}
                      >
                        {mergePR.isPending ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          "Merge & Close"
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Sprint Banner */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs relative overflow-hidden border-l-4 border-l-blue-600">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div className="md:col-span-2 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="size-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 flex items-center justify-center shrink-0">
                      <Sparkles className="size-5 text-amber-300" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-extrabold text-slate-900 truncate">
                          {activeSprint ? activeSprint.name : "No Active Sprint"}
                        </h2>
                        {activeSprint ? (
                          <span className="inline-flex items-center gap-1.5 text-[9px] font-extrabold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/90 uppercase tracking-wider whitespace-nowrap shrink-0 shadow-2xs">
                            <span className="size-1.5 rounded-full bg-blue-600 animate-pulse" />
                            ACTIVE SPRINT
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[9px] font-extrabold px-3 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200/90 uppercase tracking-wider whitespace-nowrap shrink-0 shadow-2xs">
                            <span className="size-1.5 rounded-full bg-orange-500 animate-pulse" />
                            IDLE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        {activeSprint
                          ? `Sprint period ends on ${new Date(activeSprint.endDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                          : "Start a sprint to allocate backlog tasks, track team velocity, and monitor burndown."}
                      </p>
                    </div>
                  </div>

                  {activeSprint ? (
                    <Button
                      onClick={handleCompleteSprint}
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs font-bold text-red-600 hover:text-red-700 border-red-200 bg-red-50/80 hover:bg-red-100/90 rounded-xl px-3.5 shadow-2xs transition-all gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <CheckCircle2 className="size-3.5 text-red-600 shrink-0" />
                      Complete Sprint
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setCreateSprintOpen(true)}
                      size="sm"
                      className="h-8 text-xs gap-1.5 font-bold rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all whitespace-nowrap shrink-0 px-3.5"
                    >
                      <Play className="size-3.5 fill-current" />
                      Start Sprint
                    </Button>
                  )}
                </div>

                {activeSprint && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-slate-100 items-center">
                    <div className="space-y-0.5 bg-blue-50/70 p-3 rounded-xl border border-blue-100">
                      <span className="text-[9px] font-bold text-blue-700 uppercase tracking-wider block">
                        Story Points
                      </span>
                      <span className="text-base font-bold text-blue-900">
                        {sprintStats.completedSP} <span className="text-xs text-blue-600 font-normal">/ {sprintStats.totalSP} SP</span>
                      </span>
                    </div>
                    <div className="space-y-0.5 bg-orange-50/70 p-3 rounded-xl border border-orange-100">
                      <span className="text-[9px] font-bold text-orange-700 uppercase tracking-wider block">
                        Tasks Completed
                      </span>
                      <span className="text-base font-bold text-orange-900">
                        {sprintStats.completedTasks} <span className="text-xs text-orange-600 font-normal">/ {sprintStats.totalTasks} Done</span>
                      </span>
                    </div>
                    <div className="col-span-2 space-y-1.5 self-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between text-[10px] text-slate-600 font-medium">
                        <span>Sprint Completion Rate</span>
                        <span className="font-bold text-blue-700">
                          {sprintStats.totalSP > 0
                            ? Math.round((sprintStats.completedSP / sprintStats.totalSP) * 100)
                            : 0}
                          %
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-orange-500 transition-all duration-500 rounded-full"
                          style={{
                            width: `${sprintStats.totalSP > 0 ? (sprintStats.completedSP / sprintStats.totalSP) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="md:col-span-1 flex justify-center border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6">
                {burndownData ? (
                  <div className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded-xl border border-slate-200 w-full max-w-[210px] shadow-2xs">
                    <div className="flex items-center justify-between w-full mb-1.5 select-none">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                        Sprint Burndown
                      </span>
                      <span className="text-[9px] text-blue-600 font-bold">
                        {burndownData.totalSP} SP
                      </span>
                    </div>
                    <svg
                      width="160"
                      height="80"
                      className="overflow-visible font-mono text-[7px] text-slate-400"
                    >
                      <defs>
                        <linearGradient id="burndownGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      {/* Gridlines */}
                      <line
                        x1="10"
                        y1="5"
                        x2="150"
                        y2="5"
                        stroke="#e2e8f0"
                        strokeDasharray="2"
                      />
                      <line x1="10" y1="70" x2="150" y2="70" stroke="#e2e8f0" />

                      {/* Ideal Path */}
                      <path
                        d={`M ${burndownData.ideal.map((p) => `${10 + (p.day * 140) / burndownData.totalDays},${burndownData.totalSP > 0 ? 70 - (p.val * 65) / burndownData.totalSP : 70}`).join(" L ")}`}
                        fill="none"
                        stroke="#94a3b8"
                        strokeWidth="1.5"
                        strokeDasharray="3"
                      />

                      {/* Actual Area & Path */}
                      {burndownData.actual.length > 0 && (
                        <>
                          <path
                            d={`M 10 70 L ${burndownData.actual.map((p) => `${10 + (p.day * 140) / burndownData.totalDays},${burndownData.totalSP > 0 ? 70 - (p.val * 65) / burndownData.totalSP : 70}`).join(" L ")} L ${10 + (burndownData.actual[burndownData.actual.length - 1].day * 140) / burndownData.totalDays} 70 Z`}
                            fill="url(#burndownGradient)"
                          />
                          <path
                            d={`M ${burndownData.actual.map((p) => `${10 + (p.day * 140) / burndownData.totalDays},${burndownData.totalSP > 0 ? 70 - (p.val * 65) / burndownData.totalSP : 70}`).join(" L ")}`}
                            fill="none"
                            stroke="#2563eb"
                            strokeWidth="2.5"
                          />
                        </>
                      )}

                      {/* Interactive Dots */}
                      {burndownData.actual.map((p, index) => (
                        <circle
                          key={index}
                          cx={10 + (p.day * 140) / burndownData.totalDays}
                          cy={
                            burndownData.totalSP > 0 ? 70 - (p.val * 65) / burndownData.totalSP : 70
                          }
                          r="3"
                          className="fill-orange-500 stroke-white"
                          strokeWidth="1.5"
                        />
                      ))}
                    </svg>
                    <div className="flex justify-between w-full px-2 text-[8px] text-slate-500 font-bold font-mono mt-1.5">
                      <span>Day 1</span>
                      <span>Day {burndownData.totalDays}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <span className="text-[11px] text-slate-400 font-medium">No burndown chart active</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Navigation Toolbar & Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
            <div className="bg-slate-100 border border-slate-200 p-1 rounded-xl flex items-center gap-1 w-fit">
              <button
                onClick={() => setActiveTab("board")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === "board"
                    ? "bg-white text-blue-600 shadow-2xs border border-slate-200/90"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                <Layers className="size-3.5 text-blue-600" />
                Sprint Board
              </button>
              <button
                onClick={() => setActiveTab("backlog")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === "backlog"
                    ? "bg-white text-blue-600 shadow-2xs border border-slate-200/90"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                <CheckSquare className="size-3.5 text-orange-500" />
                Backlog
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${activeTab === "backlog" ? "bg-orange-500 text-white" : "bg-slate-200 text-slate-700"}`}>
                  {backlogTasks.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab("bugs")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === "bugs"
                    ? "bg-white text-rose-600 shadow-2xs border border-slate-200/90"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                <Bug className="size-3.5 text-rose-600" />
                Bugs
                {activeBugsCount > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      activeTab === "bugs"
                        ? "bg-rose-500 text-white"
                        : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {activeBugsCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("projects")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === "projects"
                    ? "bg-white text-blue-600 shadow-2xs border border-slate-200/90"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                <Folder className="size-3.5 text-emerald-600" />
                Projects
              </button>
              <button
                onClick={() => setActiveTab("calendar")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === "calendar"
                    ? "bg-white text-blue-600 shadow-2xs border border-slate-200/90"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                <Calendar className="size-3.5 text-indigo-600" />
                Calendar
              </button>
              <button
                onClick={() => setActiveTab("ai-tokens")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === "ai-tokens"
                    ? "bg-white text-indigo-600 shadow-2xs border border-slate-200/90"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                <Cpu className="size-3.5 text-indigo-600" />
                AI Tokens & Costs
              </button>
            </div>

            {/* Filter Dropdowns on Right */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="whitespace-nowrap inline-flex items-center gap-1.5 bg-white border border-slate-200/90 shadow-2xs px-3 py-1 rounded-xl hover:border-blue-500/50 transition-all h-9">
                <Folder className="size-3.5 text-blue-600 shrink-0" />
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="h-7 text-xs border-0 bg-transparent focus:ring-0 focus:outline-none p-0 font-bold text-slate-800 shadow-none hover:bg-transparent cursor-pointer whitespace-nowrap gap-1">
                    <SelectValue placeholder="All Projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL_PROJECTS">All Projects</SelectItem>
                    {(projects ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="whitespace-nowrap inline-flex items-center gap-1.5 bg-white border border-slate-200/90 shadow-2xs px-3 py-1 rounded-xl hover:border-blue-500/50 transition-all h-9">
                <Filter className="size-3.5 text-slate-500 shrink-0" />
                <span className="text-xs font-bold text-slate-800">Group by Status</span>
              </div>
            </div>
          </div>

          {/* Sprint Board Column Layout */}
          {activeTab === "board" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4.5">
              {TASK_STATUSES.map((status) => {
                const columnTasks = sprintTasks.filter((t) => t.status === status && !t.parentId);

                const getStatusStyles = (st: TaskStatus) => {
                  switch (st) {
                    case "TODO":
                      return { dot: "bg-blue-600", label: "TO DO" };
                    case "IN_PROGRESS":
                      return { dot: "bg-orange-500", label: "IN PROGRESS" };
                    case "IN_REVIEW":
                      return { dot: "bg-indigo-600", label: "IN REVIEW" };
                    case "READY_FOR_TESTING":
                      return { dot: "bg-sky-500", label: "READY FOR TESTING" };
                    case "CHANGES_REQUIRED":
                      return { dot: "bg-red-500", label: "BLOCKED" };
                    case "DONE":
                    default:
                      return { dot: "bg-emerald-500", label: "COMPLETED" };
                  }
                };

                const style = getStatusStyles(status);

                return (
                  <div
                    key={status}
                    className="flex flex-col bg-slate-50/70 border border-slate-200/90 rounded-2xl p-3.5 space-y-3 min-h-[340px]"
                  >
                    {/* Column Header */}
                    <div
                      onClick={() => {
                        setExpandedColumnSearch("");
                        setExpandedStatusColumn(status);
                      }}
                      className="flex items-center justify-between px-1 select-none cursor-pointer group/col"
                      title="Click to open full-page column workspace"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`size-2.5 rounded-full shrink-0 ${style.dot}`} />
                        <span className="text-xs font-extrabold uppercase text-slate-800 tracking-wide group-hover/col:text-blue-600 transition-colors">
                          {style.label}
                        </span>
                      </div>
                      <span className="text-[10px] bg-slate-200/80 text-slate-700 font-extrabold px-2 py-0.5 rounded-full shrink-0">
                        {columnTasks.length}
                      </span>
                    </div>

                    {/* Task Cards Scroll Area */}
                    <ScrollArea className="flex-1 space-y-2.5 max-h-[520px] pr-1">
                      {columnTasks.length === 0 ? (
                        <div
                          onClick={() => {
                            setExpandedColumnSearch("");
                            setExpandedStatusColumn(status);
                          }}
                          className="border border-dashed border-slate-200/80 rounded-xl p-4 text-center flex flex-col items-center justify-center gap-1 bg-white/60 my-1 cursor-pointer hover:bg-blue-50/40 hover:border-blue-300 transition-colors group/empty"
                        >
                          <p className="text-[10px] font-medium text-slate-400 group-hover/empty:text-blue-600 transition-colors">
                            No tasks in {style.label}
                          </p>
                        </div>
                      ) : (
                        columnTasks.map((task) => (
                          <div
                            key={task.id}
                            onClick={() => navigate({ to: "/tasks", search: { taskId: task.id } })}
                            className="bg-white border border-slate-200/80 hover:border-blue-500/50 rounded-xl p-3 space-y-2 shadow-2xs hover:shadow-xs transition-all duration-200 cursor-pointer group"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-0.5 flex-1 min-w-0">
                                <h3 className="text-xs font-bold leading-snug text-slate-900 group-hover:text-blue-600 transition-colors">
                                  {task.title}
                                </h3>
                                <span className="text-[10px] text-slate-400 font-medium font-mono block">
                                  #VEN-10{task.taskNumber}
                                </span>
                              </div>

                              <div className="flex items-center gap-1 shrink-0 pt-0.5">
                                <Avatar className="size-5 shrink-0 bg-blue-50 border border-blue-200">
                                  <AvatarFallback className="text-[8px] font-bold text-blue-700">
                                    {getInitials(task.assignee)}
                                  </AvatarFallback>
                                </Avatar>
                                {status === "DONE" ? (
                                  <Check className="size-3 text-emerald-500 shrink-0" />
                                ) : (
                                  <span className="text-slate-300 text-[10px] font-mono select-none">=</span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]" onClick={(e) => e.stopPropagation()}>
                              <span className="text-slate-400 font-semibold">{task.storyPoints ?? 1} SP</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReportBugTaskId(task.id);
                                  setActiveTab("bugs");
                                }}
                                className="text-[9px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                                title="Report bug for this task"
                              >
                                <Bug className="size-2.5" /> + Bug
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </ScrollArea>

                    {/* Bottom Column Action */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTask(null);
                        setTaskDialogOpen(true);
                      }}
                      className="w-full pt-1 flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors px-1 cursor-pointer"
                    >
                      <Plus className="size-3.5" />
                      Add Task
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Backlog View */}
          {activeTab === "backlog" && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 shadow-xs rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                    <CheckSquare className="size-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">Backlog Planning</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Select unassigned backlog tasks to allocate them into the active sprint.
                    </p>
                  </div>
                </div>
                {activeSprint ? (
                  <Button
                    onClick={handleAddToSprint}
                    disabled={Object.values(selectedBacklogTaskIds).filter(Boolean).length === 0}
                    size="sm"
                    className="text-xs gap-1.5 font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow transition-all"
                  >
                    <Plus className="size-3.5" />
                    Move ({Object.values(selectedBacklogTaskIds).filter(Boolean).length}) to Sprint
                  </Button>
                ) : (
                  <span className="text-[10px] text-orange-700 bg-orange-50 border border-orange-200 font-medium px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                    <AlertCircle className="size-3 text-orange-600" /> Start a sprint first to allocate backlog items.
                  </span>
                )}
              </div>

              <div className="border border-slate-200 rounded-xl bg-white shadow-2xs overflow-hidden">
                {backlogTasks.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 space-y-2 flex flex-col items-center justify-center">
                    <div className="size-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                      <CheckSquare className="size-6 text-blue-600/40" />
                    </div>
                    <p className="text-xs font-bold text-slate-900">Backlog is empty</p>
                    <p className="text-[10px] max-w-sm text-slate-500">Create new tasks to populate your backlog for future sprint planning.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {backlogTasks
                      .filter((t) => !t.parentId)
                      .map((task) => {
                        const isSelected = !!selectedBacklogTaskIds[task.id];
                        return (
                          <div
                            key={task.id}
                            className={`p-3.5 flex items-center gap-3 transition-colors ${isSelected ? "bg-blue-50/60" : "hover:bg-slate-50/50"}`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) =>
                                setSelectedBacklogTaskIds((prev) => ({
                                  ...prev,
                                  [task.id]: e.target.checked,
                                }))
                              }
                              className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0 cursor-pointer"
                            />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {getTaskTypeIcon(task.type)}
                                <span className="text-xs font-semibold truncate text-slate-900">
                                  <span className="font-mono text-blue-700 font-bold mr-1.5">
                                    DEV-{task.taskNumber}
                                  </span>
                                  {task.title}
                                </span>
                              </div>
                              {task.description && (
                                <p className="text-[10px] text-slate-500 truncate mt-0.5 max-w-xl">
                                  {task.description}
                                </p>
                              )}

                              {task.subtasks && task.subtasks.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {task.subtasks.map((sub) => (
                                    <div
                                      key={sub.id}
                                      className="flex items-center gap-1.5 text-[9px] bg-slate-50 w-fit pr-3 pl-1.5 py-0.5 rounded border border-slate-200"
                                    >
                                      <span className="text-blue-700 font-bold font-mono">
                                        DEV-{sub.taskNumber}
                                      </span>
                                      <span
                                        className={`truncate ${sub.status === "DONE" ? "line-through text-slate-400" : "text-slate-900"}`}
                                      >
                                        {sub.title}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-3 shrink-0 select-none">
                              {task.dueDate && (
                                <div
                                  className={`text-[9px] font-medium flex items-center gap-1 ${new Date(task.dueDate) < new Date() ? "text-red-600 font-bold bg-red-50 border border-red-200 px-1.5 py-0.5 rounded" : "text-slate-500"}`}
                                >
                                  <Calendar className="size-3" />
                                  {new Date(task.dueDate).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </div>
                              )}
                              <span
                                className={`px-1.5 py-0.5 border rounded-md text-[8px] font-bold font-mono uppercase ${getTaskTypeBadge(task.type)}`}
                              >
                                {TASK_TYPE_LABELS[task.type]}
                              </span>

                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-slate-600">
                                  {task.storyPoints ?? 0} SP
                                </span>
                                {/* Story Point Selector */}
                                <Select
                                  value={String(task.storyPoints ?? 1)}
                                  onValueChange={(v) =>
                                    updateTask.mutate({
                                      id: task.id,
                                      input: { storyPoints: parseInt(v, 10) },
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-6 w-12 text-[9px] p-1 bg-white border-slate-200">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {[1, 2, 3, 5, 8, 13].map((sp) => (
                                      <SelectItem
                                        key={sp}
                                        value={String(sp)}
                                        className="text-[9px]"
                                      >
                                        {sp}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <Select
                                value={task.type}
                                onValueChange={(v) =>
                                  updateTask.mutate({
                                    id: task.id,
                                    input: { type: v as TaskType },
                                  })
                                }
                              >
                                <SelectTrigger className="h-6 w-24 text-[9px] p-1 bg-white border-slate-200">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {TASK_TYPES.map((t) => (
                                    <SelectItem key={t} value={t} className="text-[9px]">
                                      {TASK_TYPE_LABELS[t]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReportBugTaskId(task.id);
                                  setActiveTab("bugs");
                                }}
                                className="text-[9px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                                title="Report bug for this task"
                              >
                                <Bug className="size-2.5" /> + Bug
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bugs Panel View */}
          {activeTab === "bugs" && (
            <DevBugsPanel
              selectedProjectId={selectedProjectId}
              onSelectTask={(taskId) => {
                navigate({ to: "/tasks", search: { taskId } });
              }}
              onRequestReportBugTaskId={reportBugTaskId}
              onClearRequestReportBugTaskId={() => setReportBugTaskId(null)}
            />
          )}

          {/* Projects View */}
          {activeTab === "projects" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Workspace Projects</h3>
                  <p className="text-xs text-slate-500 mt-0.5">High level project epics & release milestones.</p>
                </div>
                <Button
                  size="sm"
                  className="h-8 text-xs font-semibold rounded-xl gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => setCreateProjectOpen(true)}
                >
                  <Plus className="size-3.5" /> Create Project
                </Button>
              </div>
              {projects?.length === 0 ? (
                <div className="text-xs text-slate-500 bg-white border border-slate-200 p-12 text-center rounded-xl flex flex-col items-center justify-center gap-2 shadow-2xs">
                  <Folder className="size-8 text-blue-600/40" />
                  <p className="font-semibold text-slate-900">No projects found</p>
                  <p className="text-[10px]">Create your first development project to categorize sprint tasks.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {projects?.map((p) => (
                    <Link
                      key={p.id}
                      to="/projects/$id"
                      params={{ id: p.id }}
                      className="bg-white border border-slate-200 hover:border-blue-500/50 p-4.5 rounded-2xl space-y-3 shadow-2xs hover:shadow-md transition-all duration-200 group block select-none cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="size-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                            <Folder className="size-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{p.name}</h4>
                            <span className="text-[9px] font-bold text-blue-600 uppercase">ACTIVE PROJECT</span>
                          </div>
                        </div>
                        <span className="font-semibold px-2 py-0.5 text-[9px] rounded-full border border-orange-200 bg-orange-50 text-orange-700 uppercase shrink-0">
                          {p.status}
                        </span>
                      </div>

                      {(() => {
                        const cleanDesc = p.description
                          ? p.description.split(/\*\*Key Deliverables:\*\*/i)[0]?.trim()
                          : "";
                        return (
                          <p className="text-[11px] text-slate-500 min-h-[28px] line-clamp-2 leading-relaxed">
                            {cleanDesc || "No description provided."}
                          </p>
                        );
                      })()}

                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2.5 border-t border-slate-100 font-medium">
                        <span className="flex items-center gap-1 font-semibold text-slate-700">
                          <Layers className="size-3 text-blue-600" />
                          {filteredTasks.filter(t => t.projectId === p.id).length} Linked Tasks
                        </span>
                        {p.dueDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3 text-slate-400" />
                            Target: {new Date(p.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Calendar View */}
          {activeTab === "calendar" && (
            <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-2xs space-y-4">
              {/* Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                    <Calendar className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {calendarNav.monthName} {calendarNav.year}
                    </h3>
                    <p className="text-xs text-slate-500">Release milestones & task due schedule.</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Navigation controls */}
                  <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-slate-700 hover:bg-white rounded-lg"
                      onClick={() =>
                        setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))
                      }
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs font-bold text-blue-700 hover:bg-white rounded-lg px-2.5"
                      onClick={() => setCalendarDate(new Date())}
                    >
                      Today
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-slate-700 hover:bg-white rounded-lg"
                      onClick={() =>
                        setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))
                      }
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>

                  {/* Mode Selector */}
                  <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      onClick={() => setCalendarViewMode("month")}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                        calendarViewMode === "month"
                          ? "bg-white text-blue-600 font-bold shadow-xs border border-slate-200"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Grid View
                    </button>
                    <button
                      onClick={() => setCalendarViewMode("agenda")}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                        calendarViewMode === "agenda"
                          ? "bg-white text-blue-600 font-bold shadow-xs border border-slate-200"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Agenda List
                    </button>
                  </div>
                </div>
              </div>

              {/* Event Legend */}
              <div className="flex flex-wrap items-center gap-2 select-none text-[10px] pt-1">
                <span className="font-semibold text-slate-500 mr-1">Legend:</span>
                <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-bold">
                  Feature Task
                </span>
                <span className="bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-bold">
                  Bug Alert
                </span>
                <span className="bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full font-bold">
                  Refactor Task
                </span>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                  Chore
                </span>
                <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-bold">
                  Sprint Milestone
                </span>
                <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                  Release Milestone
                </span>
              </div>

              {/* Grid View */}
              {calendarViewMode === "month" && (
                <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-xl overflow-hidden border border-slate-200 shadow-2xs">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName) => (
                    <div
                      key={dayName}
                      className="bg-slate-100 py-2 text-center text-xs font-bold text-slate-700 uppercase tracking-wider select-none"
                    >
                      {dayName}
                    </div>
                  ))}

                  {calendarNav.cells.map((cell, idx) => {
                    const dayEvents = calendarEventsByDate.get(cell.dateStr) || [];
                    return (
                      <div
                        key={idx}
                        className={`min-h-[92px] p-2 flex flex-col justify-between transition-colors ${
                          !cell.isCurrentMonth
                            ? "bg-slate-50/50 text-slate-400"
                            : cell.isToday
                              ? "bg-blue-50/60 border-2 border-blue-500/40"
                              : "bg-white hover:bg-slate-50/70"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs font-bold font-mono ${
                              cell.isToday
                                ? "size-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs"
                                : cell.isCurrentMonth
                                  ? "text-slate-900"
                                  : "text-slate-400"
                            }`}
                          >
                            {cell.dayNum}
                          </span>
                          {dayEvents.length > 0 && (
                            <span className="text-[9px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded-full">
                              {dayEvents.length}
                            </span>
                          )}
                        </div>

                        <div className="space-y-1 mt-1 flex-1 overflow-hidden">
                          {dayEvents.slice(0, 3).map((evt) => {
                            const badgeStyle =
                              evt.type === "TASK_BUG"
                                ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                                : evt.type === "TASK_REFACTOR"
                                  ? "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
                                  : evt.type === "TASK_CHORE"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                    : evt.type === "SPRINT_START" || evt.type === "SPRINT_END"
                                      ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                                      : evt.type === "PROJECT_RELEASE"
                                        ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                                        : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100";

                            return (
                              <div
                                key={evt.id}
                                onClick={() =>
                                  evt.taskId &&
                                  navigate({ to: "/tasks", search: { taskId: evt.taskId } })
                                }
                                className={`text-[9px] font-medium border px-1.5 py-0.5 rounded-md truncate cursor-pointer transition-colors flex items-center gap-1 ${badgeStyle}`}
                                title={evt.title}
                              >
                                {evt.taskKey && (
                                  <span className="font-mono font-bold shrink-0">{evt.taskKey}</span>
                                )}
                                <span className="truncate">{evt.title}</span>
                              </div>
                            );
                          })}
                          {dayEvents.length > 3 && (
                            <span className="text-[8px] font-bold text-blue-600 hover:underline block text-center">
                              +{dayEvents.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Agenda List View */}
              {calendarViewMode === "agenda" && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                  {calendarEventsByDate.size === 0 ? (
                    <div className="py-16 text-center text-slate-400 space-y-2 flex flex-col items-center justify-center">
                      <div className="size-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                        <Calendar className="size-6 text-blue-600/40" />
                      </div>
                      <p className="text-xs font-bold text-slate-900">No scheduled events or task due dates</p>
                      <p className="text-[10px] text-slate-500">Set due dates on sprint tasks to display them here.</p>
                    </div>
                  ) : (
                    Array.from(calendarEventsByDate.entries())
                      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
                      .map(([dStr, evts]) => (
                      <div key={dStr} className="py-3 flex flex-col sm:flex-row sm:items-start gap-3">
                        <div className="w-36 shrink-0">
                          <span className="text-xs font-bold text-slate-900 block font-mono">{dStr}</span>
                        </div>
                        <div className="flex-1 space-y-1.5">
                          {evts.map((evt) => (
                            <div
                              key={evt.id}
                              onClick={() =>
                                evt.taskId &&
                                navigate({ to: "/tasks", search: { taskId: evt.taskId } })
                              }
                              className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-500/40 cursor-pointer transition-all shadow-2xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {evt.taskKey && (
                                  <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                                    {evt.taskKey}
                                  </span>
                                )}
                                <span className="text-xs font-medium text-slate-900 truncate">{evt.title}</span>
                              </div>
                              <span className="text-[9px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 shrink-0">
                                {evt.type.replace("_", " ")}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* AI Tokens & Costs Tab Content */}
          {activeTab === "ai-tokens" && (
            <div className="pt-1">
              <AiTokenMonitorWidget />
            </div>
          )}
        </div>

        {/* Right Column: Sprint Overview & Daily Activity Feed */}
        {activeTab !== "ai-tokens" && (
          <div className="space-y-6 select-none font-sans">
          {/* Widget 1: Sprint Overview */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900">Sprint Overview</h3>
              </div>
            </div>

            <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                This Sprint
              </span>
              <p className="text-xs font-bold text-slate-900 truncate">
                {activeSprint ? activeSprint.name : "No active sprint"}
              </p>
            </div>

            <div className="space-y-2.5 pt-1 text-xs">
              <div className="flex items-center justify-between text-slate-600 font-medium">
                <span>Tasks Completed</span>
                <span className="font-extrabold text-slate-900">{sprintStats.completedTasks}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600 font-medium">
                <span>Total Tasks</span>
                <span className="font-extrabold text-slate-900">{sprintStats.totalTasks}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600 font-medium">
                <span>Completion Rate</span>
                <span className="font-extrabold text-blue-700">
                  {sprintStats.totalSP > 0
                    ? Math.round((sprintStats.completedSP / sprintStats.totalSP) * 100)
                    : 0}
                  %
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={() => setActiveTab("board")}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors group"
              >
                <span>View sprint analytics</span>
                <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* Widget 2: Daily Activity Feed */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4 flex flex-col min-h-[420px]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900">Daily Activity Feed</h3>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/90 uppercase tracking-wider shrink-0 shadow-2xs">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>

            <ScrollArea className="flex-1 pr-1 text-xs max-h-[350px]">
              {(commitsLoading || sprintUpdatesLoading || tasksLoading) && (
                <div className="flex items-center justify-center gap-2 text-slate-400 py-12">
                  <Loader2 className="size-4 animate-spin text-blue-600" /> Loading feed...
                </div>
              )}
              {!commitsLoading && !sprintUpdatesLoading && !tasksLoading && dailyUpdates.length === 0 && (
                <div className="py-16 text-center px-4 space-y-2 flex flex-col items-center justify-center">
                  <div className="size-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shadow-2xs">
                    <Activity className="size-5 text-blue-600/50" />
                  </div>
                  <p className="text-xs font-bold text-slate-900">No Activity Yet</p>
                  <p className="text-[10px] text-slate-500 max-w-[180px] leading-relaxed">
                    Commits, tasks, and team updates will stream here live.
                  </p>
                </div>
              )}
              <div className="space-y-4">
                {dailyUpdates.map((group) => (
                  <div key={group.date} className="space-y-2.5">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                      {group.date}
                    </div>
                    <div className="space-y-2">
                      {group.items.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (item.task) {
                              setSelectedTask(item.task);
                              setTaskDialogOpen(true);
                            } else if (item.type === "bug") {
                              setActiveTab("bugs");
                            }
                          }}
                          className={`flex items-start gap-3 text-xs p-2 rounded-xl transition-all border border-transparent ${
                            item.task || item.type === "bug"
                              ? "hover:bg-slate-50 hover:border-slate-200/80 cursor-pointer"
                              : ""
                          }`}
                        >
                          <Avatar className="size-7 shrink-0 bg-blue-50 border border-blue-200 mt-0.5">
                            <AvatarFallback className="text-[9px] font-bold text-blue-700">
                              {getInitials(item.user)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 text-[11px]">
                              <span className="font-bold text-slate-900 truncate">
                                {item.user.firstName} {item.user.lastName}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium shrink-0">
                                {new Date(item.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0 ${item.actionTone}`}>
                                {item.actionLabel}
                              </span>
                              <p className="text-[11px] text-slate-700 font-medium leading-snug truncate">
                                {item.title}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAllActivityModalOpen(true)}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors group cursor-pointer"
              >
                <span>View all activity</span>
                <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

      {/* DIALOGS */}

      {/* Task Detail Dialog (opened from a sprint board card) -- includes
          the Progress Updates log for that task. */}
      {selectedTask && (
        <TaskFormDialog
          open={taskDialogOpen}
          onOpenChange={(open) => {
            setTaskDialogOpen(open);
            if (!open) setSelectedTask(null);
          }}
          task={selectedTask}
        />
      )}

      {/* Create Project Dialog */}
      <Dialog open={createProjectOpen} onOpenChange={setCreateProjectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProject} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Project Name</Label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Q3 Website Redesign"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={projectDesc}
                onChange={(e) => setProjectDesc(e.target.value)}
                placeholder="High level goals..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Target Due Date</Label>
              <Input
                type="date"
                value={projectDue}
                onChange={(e) => setProjectDue(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateProjectOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createProject.isPending}>
                {createProject.isPending ? "Creating..." : "Create Project"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Start Sprint Dialog */}
      <Dialog open={createSprintOpen} onOpenChange={setCreateSprintOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Start Sprint</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSprint} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="sprint-name">Sprint Name</Label>
              <Input
                id="sprint-name"
                value={sprintName}
                onChange={(e) => setSprintName(e.target.value)}
                placeholder="e.g. Sprint 1 - Core Backend"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="sprint-start">Start Date</Label>
                <Input
                  id="sprint-start"
                  type="date"
                  value={sprintStart}
                  onChange={(e) => setSprintStart(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sprint-end">End Date</Label>
                <Input
                  id="sprint-end"
                  type="date"
                  value={sprintEnd}
                  onChange={(e) => setSprintEnd(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Associated Project</Label>
              <Select value={sprintProjectId} onValueChange={setSprintProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Project (Optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Specific Project (Global)</SelectItem>
                  {(projects ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateSprintOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createSprint.isPending}>
                {createSprint.isPending ? "Starting..." : "Start Sprint"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      <Dialog open={createTaskOpen} onOpenChange={setCreateTaskOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="task-title">Task Title</Label>
              <Input
                id="task-title"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="e.g. Implement JWT refresh endpoint"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-desc">Description</Label>
              <Input
                id="task-desc"
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                placeholder="Details, acceptance criteria..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={taskType} onValueChange={(v) => setTaskTypeState(v as TaskType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TASK_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Story Points</Label>
                <Select value={taskSP} onValueChange={setTaskSP}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 5, 8, 13].map((sp) => (
                      <SelectItem key={sp} value={String(sp)}>
                        {sp} SP
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Assignee</Label>
              <Select value={taskAssigneeId} onValueChange={setTaskAssigneeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Teammate" />
                </SelectTrigger>
                <SelectContent>
                  {devTeammates.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.firstName} {member.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Project</Label>
              <Select value={taskProjectId} onValueChange={setTaskProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Project (Optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {projects?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Parent Task (Sub-task of)</Label>
              <Select value={taskParentId} onValueChange={setTaskParentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Parent Task (Optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {tasks
                    ?.filter((t) => !t.parentId)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        DEV-{t.taskNumber} {t.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateTaskOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createTask.isPending}>
                {createTask.isPending ? "Creating..." : "Create Task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Set GitHub Username Dialog */}
      <Dialog open={githubDialogOpen} onOpenChange={setGithubDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set GitHub Username</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-xs text-text-dim">
              Link your GitHub username to automatically sync your commits and PRs to your Venus CRM
              tasks.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="github-username">GitHub Username</Label>
              <Input
                id="github-username"
                value={githubUsernameInput}
                onChange={(e) => setGithubUsernameInput(e.target.value)}
                placeholder="e.g. octocat"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setGithubDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (currentUser) {
                    await updateGithubUsername.mutateAsync({
                      id: currentUser.id,
                      githubUsername: githubUsernameInput.trim() || null,
                    });
                    setGithubDialogOpen(false);
                  }
                }}
                disabled={updateGithubUsername.isPending}
              >
                {updateGithubUsername.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG: All Activity Feed History */}
      <Dialog open={allActivityModalOpen} onOpenChange={setAllActivityModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-white">
          <DialogHeader className="p-5 border-b border-slate-100 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-blue-600" />
                <DialogTitle className="text-base font-bold text-slate-900">
                  Daily Activity History
                </DialogTitle>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {dailyUpdates.reduce((acc, g) => acc + g.items.length, 0)} Total
                </span>
              </div>
              <DialogDescription className="text-xs text-slate-500">
                Live stream of task completions, progress updates, bug reports, and code commits.
              </DialogDescription>
            </div>
          </DialogHeader>

          {/* Search & Filter Bar */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 size-3.5 text-slate-400" />
              <Input
                value={activitySearch}
                onChange={(e) => setActivitySearch(e.target.value)}
                placeholder="Search activity..."
                className="pl-8 text-xs bg-white h-8"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              {(["ALL", "TASKS", "UPDATES", "COMMITS", "BUGS"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActivityFilter(tab)}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    activityFilter === tab
                      ? "bg-blue-600 text-white shadow-2xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {tab === "ALL" ? "All" : tab === "TASKS" ? "Tasks" : tab === "UPDATES" ? "Updates" : tab === "COMMITS" ? "Commits" : "Bugs"}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable list */}
          <ScrollArea className="flex-1 p-5 overflow-y-auto max-h-[500px]">
            <div className="space-y-6">
              {dailyUpdates
                .map((group) => {
                  const filteredItems = group.items.filter((item) => {
                    const matchesType =
                      activityFilter === "ALL" ||
                      (activityFilter === "TASKS" && item.type === "task") ||
                      (activityFilter === "UPDATES" && item.type === "update") ||
                      (activityFilter === "COMMITS" && item.type === "commit") ||
                      (activityFilter === "BUGS" && item.type === "bug");
                    const matchesSearch =
                      !activitySearch.trim() ||
                      item.title.toLowerCase().includes(activitySearch.toLowerCase()) ||
                      `${item.user.firstName} ${item.user.lastName}`
                        .toLowerCase()
                        .includes(activitySearch.toLowerCase()) ||
                      item.actionLabel.toLowerCase().includes(activitySearch.toLowerCase());
                    return matchesType && matchesSearch;
                  });

                  if (filteredItems.length === 0) return null;

                  return (
                    <div key={group.date} className="space-y-3">
                      <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider sticky top-0 bg-white/90 backdrop-blur-xs py-1">
                        {group.date}
                      </div>
                      <div className="space-y-2">
                        {filteredItems.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => {
                              if (item.task) {
                                setSelectedTask(item.task);
                                setTaskDialogOpen(true);
                                setAllActivityModalOpen(false);
                              } else if (item.type === "bug") {
                                setActiveTab("bugs");
                                setAllActivityModalOpen(false);
                              }
                            }}
                            className={`flex items-start gap-3 p-3 rounded-xl border border-slate-200/80 bg-white hover:border-blue-300 hover:shadow-2xs transition-all ${
                              item.task || item.type === "bug" ? "cursor-pointer" : ""
                            }`}
                          >
                            <Avatar className="size-8 bg-blue-50 border border-blue-200 mt-0.5 shrink-0">
                              <AvatarFallback className="text-[10px] font-bold text-blue-700">
                                {getInitials(item.user)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-xs text-slate-900 truncate">
                                  {item.user.firstName} {item.user.lastName}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium shrink-0">
                                  {new Date(item.date).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border uppercase tracking-wider ${item.actionTone}`}
                                >
                                  {item.actionLabel}
                                </span>
                                <span className="text-xs text-slate-800 font-medium">
                                  {item.title}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
                .filter(Boolean)}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

    </div>
  );
}
