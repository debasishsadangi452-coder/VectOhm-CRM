import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Bug as BugIcon,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ShieldCheck,
  User,
  Folder,
  CheckSquare,
  MessageSquare,
  ArrowRight,
  Trash2,
  ExternalLink,
  ChevronRight,
  Send,
  Loader2,
  LayoutGrid,
  List,
  AlertCircle,
  Sparkles,
  FileCode,
  History,
  XCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import { useUsers } from "@/hooks/use-users";
import { useProjects } from "@/hooks/use-projects";
import { useTasks } from "@/hooks/use-tasks";
import {
  useBugs,
  useBug,
  useCreateBug,
  useUpdateBug,
  useDeleteBug,
  useAddBugComment,
  useSubmitBugFix,
  useReviewBugFix,
} from "@/hooks/use-bugs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BUG_PRIORITIES,
  BUG_SEVERITIES,
  BUG_STATUSES,
  BUG_STATUS_LABELS,
  BUG_SEVERITY_COLORS,
  type Bug,
  type BugPriority,
  type BugSeverity,
  type BugStatus,
  type Task,
} from "@/lib/api/types";
import { getInitials } from "@/lib/utils";
import { formatRelativeDay } from "@/lib/format-relative-day";

interface DevBugsPanelProps {
  selectedProjectId?: string;
  onSelectTask?: (taskId: string) => void;
  onRequestReportBugTaskId?: string | null;
  onClearRequestReportBugTaskId?: () => void;
}

export function DevBugsPanel({
  selectedProjectId: initialProjectId = "ALL_PROJECTS",
  onSelectTask,
  onRequestReportBugTaskId,
  onClearRequestReportBugTaskId,
}: DevBugsPanelProps) {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const isEmployee = currentUser?.role?.name === "EMPLOYEE";
  const isManagerOrAdmin =
    currentUser?.role?.name === "ADMIN" || currentUser?.role?.name === "MANAGER";

  const handleGoToTask = (taskId: string) => {
    setDetailBugId(null);
    if (onSelectTask) {
      onSelectTask(taskId);
    } else {
      navigate({ to: "/tasks", search: { taskId } });
    }
  };

  // Data queries
  const { data: users = [] } = useUsers();
  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useTasks({});

  const [projectIdFilter, setProjectIdFilter] = useState<string>(initialProjectId);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState<string>(
    isEmployee && currentUser ? currentUser.id : "ALL",
  );
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");

  // Bugs query with scoping
  const { data: bugs = [], isLoading: bugsLoading } = useBugs({
    projectId: projectIdFilter !== "ALL_PROJECTS" ? projectIdFilter : undefined,
    assigneeId: isEmployee && currentUser ? currentUser.id : assigneeFilter !== "ALL" ? assigneeFilter : undefined,
  });

  // Mutations
  const createBugMutation = useCreateBug();
  const updateBugMutation = useUpdateBug();
  const deleteBugMutation = useDeleteBug();
  const addCommentMutation = useAddBugComment();
  const submitBugFixMutation = useSubmitBugFix();
  const reviewBugFixMutation = useReviewBugFix();

  // Create Bug Dialog State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newProjectId, setNewProjectId] = useState<string>(
    initialProjectId !== "ALL_PROJECTS" ? initialProjectId : "",
  );
  const [newTaskId, setNewTaskId] = useState<string>("");
  const [newAssigneeId, setNewAssigneeId] = useState<string>("");
  const [newSeverity, setNewSeverity] = useState<BugSeverity>("MEDIUM");
  const [newPriority, setNewPriority] = useState<BugPriority>("MEDIUM");

  // Fix Submission State
  const [fixSubmittingBug, setFixSubmittingBug] = useState<Bug | null>(null);
  const [fixSummary, setFixSummary] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [testingNotes, setTestingNotes] = useState("");
  const [prLink, setPrLink] = useState("");
  const [fixAttachmentUrl, setFixAttachmentUrl] = useState("");

  // Manager Review State
  const [managerReviewComments, setManagerReviewComments] = useState("");

  // Detail Modal State
  const [detailBugId, setDetailBugId] = useState<string | null>(null);
  const { data: detailedBug } = useBug(detailBugId ?? undefined);
  const [commentText, setCommentText] = useState("");

  const handleOpenSubmitFixDialog = (bug: Bug) => {
    setFixSubmittingBug(bug);
    setFixSummary(bug.fixSummary || "");
    setRootCause(bug.rootCause || "");
    setTestingNotes(bug.testingNotes || "");
    setPrLink(bug.prLink || "");
    setFixAttachmentUrl(bug.fixAttachmentUrl || "");
  };

  const handleSubmitFix = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fixSubmittingBug) return;
    if (!fixSummary.trim()) {
      toast.error("Please enter a summary of the fix.");
      return;
    }
    try {
      await submitBugFixMutation.mutateAsync({
        id: fixSubmittingBug.id,
        input: {
          fixSummary: fixSummary.trim(),
          rootCause: rootCause.trim() || undefined,
          testingNotes: testingNotes.trim() || undefined,
          prLink: prLink.trim() || undefined,
          fixAttachmentUrl: fixAttachmentUrl.trim() || undefined,
        },
      });
      toast.success("Fix submitted successfully for Manager Review!");
      setFixSubmittingBug(null);
    } catch (err: unknown) {
      console.error(err);
      toast.error(
        (err as { message?: string })?.message || "Failed to submit fix for review.",
      );
    }
  };

  const handleReviewFix = async (
    bugId: string,
    decision: "APPROVE" | "REJECT" | "REQUEST_CHANGES",
  ) => {
    try {
      await reviewBugFixMutation.mutateAsync({
        id: bugId,
        input: {
          decision,
          managerComments: managerReviewComments.trim() || undefined,
        },
      });
      const labels = {
        APPROVE: "approved as FIXED",
        REJECT: "rejected (returned to In Progress)",
        REQUEST_CHANGES: "marked for Rework Required",
      };
      toast.success(`Bug fix ${labels[decision]}!`);
      setManagerReviewComments("");
    } catch (err: unknown) {
      console.error(err);
      toast.error((err as { message?: string })?.message || "Failed to review fix.");
    }
  };

  // Handle auto-open when triggered from outside
  if (onRequestReportBugTaskId && !isCreateOpen) {
    const targetTask = tasks.find((t) => t.id === onRequestReportBugTaskId);
    if (targetTask) {
      if (targetTask.projectId) setNewProjectId(targetTask.projectId);
      setNewTaskId(targetTask.id);
      if (targetTask.assignee?.id) setNewAssigneeId(targetTask.assignee.id);
      setIsCreateOpen(true);
      onClearRequestReportBugTaskId?.();
    }
  }

  // Filter tasks based on selected project for creation
  const projectTasks = useMemo(() => {
    if (!newProjectId) return tasks;
    return tasks.filter((t) => t.projectId === newProjectId);
  }, [tasks, newProjectId]);

  // Filtered bugs for display
  const filteredBugs = useMemo(() => {
    return bugs.filter((bug) => {
      if (statusFilter !== "ALL" && bug.status !== statusFilter) return false;
      if (severityFilter !== "ALL" && bug.severity !== severityFilter) return false;
      if (!isEmployee && assigneeFilter !== "ALL" && bug.assigneeId !== assigneeFilter) return false;
      if (projectIdFilter !== "ALL_PROJECTS" && bug.task?.projectId !== projectIdFilter) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesNumber = `#${bug.bugNumber}`.includes(query) || `${bug.bugNumber}`.includes(query);
        const matchesTitle = bug.title.toLowerCase().includes(query);
        const matchesDesc = bug.description?.toLowerCase().includes(query);
        const matchesTask = bug.task?.title.toLowerCase().includes(query);
        const matchesAssignee =
          `${bug.assignee?.firstName ?? ""} ${bug.assignee?.lastName ?? ""}`
            .toLowerCase()
            .includes(query);
        if (!matchesNumber && !matchesTitle && !matchesDesc && !matchesTask && !matchesAssignee) {
          return false;
        }
      }
      return true;
    });
  }, [bugs, statusFilter, severityFilter, assigneeFilter, projectIdFilter, searchQuery, isEmployee]);

  // KPI Metrics
  const stats = useMemo(() => {
    const total = filteredBugs.length;
    const openOrActive = filteredBugs.filter(
      (b) =>
        b.status === "OPEN" ||
        b.status === "ASSIGNED" ||
        b.status === "IN_PROGRESS" ||
        b.status === "REOPENED",
    ).length;
    const pendingReview = filteredBugs.filter((b) => b.status === "PENDING_REVIEW").length;
    const reworkRequired = filteredBugs.filter((b) => b.status === "REWORK_REQUIRED").length;
    const fixedOrClosed = filteredBugs.filter(
      (b) => b.status === "FIXED" || b.status === "CLOSED",
    ).length;
    const criticalOrHigh = filteredBugs.filter(
      (b) =>
        (b.severity === "CRITICAL" || b.severity === "HIGH") &&
        b.status !== "CLOSED" &&
        b.status !== "FIXED",
    ).length;
    return {
      total,
      openOrActive,
      pendingReview,
      reworkRequired,
      fixedOrClosed,
      criticalOrHigh,
    };
  }, [filteredBugs]);

  const handleCreateBug = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.error("Please enter a bug title.");
      return;
    }
    if (!newTaskId) {
      toast.error("Please select an associated task for this bug.");
      return;
    }

    try {
      await createBugMutation.mutateAsync({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        taskId: newTaskId,
        assigneeId: newAssigneeId || undefined,
        severity: newSeverity,
        priority: newPriority,
        status: newAssigneeId ? "ASSIGNED" : "OPEN",
      });
      toast.success("Bug reported successfully!");
      setIsCreateOpen(false);
      setNewTitle("");
      setNewDescription("");
      setNewTaskId("");
      setNewAssigneeId("");
    } catch (err: unknown) {
      console.error(err);
      toast.error((err as { message?: string })?.message || "Failed to report bug.");
    }
  };

  const handleQuickStatusChange = async (bugId: string, nextStatus: BugStatus) => {
    try {
      await updateBugMutation.mutateAsync({
        id: bugId,
        input: { status: nextStatus },
      });
      toast.success(`Bug status updated to ${BUG_STATUS_LABELS[nextStatus]}`);
    } catch (err: unknown) {
      console.error(err);
      toast.error((err as { message?: string })?.message || "Failed to update bug status.");
    }
  };

  const handleDeleteBug = async (bugId: string, taskId?: string) => {
    if (!confirm("Are you sure you want to delete this bug?")) return;
    try {
      await deleteBugMutation.mutateAsync({ id: bugId, taskId });
      toast.success("Bug deleted.");
      if (detailBugId === bugId) setDetailBugId(null);
    } catch (err: unknown) {
      console.error(err);
      toast.error((err as { message?: string })?.message || "Failed to delete bug.");
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailBugId || !commentText.trim()) return;
    try {
      await addCommentMutation.mutateAsync({
        id: detailBugId,
        content: commentText.trim(),
      });
      setCommentText("");
      toast.success("Comment added.");
    } catch (err: unknown) {
      console.error(err);
      toast.error((err as { message?: string })?.message || "Failed to add comment.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Employee Scope Notification Banner */}
      {isEmployee && (
        <div className="flex items-center justify-between bg-blue-50/80 border border-blue-200/90 rounded-2xl p-4 text-xs shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
              <User className="size-4" />
            </div>
            <div>
              <span className="font-extrabold text-slate-900 block">
                Developer Scoped View
              </span>
              <span className="text-slate-600 font-medium">
                Showing bugs specifically assigned to you ({currentUser?.firstName}{" "}
                {currentUser?.lastName}).
              </span>
            </div>
          </div>
          <Badge className="bg-blue-600 text-white font-bold px-3 py-1">
            {filteredBugs.length} Assigned
          </Badge>
        </div>
      )}

      {/* Header & Controls Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shadow-2xs">
                <BugIcon className="size-4.5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Bug & Defect Management
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Track, resolve, and validate bugs linked across tasks and projects.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === "table"
                    ? "bg-white text-blue-600 shadow-2xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Table View"
              >
                <List className="size-4" />
              </button>
              <button
                onClick={() => setViewMode("kanban")}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === "kanban"
                    ? "bg-white text-blue-600 shadow-2xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Kanban Board View"
              >
                <LayoutGrid className="size-4" />
              </button>
            </div>

            <Button
              onClick={() => {
                setNewTitle("");
                setNewDescription("");
                setNewTaskId("");
                setNewAssigneeId(isEmployee && currentUser ? currentUser.id : "");
                setIsCreateOpen(true);
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-500/20 gap-1.5"
            >
              <Plus className="size-4" /> Report Bug
            </Button>
          </div>
        </div>

        {/* KPI Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-3 border-t border-slate-100">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-0.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Total Bugs
            </span>
            <span className="text-xl font-extrabold text-slate-900 font-mono">
              {stats.total}
            </span>
          </div>
          <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3 space-y-0.5">
            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
              Open / In Progress
            </span>
            <span className="text-xl font-extrabold text-blue-900 font-mono">
              {stats.openOrActive}
            </span>
          </div>
          <div className="bg-purple-50/80 border border-purple-200/80 rounded-xl p-3 space-y-0.5">
            <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">
              Pending Review
            </span>
            <span className="text-xl font-extrabold text-purple-900 font-mono">
              {stats.pendingReview}
            </span>
          </div>
          <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 space-y-0.5">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
              Rework Required
            </span>
            <span className="text-xl font-extrabold text-amber-900 font-mono">
              {stats.reworkRequired}
            </span>
          </div>
          <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-3 space-y-0.5">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
              Fixed / Closed
            </span>
            <span className="text-xl font-extrabold text-emerald-900 font-mono">
              {stats.fixedOrClosed}
            </span>
          </div>
          <div className="bg-rose-50/80 border border-rose-200/80 rounded-xl p-3 space-y-0.5">
            <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">
              Critical / High
            </span>
            <span className="text-xl font-extrabold text-rose-900 font-mono">
              {stats.criticalOrHigh}
            </span>
          </div>
        </div>

        {/* Quick Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
            <Filter className="size-3" /> Quick Filter:
          </span>
          {[
            { label: "All Bugs", value: "ALL" },
            { label: "Pending Review", value: "PENDING_REVIEW", count: stats.pendingReview },
            { label: "Rework Required", value: "REWORK_REQUIRED", count: stats.reworkRequired },
            { label: "In Progress", value: "IN_PROGRESS" },
            { label: "Open", value: "OPEN" },
            { label: "Fixed", value: "FIXED" },
            { label: "Closed", value: "CLOSED" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                statusFilter === tab.value
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                    statusFilter === tab.value ? "bg-white/20 text-white" : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Filters Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-1">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 size-3.5 text-slate-400" />
            <Input
              placeholder="Search bug #, title, task..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs bg-slate-50/70 border-slate-200 rounded-xl"
            />
          </div>

          <Select value={projectIdFilter} onValueChange={setProjectIdFilter}>
            <SelectTrigger className="text-xs bg-slate-50/70 border-slate-200 rounded-xl">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL_PROJECTS">All Projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="text-xs bg-slate-50/70 border-slate-200 rounded-xl">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              {BUG_STATUSES.map((st) => (
                <SelectItem key={st} value={st}>
                  {BUG_STATUS_LABELS[st]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="text-xs bg-slate-50/70 border-slate-200 rounded-xl">
              <SelectValue placeholder="All Severities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Severities</SelectItem>
              {BUG_SEVERITIES.map((sev) => (
                <SelectItem key={sev} value={sev}>
                  {sev} Severity
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!isEmployee && (
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="text-xs bg-slate-50/70 border-slate-200 rounded-xl">
                <SelectValue placeholder="All Assignees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Developers</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* BUGS CONTENT VIEW (Table vs Kanban) */}
      {bugsLoading ? (
        <div className="py-16 text-center flex flex-col items-center justify-center gap-3">
          <Loader2 className="size-8 text-rose-600 animate-spin" />
          <span className="text-xs font-semibold text-slate-500">Loading bugs...</span>
        </div>
      ) : filteredBugs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-3 shadow-xs">
          <div className="size-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
            <CheckCircle2 className="size-6 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">No Bugs Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {isEmployee
                ? "You currently have no bugs matching this filter assigned to you. Great job!"
                : "No bugs match the specified filter criteria. Click 'Report Bug' to create one."}
            </p>
          </div>
          <Button
            onClick={() => {
              setNewTitle("");
              setNewDescription("");
              setNewTaskId("");
              setNewAssigneeId(isEmployee && currentUser ? currentUser.id : "");
              setIsCreateOpen(true);
            }}
            variant="outline"
            className="text-xs font-bold rounded-xl gap-1.5 mt-2"
          >
            <Plus className="size-4" /> Report New Bug
          </Button>
        </div>
      ) : viewMode === "table" ? (
        /* TABLE VIEW */
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase font-extrabold text-[10px] tracking-wider">
                <tr>
                  <th className="p-3.5">Bug #</th>
                  <th className="p-3.5">Title & Linked Task</th>
                  <th className="p-3.5">Severity / Priority</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Assignee</th>
                  <th className="p-3.5">Reported</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBugs.map((bug) => {
                  const severityStyle =
                    BUG_SEVERITY_COLORS[bug.severity] || "bg-slate-100 text-slate-700";
                  const isAssignee =
                    bug.assigneeId === currentUser?.id ||
                    bug.task?.assigneeId === currentUser?.id ||
                    isManagerOrAdmin;
                  const canSubmitFix =
                    isAssignee &&
                    (bug.status === "IN_PROGRESS" ||
                      bug.status === "ASSIGNED" ||
                      bug.status === "REWORK_REQUIRED");

                  return (
                    <tr
                      key={bug.id}
                      onClick={() => setDetailBugId(bug.id)}
                      className="hover:bg-slate-50/60 transition-colors cursor-pointer group"
                    >
                      <td className="p-3.5 font-mono font-bold text-rose-600 whitespace-nowrap">
                        #BUG-{bug.bugNumber}
                      </td>
                      <td className="p-3.5 max-w-md">
                        <div className="space-y-1">
                          <span className="font-bold text-slate-900 group-hover:text-rose-600 transition-colors block text-xs">
                            {bug.title}
                          </span>
                          {(bug.task || bug.taskId) && (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                const targetId = bug.taskId || bug.task?.id;
                                if (targetId) handleGoToTask(targetId);
                              }}
                              className="inline-flex items-center gap-1.5 text-[11px] text-blue-700 hover:text-blue-800 bg-blue-50/70 border border-blue-200/80 px-2 py-0.5 rounded-lg hover:underline transition-all cursor-pointer"
                            >
                              <CheckSquare className="size-3 text-blue-600" />
                              <span className="font-semibold truncate max-w-[240px]">
                                {bug.task?.title || "View Task"}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-extrabold border ${severityStyle}`}
                          >
                            {bug.severity}
                          </Badge>
                          <span className="text-[10px] text-slate-500 font-semibold">
                            {bug.priority}
                          </span>
                        </div>
                      </td>
                      <td className="p-3.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {bug.status === "PENDING_REVIEW" ? (
                          <Badge className="bg-purple-50 text-purple-700 border border-purple-200 font-bold text-[10px] gap-1 px-2 py-0.5">
                            <Clock className="size-3 text-purple-600" />
                            Pending Manager Review
                          </Badge>
                        ) : bug.status === "REWORK_REQUIRED" ? (
                          <Badge className="bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[10px] gap-1 px-2 py-0.5">
                            <AlertTriangle className="size-3 text-amber-600" />
                            Rework Required
                          </Badge>
                        ) : bug.status === "FIXED" ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px] gap-1 px-2 py-0.5">
                            <CheckCircle2 className="size-3 text-emerald-600" />
                            Fixed
                          </Badge>
                        ) : isManagerOrAdmin ? (
                          <Select
                            value={bug.status}
                            onValueChange={(val) => handleQuickStatusChange(bug.id, val as BugStatus)}
                          >
                            <SelectTrigger className="h-7 text-[11px] font-bold border-slate-200 rounded-lg px-2.5 w-36 bg-slate-50 hover:bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {BUG_STATUSES.map((st) => (
                                <SelectItem key={st} value={st} className="text-xs">
                                  {BUG_STATUS_LABELS[st]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Select
                            value={bug.status}
                            onValueChange={(val) => handleQuickStatusChange(bug.id, val as BugStatus)}
                          >
                            <SelectTrigger className="h-7 text-[11px] font-bold border-slate-200 rounded-lg px-2.5 w-32 bg-slate-50 hover:bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="OPEN" className="text-xs">Open</SelectItem>
                              <SelectItem value="ASSIGNED" className="text-xs">Assigned</SelectItem>
                              <SelectItem value="IN_PROGRESS" className="text-xs">In Progress</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        {bug.assignee ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="size-6 border border-slate-200">
                              <AvatarFallback className="text-[10px] bg-blue-100 text-blue-700 font-bold">
                                {getInitials(bug.assignee)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-semibold text-slate-800 text-[11px]">
                              {bug.assignee.firstName} {bug.assignee.lastName}
                            </span>
                          </div>
                        ) : (
                          <span className="italic text-slate-400 text-[11px]">Unassigned</span>
                        )}
                      </td>
                      <td className="p-3.5 whitespace-nowrap text-slate-500 text-[11px]">
                        {formatRelativeDay(bug.createdAt)}
                      </td>
                      <td
                        className="p-3.5 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          {canSubmitFix && (
                            <Button
                              size="sm"
                              onClick={() => handleOpenSubmitFixDialog(bug)}
                              className="h-7 text-[11px] bg-purple-600 hover:bg-purple-700 text-white font-bold gap-1 px-2.5 rounded-lg shadow-xs"
                            >
                              <Sparkles className="size-3" />
                              Submit Fix
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-slate-500 hover:text-rose-600 rounded-lg"
                            onClick={() => setDetailBugId(bug.id)}
                            title="View Details"
                          >
                            <ChevronRight className="size-4" />
                          </Button>
                          {(isManagerOrAdmin || bug.reporterId === currentUser?.id) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 rounded-lg"
                              onClick={() => handleDeleteBug(bug.id, bug.taskId)}
                              title="Delete Bug"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* KANBAN BOARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
          {(
            [
              { status: "OPEN", label: "Open / Assigned", bg: "bg-slate-50/80" },
              { status: "IN_PROGRESS", label: "In Progress", bg: "bg-blue-50/50" },
              { status: "PENDING_REVIEW", label: "Pending Review", bg: "bg-purple-50/50" },
              { status: "REWORK_REQUIRED", label: "Rework Required", bg: "bg-amber-50/50" },
              { status: "FIXED", label: "Fixed / Closed", bg: "bg-emerald-50/50" },
            ] as const
          ).map((col) => {
            const columnBugs = filteredBugs.filter((b) => {
              if (col.status === "OPEN") return b.status === "OPEN" || b.status === "ASSIGNED";
              if (col.status === "IN_PROGRESS") return b.status === "IN_PROGRESS" || b.status === "REOPENED";
              if (col.status === "PENDING_REVIEW") return b.status === "PENDING_REVIEW";
              if (col.status === "REWORK_REQUIRED") return b.status === "REWORK_REQUIRED";
              return b.status === "FIXED" || b.status === "CLOSED";
            });

            return (
              <div
                key={col.status}
                className={`${col.bg} border border-slate-200/90 rounded-2xl p-3.5 flex flex-col gap-3 min-h-[420px]`}
              >
                <div className="flex items-center justify-between border-b border-slate-200/70 pb-2 px-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`size-2 rounded-full ${
                        col.status === "PENDING_REVIEW"
                          ? "bg-purple-500"
                          : col.status === "REWORK_REQUIRED"
                            ? "bg-amber-500"
                            : col.status === "FIXED"
                              ? "bg-emerald-500"
                              : col.status === "IN_PROGRESS"
                                ? "bg-blue-500"
                                : "bg-slate-400"
                      }`}
                    />
                    <span className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">
                      {col.label}
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-bold">
                    {columnBugs.length}
                  </Badge>
                </div>

                <div className="space-y-2.5 flex-1 overflow-y-auto">
                  {columnBugs.map((bug) => {
                    const isAssignee =
                      bug.assigneeId === currentUser?.id ||
                      bug.task?.assigneeId === currentUser?.id ||
                      isManagerOrAdmin;
                    const canSubmitFix =
                      isAssignee &&
                      (bug.status === "IN_PROGRESS" ||
                        bug.status === "ASSIGNED" ||
                        bug.status === "REWORK_REQUIRED");

                    return (
                      <div
                        key={bug.id}
                        onClick={() => setDetailBugId(bug.id)}
                        className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs hover:shadow-sm hover:border-rose-300 transition-all cursor-pointer space-y-2.5"
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-mono font-bold text-rose-600">
                            #BUG-{bug.bugNumber}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[9px] font-bold ${BUG_SEVERITY_COLORS[bug.severity]}`}
                          >
                            {bug.severity}
                          </Badge>
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 leading-snug line-clamp-2">
                          {bug.title}
                        </h4>

                        {(bug.task || bug.taskId) && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              const targetId = bug.taskId || bug.task?.id;
                              if (targetId) handleGoToTask(targetId);
                            }}
                            className="text-[10px] text-slate-600 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg truncate hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 cursor-pointer transition-colors"
                          >
                            Task: <span className="font-semibold text-slate-800">{bug.task?.title || "View Task"}</span>
                          </div>
                        )}

                        {canSubmitFix && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenSubmitFixDialog(bug);
                            }}
                            className="w-full h-7 text-[10px] bg-purple-600 hover:bg-purple-700 text-white font-bold gap-1 rounded-lg shadow-xs"
                          >
                            <Sparkles className="size-3" /> Submit Fix for Review
                          </Button>
                        )}

                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                          <div className="flex items-center gap-1.5">
                            {bug.assignee ? (
                              <>
                                <Avatar className="size-5">
                                  <AvatarFallback className="text-[9px] bg-blue-100 text-blue-700 font-bold">
                                    {getInitials(bug.assignee)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-slate-700 font-medium truncate max-w-[90px]">
                                  {bug.assignee.firstName}
                                </span>
                              </>
                            ) : (
                              <span className="italic text-slate-400">Unassigned</span>
                            )}
                          </div>
                          <span className="text-slate-400 font-mono">
                            {formatRelativeDay(bug.createdAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* REPORT NEW BUG DIALOG */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-xl bg-white rounded-2xl border-slate-200 shadow-2xl p-6">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-rose-600">
              <BugIcon className="size-5" />
              <DialogTitle className="text-base font-extrabold text-slate-900">
                Report & Log a Bug
              </DialogTitle>
            </div>
          </DialogHeader>

          <form onSubmit={handleCreateBug} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Bug Title <span className="text-rose-600">*</span>
              </Label>
              <Input
                placeholder="e.g. Login button unresponsive on mobile viewport"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="text-xs rounded-xl"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Project</Label>
                <Select
                  value={newProjectId}
                  onValueChange={(val) => {
                    setNewProjectId(val);
                    setNewTaskId("");
                  }}
                >
                  <SelectTrigger className="text-xs rounded-xl">
                    <SelectValue placeholder="Select Project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Associated Task <span className="text-rose-600">*</span>
                </Label>
                <Select value={newTaskId} onValueChange={setNewTaskId} required>
                  <SelectTrigger className="text-xs rounded-xl">
                    <SelectValue placeholder="Select Task" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectTasks.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        #{t.taskNumber} - {t.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Assign To Developer</Label>
                <Select value={newAssigneeId} onValueChange={setNewAssigneeId}>
                  <SelectTrigger className="text-xs rounded-xl">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.firstName} {u.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Severity</Label>
                <Select
                  value={newSeverity}
                  onValueChange={(v) => setNewSeverity(v as BugSeverity)}
                >
                  <SelectTrigger className="text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUG_SEVERITIES.map((sev) => (
                      <SelectItem key={sev} value={sev}>
                        {sev}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Priority</Label>
                <Select
                  value={newPriority}
                  onValueChange={(v) => setNewPriority(v as BugPriority)}
                >
                  <SelectTrigger className="text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUG_PRIORITIES.map((pri) => (
                      <SelectItem key={pri} value={pri}>
                        {pri}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Steps to Reproduce / Description
              </Label>
              <Textarea
                placeholder="1. Navigate to...\n2. Click on...\n3. Observe error behavior..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={4}
                className="text-xs rounded-xl"
              />
            </div>

            <DialogFooter className="border-t border-slate-100 pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
                className="text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createBugMutation.isPending}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-500/20"
              >
                {createBugMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Report Bug"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* BUG DETAIL & COMMENTS & QA REVIEW DIALOG */}
      {detailBugId && detailedBug && (
        <Dialog open={!!detailBugId} onOpenChange={(open) => !open && setDetailBugId(null)}>
          <DialogContent className="max-w-2xl bg-white rounded-2xl border-slate-200 shadow-2xl p-6 max-h-[90vh] flex flex-col">
            <DialogHeader className="border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-rose-600 text-sm">
                    #BUG-{detailedBug.bugNumber}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-bold ${BUG_SEVERITY_COLORS[detailedBug.severity]}`}
                  >
                    {detailedBug.severity}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {detailedBug.status === "PENDING_REVIEW" ? (
                    <Badge className="bg-purple-50 text-purple-700 border border-purple-200 font-bold text-xs gap-1">
                      <Clock className="size-3 text-purple-600" /> Pending Manager Review
                    </Badge>
                  ) : detailedBug.status === "REWORK_REQUIRED" ? (
                    <Badge className="bg-amber-50 text-amber-700 border border-amber-200 font-bold text-xs gap-1">
                      <AlertTriangle className="size-3 text-amber-600" /> Rework Required
                    </Badge>
                  ) : detailedBug.status === "FIXED" ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs gap-1">
                      <CheckCircle2 className="size-3 text-emerald-600" /> Fixed
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="font-bold text-xs">
                      {BUG_STATUS_LABELS[detailedBug.status]}
                    </Badge>
                  )}

                  {(detailedBug.status === "IN_PROGRESS" ||
                    detailedBug.status === "ASSIGNED" ||
                    detailedBug.status === "REWORK_REQUIRED") &&
                    (detailedBug.assigneeId === currentUser?.id ||
                      detailedBug.task?.assigneeId === currentUser?.id ||
                      isManagerOrAdmin) && (
                      <Button
                        size="sm"
                        onClick={() => handleOpenSubmitFixDialog(detailedBug)}
                        className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white font-bold gap-1 rounded-lg shadow-xs ml-2"
                      >
                        <Sparkles className="size-3.5" /> Submit Fix for Review
                      </Button>
                    )}
                </div>
              </div>
              <DialogTitle className="text-base font-extrabold text-slate-900 mt-2 text-left">
                {detailedBug.title}
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-4 py-3 pr-1 text-xs">
              {/* Linked Task & Project Card */}
              {(detailedBug.task || detailedBug.taskId) && (
                <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                      Linked Task
                    </span>
                    <span className="font-bold text-slate-900 text-xs">
                      {detailedBug.task?.title || "View Associated Task"}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] font-bold text-blue-700 border-blue-300 hover:bg-blue-100 rounded-lg cursor-pointer"
                    onClick={() => {
                      const targetId = detailedBug.taskId || detailedBug.task?.id;
                      if (targetId) {
                        handleGoToTask(targetId);
                      }
                    }}
                  >
                    Open Task <ExternalLink className="size-3 ml-1" />
                  </Button>
                </div>
              )}

              {/* Description */}
              {detailedBug.description && (
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Description & Steps to Reproduce
                  </Label>
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-slate-800 whitespace-pre-wrap leading-relaxed font-mono text-[11px]">
                    {detailedBug.description}
                  </div>
                </div>
              )}

              {/* DEVELOPER FIX SUBMISSION DETAILS (When fix submitted) */}
              {(detailedBug.fixSummary || detailedBug.fixSubmittedAt) && (
                <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-purple-200/70 pb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-purple-600" />
                      <span className="text-xs font-bold text-purple-900 uppercase tracking-wide">
                        Developer Fix Submission Details
                      </span>
                    </div>
                    <div className="text-[11px] text-purple-700">
                      Submitted By:{" "}
                      <span className="font-bold text-purple-900">
                        {detailedBug.fixSubmittedBy
                          ? `${detailedBug.fixSubmittedBy.firstName} ${detailedBug.fixSubmittedBy.lastName}`
                          : detailedBug.assignee
                            ? `${detailedBug.assignee.firstName} ${detailedBug.assignee.lastName}`
                            : "Developer"}
                      </span>{" "}
                      {detailedBug.fixSubmittedAt && (
                        <span className="text-purple-600 ml-1 font-mono">
                          • {new Date(detailedBug.fixSubmittedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">
                        Fix Summary:
                      </span>
                      <p className="font-bold text-slate-900 text-sm mt-0.5">
                        {detailedBug.fixSummary}
                      </p>
                    </div>

                    {detailedBug.rootCause && (
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">
                          Root Cause Analysis:
                        </span>
                        <p className="text-slate-800 mt-0.5">{detailedBug.rootCause}</p>
                      </div>
                    )}

                    {detailedBug.testingNotes && (
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">
                          Testing & Verification Notes:
                        </span>
                        <p className="text-slate-800 mt-0.5">{detailedBug.testingNotes}</p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-4 pt-1">
                      {detailedBug.prLink && (
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-bold">
                            Pull Request / Commit:
                          </span>
                          <a
                            href={
                              detailedBug.prLink.startsWith("http")
                                ? detailedBug.prLink
                                : `https://${detailedBug.prLink}`
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline font-mono inline-flex items-center gap-1 mt-0.5 font-bold"
                          >
                            <FileCode className="size-3.5" />
                            {detailedBug.prLink}
                            <ExternalLink className="size-3" />
                          </a>
                        </div>
                      )}

                      {detailedBug.fixAttachmentUrl && (
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-bold">
                            Fix Screenshot / Attachment:
                          </span>
                          <a
                            href={detailedBug.fixAttachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline inline-flex items-center gap-1 mt-0.5 font-bold"
                          >
                            View Attachment
                            <ExternalLink className="size-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* MANAGER QA REVIEW & DECISION PANEL */}
              {isManagerOrAdmin && detailedBug.status === "PENDING_REVIEW" && (
                <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-4 space-y-3">
                  <div className="flex items-center gap-2 border-b border-amber-200 pb-2">
                    <ShieldCheck className="size-4 text-amber-700" />
                    <span className="text-xs font-extrabold text-amber-900 uppercase tracking-wide">
                      Manager Review & QA Approval
                    </span>
                  </div>

                  <p className="text-xs text-amber-800">
                    The developer has submitted this fix for review. Please inspect the changes and make your approval decision below:
                  </p>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">
                      Manager Feedback / Review Comments (Optional)
                    </Label>
                    <Textarea
                      placeholder="Add approval notes, test feedback, or reasons for rework..."
                      value={managerReviewComments}
                      onChange={(e) => setManagerReviewComments(e.target.value)}
                      rows={2}
                      className="text-xs bg-white rounded-xl"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      disabled={reviewBugFixMutation.isPending}
                      onClick={() => handleReviewFix(detailedBug.id, "APPROVE")}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 font-bold rounded-xl shadow-xs"
                    >
                      <CheckCircle2 className="size-3.5" />
                      Approve Fix (Mark as Fixed)
                    </Button>
                    <Button
                      size="sm"
                      disabled={reviewBugFixMutation.isPending}
                      onClick={() => handleReviewFix(detailedBug.id, "REQUEST_CHANGES")}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1.5 font-bold rounded-xl shadow-xs"
                    >
                      <AlertTriangle className="size-3.5" />
                      Request Rework
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={reviewBugFixMutation.isPending}
                      onClick={() => handleReviewFix(detailedBug.id, "REJECT")}
                      className="text-xs gap-1.5 font-bold rounded-xl shadow-xs"
                    >
                      <XCircle className="size-3.5" />
                      Reject Fix (Return to In Progress)
                    </Button>
                  </div>
                </div>
              )}

              {/* PREVIOUS MANAGER REVIEW COMMENTS */}
              {detailedBug.managerComments && detailedBug.status !== "PENDING_REVIEW" && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1">
                      <ShieldAlert className="size-3.5" /> Manager Review Feedback:
                    </span>
                    {detailedBug.reviewedAt && (
                      <span className="font-mono text-slate-400">
                        {new Date(detailedBug.reviewedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-800 font-medium">{detailedBug.managerComments}</p>
                </div>
              )}

              {/* ACTIVITY AUDIT TRAIL */}
              {detailedBug.activityLogs && detailedBug.activityLogs.length > 0 && (
                <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-2.5">
                  <h5 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <History className="size-3.5 text-blue-600" />
                    Bug Activity Audit Trail
                  </h5>
                  <div className="space-y-2 text-xs">
                    {detailedBug.activityLogs.map((act) => (
                      <div
                        key={act.id}
                        className="flex items-start justify-between border-l-2 border-blue-400 pl-2.5 py-0.5 text-slate-800"
                      >
                        <div>
                          <span className="font-bold text-slate-900">{act.action}</span>
                          {act.details && (
                            <p className="text-slate-500 text-[11px] mt-0.5">{act.details}</p>
                          )}
                        </div>
                        <div className="text-right text-[10px] text-slate-400 shrink-0 font-mono ml-3">
                          <span>
                            {act.user ? `${act.user.firstName} ${act.user.lastName}` : "User"}
                          </span>
                          <span className="block">
                            {new Date(act.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/70 border border-slate-200/80 rounded-xl p-3">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block">Priority</span>
                  <span className="font-bold text-slate-800">{detailedBug.priority}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block">Reporter</span>
                  <span className="font-bold text-slate-800">
                    {detailedBug.reporter?.firstName} {detailedBug.reporter?.lastName}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block">Assignee</span>
                  <span className="font-bold text-slate-800">
                    {detailedBug.assignee
                      ? `${detailedBug.assignee.firstName} ${detailedBug.assignee.lastName}`
                      : "Unassigned"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block">Created</span>
                  <span className="font-bold text-slate-800">
                    {formatRelativeDay(detailedBug.createdAt)}
                  </span>
                </div>
              </div>

              {/* Quick Status Action Controls for Managers */}
              {isManagerOrAdmin && (
                <div className="space-y-1.5 pt-1">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Quick Status Actions (Manager Override)
                  </Label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {BUG_STATUSES.filter((st) => st !== detailedBug.status).map((st) => (
                      <Button
                        key={st}
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] font-bold rounded-lg border-slate-200 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700"
                        onClick={() => handleQuickStatusChange(detailedBug.id, st)}
                      >
                        → {BUG_STATUS_LABELS[st]}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments Section */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <MessageSquare className="size-4 text-slate-500" />
                  <span className="font-bold text-slate-900 text-xs">
                    Comments & Discussion ({detailedBug.comments?.length ?? 0})
                  </span>
                </div>

                <div className="space-y-2.5 max-h-48 overflow-y-auto">
                  {detailedBug.comments && detailedBug.comments.length > 0 ? (
                    detailedBug.comments.map((cmt) => (
                      <div
                        key={cmt.id}
                        className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-1"
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-slate-800">
                            {cmt.user.firstName} {cmt.user.lastName}
                          </span>
                          <span className="text-slate-400 font-mono">
                            {formatRelativeDay(cmt.createdAt)}
                          </span>
                        </div>
                        <p className="text-slate-700 text-xs leading-relaxed">{cmt.content}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400 italic text-[11px]">No comments posted yet.</p>
                  )}
                </div>

                <form onSubmit={handleAddComment} className="flex gap-2 pt-1">
                  <Input
                    placeholder="Write a comment or resolution note..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="text-xs rounded-xl"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={addCommentMutation.isPending || !commentText.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl px-4 shrink-0"
                  >
                    {addCommentMutation.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Send className="size-3.5" />
                    )}
                  </Button>
                </form>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* SUBMIT FIX FOR MANAGER REVIEW DIALOG */}
      <Dialog
        open={!!fixSubmittingBug}
        onOpenChange={(open) => !open && setFixSubmittingBug(null)}
      >
        <DialogContent className="max-w-lg bg-white rounded-2xl border-slate-200 shadow-2xl p-6">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-purple-600">
              <Sparkles className="size-5" />
              <DialogTitle className="text-base font-extrabold text-slate-900">
                Submit Fix for Manager Review
              </DialogTitle>
            </div>
          </DialogHeader>

          {fixSubmittingBug && (
            <form onSubmit={handleSubmitFix} className="space-y-4 pt-2 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
                <span className="font-mono text-rose-600 font-bold block text-xs">
                  #BUG-{fixSubmittingBug.bugNumber}
                </span>
                <p className="font-bold text-slate-900 text-xs">{fixSubmittingBug.title}</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Fix Summary <span className="text-rose-600">*</span>
                </Label>
                <Input
                  placeholder="Describe what changes you made to resolve this bug..."
                  value={fixSummary}
                  onChange={(e) => setFixSummary(e.target.value)}
                  className="text-xs rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Root Cause Analysis (Optional)
                </Label>
                <Textarea
                  placeholder="What caused the bug originally? (e.g. null pointer check missing)"
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  rows={2}
                  className="text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Testing & Verification Notes (Optional)
                </Label>
                <Textarea
                  placeholder="Steps you took to test the fix locally..."
                  value={testingNotes}
                  onChange={(e) => setTestingNotes(e.target.value)}
                  rows={2}
                  className="text-xs rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">
                    Related Commit ID / PR Link
                  </Label>
                  <Input
                    placeholder="https://github.com/.../pull/123 or commit hash"
                    value={prLink}
                    onChange={(e) => setPrLink(e.target.value)}
                    className="text-xs rounded-xl font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">
                    Attachment / Screenshot URL
                  </Label>
                  <Input
                    placeholder="https://..."
                    value={fixAttachmentUrl}
                    onChange={(e) => setFixAttachmentUrl(e.target.value)}
                    className="text-xs rounded-xl"
                  />
                </div>
              </div>

              <DialogFooter className="border-t border-slate-100 pt-3 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFixSubmittingBug(null)}
                  className="text-xs rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitBugFixMutation.isPending}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md shadow-purple-500/20"
                >
                  {submitBugFixMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Submit Fix for Review"
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
