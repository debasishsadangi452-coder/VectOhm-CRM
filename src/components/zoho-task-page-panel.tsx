import { useState, useMemo, useEffect } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  Bug as BugIcon,
  Calendar as CalendarIcon,
  CalendarDays,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock,
  ExternalLink,
  FileCode,
  FileText,
  History,
  ListTodo,
  MessageSquare,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  User,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { TaskCommunicationModal } from "@/components/task-communication-modal";
import { TaskRequestUpdateDialog } from "@/components/task-request-update-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { useAuthStore } from "@/stores/auth-store";
import { useTask, useUpdateTask, useCreateTask, useDeleteTask } from "@/hooks/use-tasks";
import {
  useBugs,
  useCreateBug,
  useUpdateBug,
  useAddBugComment,
  useSubmitBugFix,
  useReviewBugFix,
} from "@/hooks/use-bugs";
import { useCreateTaskUpdate } from "@/hooks/use-task-updates";
import { useCreateTimeLog, useReviewTimeLog } from "@/hooks/use-time-logs";
import { useUsers } from "@/hooks/use-users";
import { useNow } from "@/hooks/use-now";
import { TaskDeadlineBadge } from "@/components/task-deadline-badge";
import {
  BUG_PRIORITIES,
  BUG_SEVERITIES,
  BUG_SEVERITY_COLORS,
  BUG_STATUS_LABELS,
  BUG_STATUSES,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  type Bug,
  type BugPriority,
  type BugSeverity,
  type BugStatus,
  type ProjectTaskDetail,
  type TaskStatus,
} from "@/lib/api/types";
import { toast } from "sonner";

export interface DeliverableItem {
  text: string;
  completed: boolean;
}

const DELIVERABLE_TEMPLATES: Record<string, { label: string; items: string[] }> = {
  recruitment: {
    label: "Recruitment & Sourcing",
    items: [
      "Screen candidate profiles against job specifications",
      "Conduct technical evaluation & background screening",
      "Submit candidate shortlist with executive notes",
      "Coordinate hiring manager client interview",
    ],
  },
  dev: {
    label: "Engineering & Tech",
    items: [
      "Review technical requirements and specifications",
      "Implement core logic and write unit tests",
      "Create pull request with descriptive test cases",
      "Pass QA verification and merge to staging",
    ],
  },
  sales: {
    label: "Sales & Commercial",
    items: [
      "Identify buyer pain points, budget, and decision timeframe",
      "Deliver tailored product capability demonstration",
      "Submit commercial proposal and scope schedule",
      "Secure executive verbal agreement and send contract",
    ],
  },
  ops: {
    label: "Operations & Process",
    items: [
      "Assess operational scope and dependencies",
      "Draft standard operating procedure (SOP)",
      "Test execution in staging sandbox environment",
      "Deploy workflow live and update training guide",
    ],
  },
};

interface ZohoTaskPagePanelProps {
  taskId: string;
  onClose?: () => void;
  initialOpenCommunication?: boolean;
  initialTab?: "overview" | "timelogs" | "activity" | "review";
}

function parseTimeToMinutes(timeStr: string, isEndContext: boolean = false, startMinutes?: number): number | null {
  if (!timeStr || !timeStr.trim()) return null;
  const clean = timeStr.trim().toUpperCase();

  // Match 12-hour format with AM/PM: e.g. "10:00 AM", "10:00AM", "10 AM", "10AM", "10.30 AM", "5 PM", "05:00 PM"
  const match12 = clean.match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(AM|PM)$/);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = match12[2] ? parseInt(match12[2], 10) : 0;
    const meridian = match12[3];

    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;
    if (meridian === "AM") {
      if (hours === 12) hours = 0;
    } else {
      if (hours !== 12) hours += 12;
    }
    return hours * 60 + minutes;
  }

  // Match 24-hour format: e.g. "14:30" or "09:00" or "17:00" or "05:00"
  const match24 = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    let hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    // If entered as "5:00" in end context when start is e.g. 10:00 AM (600 mins):
    if (isEndContext && startMinutes !== undefined && hours >= 1 && hours <= 11) {
      if (hours * 60 + minutes < startMinutes) {
        hours += 12;
      }
    }
    return hours * 60 + minutes;
  }

  // Match standalone numbers: e.g. "5", "10"
  const matchSingle = clean.match(/^(\d{1,2})\s*(AM|PM)?$/);
  if (matchSingle) {
    let hours = parseInt(matchSingle[1], 10);
    const meridian = matchSingle[2];
    if (meridian === "AM") {
      if (hours === 12) hours = 0;
      return hours * 60;
    } else if (meridian === "PM") {
      if (hours !== 12) hours += 12;
      return hours * 60;
    } else if (hours >= 0 && hours <= 23) {
      if (isEndContext && startMinutes !== undefined && hours >= 1 && hours <= 11) {
        if (hours * 60 < startMinutes) {
          hours += 12;
        }
      }
      return hours * 60;
    }
  }

  return null;
}

function calculateDiffHours(startStr: string, endStr: string): string | null {
  const startMin = parseTimeToMinutes(startStr);
  if (startMin === null) return null;
  const endMin = parseTimeToMinutes(endStr, true, startMin);
  if (endMin === null) return null;

  let diff = endMin - startMin;
  if (diff < 0) {
    diff += 24 * 60; // handle overnight shifts
  }
  return (diff / 60).toFixed(1);
}

export function ZohoTaskPagePanel({
  taskId,
  onClose,
  initialOpenCommunication,
  initialTab,
}: ZohoTaskPagePanelProps) {
  const currentUser = useAuthStore((s) => s.user);
  const { data: task, isLoading, error } = useTask(taskId);
  const { data: bugsList = [] } = useBugs({ taskId });
  const { data: allUsers = [] } = useUsers();
  const now = useNow();

  const updateTask = useUpdateTask();
  const createTask = useCreateTask();
  const createBug = useCreateBug();
  const updateBug = useUpdateBug();
  const addBugComment = useAddBugComment();
  const createTaskUpdate = useCreateTaskUpdate();
  const createTimeLog = useCreateTimeLog();
  const reviewTimeLog = useReviewTimeLog();
  const deleteTask = useDeleteTask();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingTask, setIsDeletingTask] = useState(false);

  const handleUpdateTimeLogStatus = async (
    logId: string,
    newStatus: "APPROVED" | "REJECTED",
    reviewNote?: string,
  ) => {
    try {
      await reviewTimeLog.mutateAsync({
        id: logId,
        input: { status: newStatus, reviewNote },
      });
      toast.success(`Time log marked as ${newStatus}`);
    } catch (err) {
      toast.error(
        err instanceof Error && err.message ? err.message : "Failed to update time log status",
      );
    }
  };

  const [activeTab, setActiveTab] = useState<
    "overview" | "updates" | "timelogs" | "activity" | "review"
  >(initialTab || "overview");

  // Task Communication & Update Request Modals
  const [showCommModal, setShowCommModal] = useState(initialOpenCommunication ?? false);
  const [showReqUpdateModal, setShowReqUpdateModal] = useState(false);

  useEffect(() => {
    if (initialOpenCommunication) {
      setShowCommModal(true);
    }
  }, [initialOpenCommunication]);

  // Form states
  const [showSubtaskForm, setShowSubtaskForm] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [subtaskAssigneeId, setSubtaskAssigneeId] = useState("");

  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [showTimeLogForm, setShowTimeLogForm] = useState(false);
  const [showWorkEntryForm, setShowWorkEntryForm] = useState(false);
  const [includeTimeLogging, setIncludeTimeLogging] = useState(true);
  const [workEntriesFilter, setWorkEntriesFilter] = useState<"all" | "updates" | "timelogs">("all");

  const [workCompleted, setWorkCompleted] = useState("");
  const [nextPlan, setNextPlan] = useState("");
  const [blockers, setBlockers] = useState("");
  const [notes, setNotes] = useState("");

  const [startTime, setStartTime] = useState("10:00 AM");
  const [endTime, setEndTime] = useState("01:00 PM");
  const [logHours, setLogHours] = useState("3.0");
  const [timeLogSummary, setTimeLogSummary] = useState("");

  // Auto-calculate Total Hours whenever Start Time or End Time changes
  useEffect(() => {
    const autoHours = calculateDiffHours(startTime, endTime);
    if (autoHours !== null && parseFloat(autoHours) >= 0) {
      setLogHours(autoHours);
    }
  }, [startTime, endTime]);

  const [showBugForm, setShowBugForm] = useState(false);
  const [bugTitle, setBugTitle] = useState("");
  const [bugDescription, setBugDescription] = useState("");
  const [bugSeverity, setBugSeverity] = useState<BugSeverity>("MEDIUM");
  const [bugPriority, setBugPriority] = useState<BugPriority>("MEDIUM");
  const [bugAssigneeId, setBugAssigneeId] = useState("");
  const [bugSubtaskId, setBugSubtaskId] = useState("");

  // Calendar Date Selection & Filter states
  const [updateDate, setUpdateDate] = useState<Date>(new Date());
  const [selectedUpdateDateFilter, setSelectedUpdateDateFilter] = useState<Date | undefined>(
    undefined,
  );

  const [logDate, setLogDate] = useState<Date>(new Date());
  const [selectedLogDateFilter, setSelectedLogDateFilter] = useState<Date | undefined>(undefined);

  const [selectedBugId, setSelectedBugId] = useState<string | null>(null);
  const [bugCommentText, setBugCommentText] = useState("");

  // Fix Submission & Review States
  const submitBugFixMutation = useSubmitBugFix();
  const reviewBugFixMutation = useReviewBugFix();
  const [fixSubmittingBug, setFixSubmittingBug] = useState<Bug | null>(null);
  const [fixSummary, setFixSummary] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [testingNotes, setTestingNotes] = useState("");
  const [prLink, setPrLink] = useState("");
  const [fixAttachmentUrl, setFixAttachmentUrl] = useState("");
  const [managerReviewComments, setManagerReviewComments] = useState("");

  const handleOpenSubmitFixDialog = (b: Bug) => {
    setFixSubmittingBug(b);
    setFixSummary(b.fixSummary || "");
    setRootCause(b.rootCause || "");
    setTestingNotes(b.testingNotes || "");
    setPrLink(b.prLink || "");
    setFixAttachmentUrl(b.fixAttachmentUrl || "");
  };

  const handleSubmitFix = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fixSubmittingBug) return;
    if (!fixSummary.trim()) {
      toast.error("Please provide a summary of the fix.");
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
    } catch (err) {
      toast.error(
        err instanceof Error && err.message ? err.message : "Failed to submit fix for review",
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
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Failed to review bug fix");
    }
  };

  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDescValue, setEditDescValue] = useState("");

  // Deliverables Interactive State
  const [isAddingDeliverable, setIsAddingDeliverable] = useState(false);
  const [newDeliverableInput, setNewDeliverableInput] = useState("");
  const [editingDeliverableIdx, setEditingDeliverableIdx] = useState<number | null>(null);
  const [editingDeliverableText, setEditingDeliverableText] = useState("");

  const rawTask = task as unknown as ProjectTaskDetail | undefined;

  const { cleanDescription, criteriaItems } = useMemo(() => {
    const raw = (rawTask?.description || "").trim();
    if (!raw) return { cleanDescription: "", criteriaItems: [] as DeliverableItem[] };

    // Match any checklist headers or bullets
    const headerRegex =
      /(?:#{1,4}\s*(?:Action Items(?:\s+Checklist)?|Acceptance Criteria|Key Deliverables(?:\s*&\s*Action Items)?|Key Objectives|Deliverables(?:\s+Checklist)?):?|\*{1,2}(?:Action Items(?:\s*&\s*Deliverables)?(?:\s+Checklist)?|Acceptance Criteria|Key Deliverables(?:\s*&\s*Action Items)?|Key Objectives|Deliverables(?:\s+Checklist)?):?\*{1,2})/i;

    let narrative = "";
    let itemsRaw = "";

    if (headerRegex.test(raw)) {
      const parts = raw.split(headerRegex);
      narrative = (parts[0] || "").trim();
      itemsRaw = (parts[1] || "").trim();
    } else {
      const lines = raw.split("\n");
      const checklistLines: string[] = [];
      const narrativeLines: string[] = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (/^[•\-\*]\s*\[[ xX]?\]\s*/.test(trimmed) || /^[•\-\*]\s+/.test(trimmed)) {
          checklistLines.push(trimmed);
        } else {
          narrativeLines.push(line);
        }
      }
      if (checklistLines.length > 0) {
        narrative = narrativeLines.join("\n").trim();
        itemsRaw = checklistLines.join("\n");
      } else {
        narrative = raw;
      }
    }

    const isHeaderLine = (str: string) => {
      const clean = str.replace(/^[#*•\-\s:]+/, "").replace(/[:\s]+$/, "").trim().toLowerCase();
      return (
        clean === "checklist" ||
        clean === "action items" ||
        clean === "action items checklist" ||
        clean === "key deliverables" ||
        clean === "key deliverables & action items" ||
        clean === "deliverables" ||
        clean === "deliverables checklist" ||
        clean === "acceptance criteria"
      );
    };

    const parsedItems: DeliverableItem[] = [];
    if (itemsRaw) {
      const rawLines = itemsRaw.split("\n");
      for (const line of rawLines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (isHeaderLine(trimmed)) continue;

        // Check for checkbox markdown: - [x] or - [ ] or • [x]
        const checkMatch = trimmed.match(/^[•\-\*]\s*\[([ xX])\]\s*(.*)$/);
        if (checkMatch) {
          const isDone = checkMatch[1].toLowerCase() === "x";
          const text = checkMatch[2].trim();
          if (text && !isHeaderLine(text)) {
            parsedItems.push({ text, completed: isDone });
          }
          continue;
        }

        // Bullet without checkbox: - text or • text
        const bulletMatch = trimmed.match(/^[•\-\*]\s*(.*)$/);
        if (bulletMatch) {
          const text = bulletMatch[1].trim();
          if (text && !isHeaderLine(text)) {
            parsedItems.push({ text, completed: false });
          }
          continue;
        }

        // Plain line
        if (!isHeaderLine(trimmed)) {
          parsedItems.push({ text: trimmed, completed: false });
        }
      }
    }

    return { cleanDescription: narrative, criteriaItems: parsedItems };
  }, [rawTask?.description]);

  const saveDeliverablesToDescription = async (
    narrative: string,
    items: DeliverableItem[]
  ) => {
    try {
      let finalDescription = narrative.trim();
      if (items.length > 0) {
        const criteriaBlock = `\n\n**Key Deliverables & Action Items:**\n${items
          .map((c) => `• [${c.completed ? "x" : " "}] ${c.text}`)
          .join("\n")}`;
        finalDescription = finalDescription ? `${finalDescription}${criteriaBlock}` : criteriaBlock.trim();
      }
      await updateTask.mutateAsync({
        id: taskId,
        input: { description: finalDescription || null },
      });
      toast.success("Deliverables updated successfully!");
    } catch (err: unknown) {
      toast.error((err as { message?: string })?.message || "Failed to update deliverables");
    }
  };

  const handleToggleDeliverable = async (index: number) => {
    const updated = criteriaItems.map((item, idx) =>
      idx === index ? { ...item, completed: !item.completed } : item
    );
    await saveDeliverablesToDescription(cleanDescription, updated);
  };

  const handleAddDeliverable = async () => {
    if (!newDeliverableInput.trim()) return;
    const updated = [...criteriaItems, { text: newDeliverableInput.trim(), completed: false }];
    setNewDeliverableInput("");
    setIsAddingDeliverable(false);
    await saveDeliverablesToDescription(cleanDescription, updated);
  };

  const handleSaveEditDeliverable = async (index: number) => {
    if (!editingDeliverableText.trim()) return;
    const updated = criteriaItems.map((item, idx) =>
      idx === index ? { ...item, text: editingDeliverableText.trim() } : item
    );
    setEditingDeliverableIdx(null);
    setEditingDeliverableText("");
    await saveDeliverablesToDescription(cleanDescription, updated);
  };

  const handleRemoveDeliverable = async (index: number) => {
    const updated = criteriaItems.filter((_, idx) => idx !== index);
    await saveDeliverablesToDescription(cleanDescription, updated);
  };

  const handleApplyTemplate = async (templateKey: string) => {
    if (templateKey === "clear") {
      await saveDeliverablesToDescription(cleanDescription, []);
      return;
    }
    const templateItems = (DELIVERABLE_TEMPLATES[templateKey]?.items || []).map((text) => ({
      text,
      completed: false,
    }));
    await saveDeliverablesToDescription(cleanDescription, templateItems);
  };

  const allTimeLogs = useMemo(() => {
    const parentLogs = rawTask?.timeLogs ?? [];
    const subtaskLogs = (rawTask?.subtasks ?? []).flatMap((st) => (st as any).timeLogs ?? []);
    return [...parentLogs, ...subtaskLogs].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [rawTask?.timeLogs, rawTask?.subtasks]);

  const allUpdates = useMemo(() => {
    const parentUpdates = rawTask?.updates ?? [];
    const subtaskUpdates = (rawTask?.subtasks ?? []).flatMap((st) => (st as any).updates ?? []);
    return [...parentUpdates, ...subtaskUpdates].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [rawTask?.updates, rawTask?.subtasks]);

  const isTester = currentUser?.id === rawTask?.testerId;
  const isManagerOrAdmin =
    currentUser?.role?.name === "ADMIN" || currentUser?.role?.name === "MANAGER";

  // Calculate totals
  const totalLoggedMinutes =
    (rawTask?.timeLogs ?? []).reduce((acc, l) => acc + l.minutes, 0) +
    (rawTask?.subtasks ?? []).reduce(
      (acc, st) => acc + (st.timeLogs ?? []).reduce((stAcc, l) => stAcc + l.minutes, 0),
      0,
    );

  const allTaskBugs = [
    ...(rawTask?.bugs ?? []),
    ...(rawTask?.subtasks ?? []).flatMap((st) => st.bugs ?? []),
  ];

  const openBugsCount = allTaskBugs.filter(
    (b) => b.status !== "CLOSED" && b.status !== "FIXED",
  ).length;
  const closedBugsCount = allTaskBugs.filter(
    (b) => b.status === "CLOSED" || b.status === "FIXED",
  ).length;

  // Validation Checks for Tester / Admin Completion
  const hasDailyUpdates =
    (rawTask?.updates?.length ?? 0) > 0 ||
    (rawTask?.subtasks ?? []).some((st) => (st.updates?.length ?? 0) > 0);
  const hasTimeLogs = totalLoggedMinutes > 0;
  const allBugsClosed = openBugsCount === 0;
  const allSubtasksDone =
    !rawTask?.subtasks ||
    rawTask.subtasks.length === 0 ||
    rawTask.subtasks.every((st) => st.status === "DONE");
  const isReadyForTesting = rawTask?.status === "READY_FOR_TESTING";

  const canCompleteTask =
    hasDailyUpdates &&
    hasTimeLogs &&
    allBugsClosed &&
    allSubtasksDone &&
    (isReadyForTesting || rawTask?.status === "DONE");
  // Only the designated Tester (or a Manager/Admin override) may trigger completion —
  // must mirror the server-side guard in tasks.service.ts validateStatusTransition.
  const canApproveCompletion = isTester || isManagerOrAdmin;

  // Time logs categorization for Review
  const pendingTimeLogs = useMemo(
    () => allTimeLogs.filter((l) => l.status === "PENDING" || !l.status),
    [allTimeLogs],
  );
  const approvedTimeLogs = useMemo(
    () => allTimeLogs.filter((l) => l.status === "APPROVED"),
    [allTimeLogs],
  );
  const rejectedTimeLogs = useMemo(
    () => allTimeLogs.filter((l) => l.status === "REJECTED"),
    [allTimeLogs],
  );

  // Deliverables stats
  const completedDeliverablesCount = criteriaItems.filter((c) => c.completed).length;
  const totalDeliverablesCount = criteriaItems.length;
  const allDeliverablesCompleted =
    totalDeliverablesCount > 0 && completedDeliverablesCount === totalDeliverablesCount;

  // Quality Gates Readiness Status
  const criteriaStatus = useMemo(() => {
    return [
      {
        id: "updates",
        label: "Daily Work Updates",
        description: "At least 1 work progress log submitted by assignee",
        met: hasDailyUpdates,
        countText: `${rawTask?.updates?.length ?? 0} logged`,
        badge: hasDailyUpdates ? "Passed" : "Missing Log",
      },
      {
        id: "timelogs",
        label: "Logged Time Accountability",
        description: "At least 1 time log submitted & reviewed",
        met: hasTimeLogs,
        countText: `${(totalLoggedMinutes / 60).toFixed(1)} hrs (${pendingTimeLogs.length} pending)`,
        badge: hasTimeLogs
          ? pendingTimeLogs.length === 0
            ? "All Approved"
            : `${pendingTimeLogs.length} Awaiting Review`
          : "Missing Time",
      },
      {
        id: "bugs",
        label: "Defect & Issue Clearance",
        description: "Zero open bugs or blockers",
        met: allBugsClosed,
        countText: openBugsCount === 0 ? "0 Open Defects" : `${openBugsCount} Unresolved Defects`,
        badge: allBugsClosed ? "Passed" : `${openBugsCount} Open`,
      },
      {
        id: "subtasks",
        label: "Subtask Completion",
        description: "All subtasks marked Completed",
        met: allSubtasksDone,
        countText:
          !rawTask?.subtasks || rawTask.subtasks.length === 0
            ? "No subtasks"
            : `${rawTask.subtasks.filter((st) => st.status === "DONE").length}/${rawTask.subtasks.length} Completed`,
        badge: allSubtasksDone ? "Passed" : "Incomplete",
      },
      {
        id: "deliverables",
        label: "Deliverables & Scope Verification",
        description: "All action items verified",
        met: totalDeliverablesCount === 0 || allDeliverablesCompleted,
        countText:
          totalDeliverablesCount === 0
            ? "No checklist specified"
            : `${completedDeliverablesCount}/${totalDeliverablesCount} Verified`,
        badge:
          totalDeliverablesCount === 0
            ? "N/A"
            : allDeliverablesCompleted
            ? "100% Verified"
            : "Incomplete",
      },
    ];
  }, [
    hasDailyUpdates,
    rawTask?.updates?.length,
    hasTimeLogs,
    totalLoggedMinutes,
    pendingTimeLogs.length,
    allBugsClosed,
    openBugsCount,
    allSubtasksDone,
    rawTask?.subtasks,
    totalDeliverablesCount,
    allDeliverablesCompleted,
    completedDeliverablesCount,
  ]);

  const metCriteriaCount = criteriaStatus.filter((c) => c.met).length;
  const totalCriteriaCount = criteriaStatus.length;
  const readinessPercentage = Math.round((metCriteriaCount / totalCriteriaCount) * 100);

  // Review states
  const [taskReviewNotes, setTaskReviewNotes] = useState(rawTask?.testingNotes || "");
  const [isBatchApprovingTimeLogs, setIsBatchApprovingTimeLogs] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [showChangeRequestDialog, setShowChangeRequestDialog] = useState(false);
  const [changeRequestReason, setChangeRequestReason] = useState("");
  const [showAdminOverrideConfirm, setShowAdminOverrideConfirm] = useState(false);
  const [overrideBlockers, setOverrideBlockers] = useState<string[]>([]);

  // Sync testingNotes when task changes
  useEffect(() => {
    if (rawTask?.testingNotes && !taskReviewNotes) {
      setTaskReviewNotes(rawTask.testingNotes);
    }
  }, [rawTask?.testingNotes]);

  // Tab Auto-Selection: if initialTab provided, use it; otherwise auto-open review if task awaits review for admin
  const [hasAutoSwitchedTab, setHasAutoSwitchedTab] = useState(false);
  useEffect(() => {
    if (!hasAutoSwitchedTab && rawTask) {
      if (initialTab) {
        setActiveTab(initialTab);
        setHasAutoSwitchedTab(true);
      } else if (
        (rawTask.status === "READY_FOR_TESTING" || rawTask.status === "IN_REVIEW") &&
        isManagerOrAdmin
      ) {
        setActiveTab("review");
        setHasAutoSwitchedTab(true);
      }
    }
  }, [initialTab, rawTask, hasAutoSwitchedTab, isManagerOrAdmin]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-12 text-text-dim">
        Loading Task Panel...
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-destructive space-y-3">
        <AlertCircle className="size-8 text-destructive" />
        <p className="font-semibold text-sm">Failed to load task details.</p>
        {onClose && (
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            <ArrowLeft className="size-3.5 mr-1" /> Back to Tasks
          </Button>
        )}
      </div>
    );
  }

  const detailedTask = task as unknown as ProjectTaskDetail;
  const isMultipleAssignees =
    (detailedTask.assignees && detailedTask.assignees.length > 1) ||
    (detailedTask.assigneeId && detailedTask.assignees && detailedTask.assignees.length > 1);

  // Handlers
  const handleStatusChange = async (newStatus: TaskStatus) => {
    try {
      await updateTask.mutateAsync({ id: taskId, input: { status: newStatus } });
      toast.success(`Task status updated to ${TASK_STATUS_LABELS[newStatus]}`);
    } catch (err) {
      toast.error(
        err instanceof Error && err.message ? err.message : "Failed to update task status",
      );
    }
  };

  // Batch Approve All Pending Time Logs
  const handleBatchApproveTimeLogs = async () => {
    if (pendingTimeLogs.length === 0) {
      toast.info("No pending time logs to approve.");
      return;
    }
    setIsBatchApprovingTimeLogs(true);
    try {
      let approvedCount = 0;
      for (const log of pendingTimeLogs) {
        await reviewTimeLog.mutateAsync({
          id: log.id,
          input: {
            status: "APPROVED",
            reviewNote: `Approved via Quality Review Workstation by ${currentUser?.firstName || "Admin"}`,
          },
        });
        approvedCount++;
      }
      toast.success(`Successfully approved ${approvedCount} time log(s)!`);
    } catch (err) {
      toast.error(
        err instanceof Error && err.message ? err.message : "Failed to approve pending time logs",
      );
    } finally {
      setIsBatchApprovingTimeLogs(false);
    }
  };

  // Save Review Notes without changing status
  const handleSaveReviewNotes = async () => {
    try {
      await updateTask.mutateAsync({
        id: taskId,
        input: { testingNotes: taskReviewNotes.trim() || null },
      });
      toast.success("Review notes saved successfully!");
    } catch (err) {
      toast.error(
        err instanceof Error && err.message ? err.message : "Failed to save review notes",
      );
    }
  };

  // Reassign Tester / Reviewer
  const handleAssignReviewer = async (testerId: string | null) => {
    try {
      await updateTask.mutateAsync({
        id: taskId,
        input: { testerId },
      });
      toast.success(testerId ? "Reviewer assigned successfully." : "Reviewer unassigned.");
    } catch (err) {
      toast.error(
        err instanceof Error && err.message ? err.message : "Failed to update reviewer",
      );
    }
  };

  // Move task to IN_REVIEW
  const handleMoveToInReview = async () => {
    try {
      await updateTask.mutateAsync({
        id: taskId,
        input: { status: "IN_REVIEW" },
      });
      toast.success("Task moved to In Review.");
    } catch (err) {
      toast.error(
        err instanceof Error && err.message ? err.message : "Failed to update review status",
      );
    }
  };

  // Mark all deliverables verified
  const handleVerifyAllDeliverables = async () => {
    if (criteriaItems.length === 0) return;
    const verified = criteriaItems.map((item) => ({ ...item, completed: true }));
    await saveDeliverablesToDescription(cleanDescription, verified);
    toast.success("All deliverables marked verified!");
  };

  // Approve & Mark Completed with Quality Gate Validation
  const handleApproveAndCompleteTask = async (forceAdminOverride = false) => {
    const blockers: string[] = [];
    if (!hasDailyUpdates) blockers.push("At least one Daily Work Update is required.");
    if (!hasTimeLogs) blockers.push("At least one Time Log must be submitted.");
    if (!allBugsClosed) blockers.push(`${openBugsCount} unresolved defect(s) remain.`);
    if (!allSubtasksDone) blockers.push("All subtasks must be Completed first.");

    if (blockers.length > 0 && !forceAdminOverride) {
      if (isManagerOrAdmin) {
        setOverrideBlockers(blockers);
        setShowAdminOverrideConfirm(true);
        return;
      } else {
        toast.error(`Cannot complete task: ${blockers.join(" ")}`);
        return;
      }
    }

    try {
      setIsSubmittingReview(true);
      await updateTask.mutateAsync({
        id: taskId,
        input: {
          status: "DONE",
          testingApproved: true,
          testingNotes:
            taskReviewNotes.trim() ||
            `Validated and approved by ${currentUser?.firstName || "Reviewer"}.`,
        },
      });
      toast.success("Task successfully approved, verified, and marked Completed!");
      setShowAdminOverrideConfirm(false);
    } catch (err) {
      toast.error(
        err instanceof Error && err.message ? err.message : "Failed to complete task",
      );
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Request Changes / Send Back
  const handleRequestChanges = async () => {
    if (!changeRequestReason.trim()) {
      toast.error("Please provide instructions on what changes or revisions are needed.");
      return;
    }
    try {
      setIsSubmittingReview(true);
      await updateTask.mutateAsync({
        id: taskId,
        input: {
          status: "CHANGES_REQUIRED",
          testingNotes: changeRequestReason.trim(),
          testingApproved: false,
        },
      });

      await createTaskUpdate.mutateAsync({
        taskId,
        content: `[REVISION REQUESTED BY ${currentUser?.firstName || "ADMIN"}]: ${changeRequestReason.trim()}`,
      });

      toast.success("Task returned with Changes Requested. Assignees notified.");
      setShowChangeRequestDialog(false);
      setChangeRequestReason("");
    } catch (err) {
      toast.error(
        err instanceof Error && err.message ? err.message : "Failed to request changes",
      );
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleCreateSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subtaskTitle.trim()) return;
    try {
      await createTask.mutateAsync({
        title: subtaskTitle.trim(),
        parentId: taskId,
        projectId: detailedTask.projectId || undefined,
        assigneeId: subtaskAssigneeId || undefined,
        testerId: detailedTask.testerId || undefined,
      });
      setSubtaskTitle("");
      setSubtaskAssigneeId("");
      setShowSubtaskForm(false);
      toast.success("Subtask created successfully!");
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Failed to create subtask");
    }
  };

  const handleCreateWorkEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workCompleted.trim()) {
      toast.error("Work completed field is required.");
      return;
    }
    const targetDate = logDate || updateDate || new Date();
    const dateFormatted = format(targetDate, "PPP");
    const parsedHours = includeTimeLogging ? parseFloat(logHours) : 0;
    const minutes = !isNaN(parsedHours) && parsedHours > 0 ? Math.round(parsedHours * 60) : 0;

    const fullContent = [
      `Date: ${dateFormatted}`,
      minutes > 0 ? `Time Spent: ${(minutes / 60).toFixed(1)} hrs` : "",
      `Completed: ${workCompleted.trim()}`,
      nextPlan.trim() ? `Next Plan: ${nextPlan.trim()}` : "",
      blockers.trim() ? `Blockers: ${blockers.trim()}` : "",
      notes.trim() ? `Notes: ${notes.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      // 1. Record the daily progress update
      await createTaskUpdate.mutateAsync({
        taskId,
        content: fullContent,
      });

      // 2. If time logging enabled and hours specified, record time log
      if (minutes > 0) {
        await createTimeLog.mutateAsync({
          taskId,
          minutes,
          date: targetDate.toISOString(),
          note: `${startTime && endTime ? `${startTime} - ${endTime}: ` : ""}${workCompleted.trim()}`,
        });
      }

      setWorkCompleted("");
      setNextPlan("");
      setBlockers("");
      setNotes("");
      setShowWorkEntryForm(false);
      setShowUpdateForm(false);
      setShowTimeLogForm(false);
      toast.success(
        minutes > 0
          ? "Daily progress report and time log saved!"
          : "Daily progress update recorded!",
      );
    } catch (err) {
      toast.error(
        err instanceof Error && err.message ? err.message : "Failed to record work entry",
      );
    }
  };

  const handleCreateDailyUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workCompleted.trim()) {
      toast.error("Work completed field is required.");
      return;
    }
    const dateFormatted = updateDate ? format(updateDate, "PPP") : format(new Date(), "PPP");
    const fullContent = [
      `Date: ${dateFormatted}`,
      `Completed: ${workCompleted}`,
      nextPlan ? `Next Plan: ${nextPlan}` : "",
      blockers ? `Blockers: ${blockers}` : "",
      notes ? `Notes: ${notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await createTaskUpdate.mutateAsync({
        taskId,
        content: fullContent,
      });
      setWorkCompleted("");
      setNextPlan("");
      setBlockers("");
      setNotes("");
      setShowUpdateForm(false);
      toast.success("Daily work update recorded!");
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Failed to add daily update");
    }
  };

  const handleSaveDescription = async () => {
    try {
      let finalDescription = editDescValue.trim();
      if (criteriaItems.length > 0) {
        const criteriaBlock = `\n\n**Key Deliverables & Action Items:**\n${criteriaItems
          .map((c) => `• [${c.completed ? "x" : " "}] ${c.text}`)
          .join("\n")}`;
        finalDescription = finalDescription ? `${finalDescription}${criteriaBlock}` : criteriaBlock.trim();
      }
      await updateTask.mutateAsync({
        id: taskId,
        input: { description: finalDescription || null },
      });
      setIsEditingDesc(false);
      toast.success("Task description updated successfully!");
    } catch (err: unknown) {
      toast.error((err as { message?: string })?.message || "Failed to update description");
    }
  };

  const handleCreateTimeLog = async (e: React.FormEvent) => {
    e.preventDefault();
    const minutes = Math.round(parseFloat(logHours) * 60);
    if (isNaN(minutes) || minutes <= 0) {
      toast.error("Please enter valid logged hours.");
      return;
    }
    try {
      await createTimeLog.mutateAsync({
        taskId,
        minutes,
        date: logDate ? logDate.toISOString() : new Date().toISOString(),
        note: `${startTime} - ${endTime}: ${timeLogSummary}`,
      });
      setTimeLogSummary("");
      setShowTimeLogForm(false);
      toast.success("Time log submitted!");
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Failed to record time log");
    }
  };

  const handleCreateBug = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bugTitle.trim()) return;
    try {
      await createBug.mutateAsync({
        title: bugTitle.trim(),
        description: bugDescription.trim() || undefined,
        taskId,
        subtaskId: bugSubtaskId || undefined,
        severity: bugSeverity,
        priority: bugPriority,
        assigneeId: bugAssigneeId || undefined,
      });
      setBugTitle("");
      setBugDescription("");
      setShowBugForm(false);
      toast.success("Bug logged successfully!");
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Failed to create bug");
    }
  };

  const handleUpdateBugStatus = async (bugId: string, status: BugStatus) => {
    try {
      await updateBug.mutateAsync({ id: bugId, input: { status } });
      toast.success(`Bug status updated to ${BUG_STATUS_LABELS[status]}`);
    } catch (err) {
      toast.error(
        err instanceof Error && err.message ? err.message : "Failed to update bug status",
      );
    }
  };

  const handleAddBugComment = async (bugId: string) => {
    if (!bugCommentText.trim()) return;
    try {
      await addBugComment.mutateAsync({ id: bugId, content: bugCommentText.trim() });
      setBugCommentText("");
      toast.success("Comment added to bug.");
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Failed to add comment");
    }
  };

  const selectedBug = allTaskBugs.find((b) => b.id === selectedBugId);

  return (
    <div className="flex h-full w-full min-h-0 flex-col overflow-y-auto bg-card/60 text-text font-sans scroll-smooth">
      {/* ── Top Header Panel ── */}
      <div className="border-b border-border bg-card p-6 shadow-sm shrink-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            {onClose && (
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="gap-1.5 text-xs font-semibold text-text-dim hover:text-foreground border-border/80"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Tasks List
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs text-primary">
                Task #{detailedTask.taskNumber}
              </Badge>
              {detailedTask.project && (
                <span className="text-xs font-medium text-text-dim">
                  Project: <strong className="text-text">{detailedTask.project.name}</strong>
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-text">{detailedTask.title}</h1>
            <div className="flex items-center gap-2 text-xs text-text-dim">
              <span className="font-semibold uppercase tracking-wide">Deadline</span>
              <TaskDeadlineBadge task={detailedTask} now={now} />
            </div>
          </div>

          {/* Workflow Status Action Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
              {(
                [
                  "TODO",
                  "IN_PROGRESS",
                  "READY_FOR_TESTING",
                  "CHANGES_REQUIRED",
                  "DONE",
                ] as TaskStatus[]
              ).map((st) => {
                const isActive = detailedTask.status === st;
                return (
                  <button
                    key={st}
                    onClick={() => {
                      if (st === "DONE") {
                        if (!isTester && !isManagerOrAdmin) {
                          toast.error(
                            "Team members cannot directly mark tasks Completed. Please move to Ready for Review for Manager/Lead validation.",
                          );
                          return;
                        }
                        handleApproveAndCompleteTask(false);
                        return;
                      }
                      if (st === "CHANGES_REQUIRED" && (isTester || isManagerOrAdmin)) {
                        setShowChangeRequestDialog(true);
                        return;
                      }
                      handleStatusChange(st);
                    }}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-text-dim hover:bg-card hover:text-text"
                    }`}
                  >
                    {TASK_STATUS_LABELS[st]}
                  </button>
                );
              })}
            </div>

            {isManagerOrAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowReqUpdateModal(true)}
                className="gap-1.5 text-xs font-semibold border-amber-500/40 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400"
                title="Request Task Update from Employee"
              >
                <Bell className="h-3.5 w-3.5" />
                Request Update
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCommModal(true)}
              className="gap-1.5 text-xs font-semibold border-primary/40 text-primary hover:bg-primary/10"
              title="Open Task Communication & Thread"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Task Thread
            </Button>

            {(isManagerOrAdmin || detailedTask.creatorId === currentUser?.id) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                className="gap-1.5 text-xs font-semibold border-rose-500/30 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 cursor-pointer"
                title="Delete Task"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            )}

            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                title="Close Panel"
                className="h-8 w-8 rounded-full border border-border bg-background/80 text-text-dim hover:bg-destructive/20 hover:text-destructive hover:border-destructive/30 transition-all shrink-0 cursor-pointer"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close Panel</span>
              </Button>
            )}
          </div>
        </div>

        {/* Assignees & Reviewer Row */}
        <div className="mt-4 flex flex-wrap items-center gap-6 border-t border-border/50 pt-4 text-xs">
          {/* Assigned Recruiters / Team Members */}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="font-medium text-text-dim">Assigned Recruiters / Team Members:</span>
            <div className="flex items-center gap-1.5">
              {detailedTask.assignees && detailedTask.assignees.length > 0 ? (
                detailedTask.assignees.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-1.5 rounded-full bg-background px-2.5 py-1 border border-border"
                  >
                    <Avatar className="h-4 w-4">
                      <AvatarFallback className="text-[9px]">
                        {(a.user?.firstName?.[0] || a.user?.lastName?.[0] || "?").toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-semibold text-text">
                      {a.user?.firstName} {a.user?.lastName}
                    </span>
                  </div>
                ))
              ) : detailedTask.assignee ? (
                <div className="flex items-center gap-1.5 rounded-full bg-background px-2.5 py-1 border border-border">
                  <Avatar className="h-4 w-4">
                    <AvatarFallback className="text-[9px]">
                      {(detailedTask.assignee?.firstName?.[0] || detailedTask.assignee?.lastName?.[0] || "?").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-semibold text-text">
                    {detailedTask.assignee.firstName} {detailedTask.assignee.lastName}
                  </span>
                </div>
              ) : (
                <span className="italic text-text-dim">Unassigned</span>
              )}
            </div>
          </div>

          {/* Designated Reviewer / Approver */}
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-purple-400" />
            <span className="font-medium text-text-dim">Reviewer / Approver:</span>
            {detailedTask.tester ? (
              <div className="flex items-center gap-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 text-purple-300">
                <Avatar className="h-4 w-4">
                  <AvatarFallback className="text-[9px]">
                    {(detailedTask.tester?.firstName?.[0] || detailedTask.tester?.lastName?.[0] || "?").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-semibold">
                  {detailedTask.tester.firstName} {detailedTask.tester.lastName}
                </span>
              </div>
            ) : (
              <select
                onChange={(e) =>
                  updateTask.mutate({
                    id: taskId,
                    input: { testerId: e.target.value || null },
                  })
                }
                className="rounded-md border border-border bg-background px-2 py-1 text-xs text-text cursor-pointer"
              >
                <option value="">Assign Reviewer...</option>
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} ({u.role.name})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Logged Hours Gauge */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-400" />
            <span className="font-medium text-text-dim">Logged Time:</span>
            <span className="font-bold text-emerald-400 font-mono">
              {(totalLoggedMinutes / 60).toFixed(1)} hrs
            </span>
          </div>
        </div>
      </div>

      {/* ── Admin / Tester Quality Gate Banner ── */}
      {(detailedTask.status === "READY_FOR_TESTING" ||
        detailedTask.status === "IN_REVIEW" ||
        detailedTask.status === "CHANGES_REQUIRED" ||
        isManagerOrAdmin) && (
        <div className="mx-6 mt-4 mb-1 rounded-xl border border-purple-500/30 bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-background p-4 shadow-sm backdrop-blur-sm shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div
                className={`p-2.5 rounded-xl shrink-0 ${
                  detailedTask.status === "DONE"
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : detailedTask.status === "CHANGES_REQUIRED"
                    ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                    : "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                }`}
              >
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-text">
                    {detailedTask.status === "READY_FOR_TESTING"
                      ? "Task Ready for Review & Signoff"
                      : detailedTask.status === "IN_REVIEW"
                      ? "Active Quality Review in Progress"
                      : detailedTask.status === "CHANGES_REQUIRED"
                      ? "Changes Requested - Awaiting Assignee Resubmission"
                      : detailedTask.status === "DONE"
                      ? "Task Verified & Completed"
                      : "Quality Assurance & Signoff Portal"}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] uppercase font-mono font-bold ${
                      detailedTask.status === "DONE"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : detailedTask.status === "CHANGES_REQUIRED"
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                        : "bg-purple-500/10 text-purple-400 border-purple-500/30"
                    }`}
                  >
                    {TASK_STATUS_LABELS[detailedTask.status]}
                  </Badge>
                </div>
                <p className="text-[11px] text-text-dim mt-1 flex flex-wrap items-center gap-2">
                  <span>
                    Reviewer:{" "}
                    <strong className="text-text font-semibold">
                      {detailedTask.tester
                        ? `${detailedTask.tester.firstName} ${detailedTask.tester.lastName}`
                        : "Unassigned Reviewer"}
                    </strong>
                  </span>
                  <span>•</span>
                  <span>
                    Deliverables:{" "}
                    <strong
                      className={
                        criteriaItems.length > 0 && criteriaItems.every((c) => c.completed)
                          ? "text-emerald-400"
                          : "text-amber-400"
                      }
                    >
                      {criteriaItems.filter((c) => c.completed).length}/{criteriaItems.length}
                    </strong>
                  </span>
                  <span>•</span>
                  <span>
                    Time Logs:{" "}
                    <strong
                      className={
                        pendingTimeLogs.length === 0 ? "text-emerald-400" : "text-amber-400"
                      }
                    >
                      {pendingTimeLogs.length > 0
                        ? `${pendingTimeLogs.length} pending review`
                        : "All approved"}
                    </strong>
                  </span>
                  <span>•</span>
                  <span>
                    Bugs:{" "}
                    <strong
                      className={openBugsCount === 0 ? "text-emerald-400" : "text-rose-400"}
                    >
                      {openBugsCount === 0 ? "0 open" : `${openBugsCount} unresolved`}
                    </strong>
                  </span>
                </p>
              </div>
            </div>

            {/* Quick Action Buttons on the Banner */}
            <div className="flex items-center gap-2">
              {activeTab !== "review" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveTab("review")}
                  className="h-8 text-xs font-semibold gap-1.5 border-purple-500/40 text-purple-400 hover:bg-purple-500/10 cursor-pointer shadow-xs"
                >
                  <ShieldCheck className="size-3.5" />
                  Open Review Panel
                </Button>
              )}

              {canApproveCompletion && detailedTask.status !== "DONE" && (
                <>
                  <Button
                    size="sm"
                    onClick={() => handleApproveAndCompleteTask(false)}
                    disabled={isSubmittingReview}
                    className="h-8 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 shadow-xs cursor-pointer"
                  >
                    <CheckCircle2 className="size-3.5" />
                    Approve & Complete
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowChangeRequestDialog(true)}
                    disabled={isSubmittingReview}
                    className="h-8 px-2.5 text-xs font-semibold border-rose-500/40 text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                  >
                    <AlertTriangle className="size-3.5" />
                    Request Changes
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Page Panels Tab Navigation (Sticky) ── */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-card/95 backdrop-blur-md px-6 shrink-0 shadow-xs">
        <div className="flex items-center overflow-x-auto">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === "overview"
                ? "border-primary text-primary"
                : "border-transparent text-text-dim hover:text-text"
            }`}
          >
            <ListTodo className="h-4 w-4" />
            Overview & Subtasks
          </button>

          <button
            onClick={() => setActiveTab("timelogs")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === "timelogs" || (activeTab as string) === "updates"
                ? "border-primary text-primary"
                : "border-transparent text-text-dim hover:text-text"
            }`}
          >
            <Clock className="h-4 w-4" />
            Time Logs & Updates
          </button>

          <button
            onClick={() => setActiveTab("review")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors cursor-pointer relative whitespace-nowrap ${
              activeTab === "review"
                ? "border-purple-500 text-purple-400 font-bold"
                : "border-transparent text-text-dim hover:text-text"
            }`}
          >
            <ShieldCheck className="h-4 w-4 text-purple-400" />
            Review & Signoff
            {(detailedTask.status === "READY_FOR_TESTING" || detailedTask.status === "IN_REVIEW") && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
              </span>
            )}
            {pendingTimeLogs.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                {pendingTimeLogs.length} pending
              </span>
            )}
            {detailedTask.status === "CHANGES_REQUIRED" && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                Changes
              </span>
            )}
            {detailedTask.testingApproved && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Approved
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("activity")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === "activity"
                ? "border-primary text-primary"
                : "border-transparent text-text-dim hover:text-text"
            }`}
          >
            <History className="h-4 w-4" />
            Audit History
          </button>
        </div>

        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="gap-1.5 text-xs font-semibold text-text-dim hover:text-foreground h-8 px-2.5 cursor-pointer shrink-0 ml-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Back to Tasks</span>
          </Button>
        )}
      </div>

      {/* ── Main Tabbed Panel Body ── */}
      <div className="flex-1 p-6 pb-28">
        {/* PANEL 1: OVERVIEW & SUBTASKS */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Description Card */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-dim">
                    Task Overview & Scope
                  </h3>
                </div>
                {!isEditingDesc ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditDescValue(cleanDescription || (criteriaItems.length === 0 ? detailedTask.description || "" : ""));
                      setIsEditingDesc(true);
                    }}
                    className="flex items-center gap-1.5 text-xs text-text-dim hover:text-primary transition-colors font-medium px-2 py-1 rounded-lg border border-border hover:bg-card-hover cursor-pointer"
                  >
                    <Pencil className="size-3" />
                    <span>Edit Scope</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditingDesc(false)}
                      className="text-xs h-7 px-2.5 cursor-pointer"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveDescription}
                      className="text-xs h-7 px-2.5 bg-primary text-primary-foreground font-bold gap-1 cursor-pointer"
                    >
                      <Check className="size-3.5" />
                      Save
                    </Button>
                  </div>
                )}
              </div>

              {isEditingDesc ? (
                <div className="space-y-3 pt-1">
                  <Textarea
                    value={editDescValue}
                    onChange={(e) => setEditDescValue(e.target.value)}
                    placeholder="Enter professional task description and objectives..."
                    rows={4}
                    className="text-xs leading-relaxed border-border bg-canvas/30"
                    autoFocus
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  {cleanDescription ? (
                    <p className="text-sm text-text leading-relaxed whitespace-pre-wrap font-normal">
                      {cleanDescription}
                    </p>
                  ) : criteriaItems.length === 0 ? (
                    <p className="text-xs italic text-text-dim">
                      No narrative description provided for this task.
                    </p>
                  ) : null}

                  {/* Dynamic Deliverables & Action Items Section */}
                  <div className="pt-3 border-t border-border/60 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-text uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle2 className="size-3.5 text-primary" />
                          Key Deliverables & Action Items ({criteriaItems.filter((c) => c.completed).length} / {criteriaItems.length} Done)
                        </span>
                        {criteriaItems.length > 0 && (
                          <span className="text-[10px] text-text-dim font-medium bg-muted/60 px-1.5 py-0.5 rounded">
                            {Math.round((criteriaItems.filter((c) => c.completed).length / criteriaItems.length) * 100)}%
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Template Preset Dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-text-dim hover:text-text gap-1 cursor-pointer"
                              title="Load Deliverables Template"
                            >
                              <Sparkles className="size-3" />
                              <span className="hidden sm:inline">Templates</span>
                              <ChevronDown className="size-3 opacity-60" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 text-xs">
                            <DropdownMenuItem
                              onClick={() => handleApplyTemplate("recruitment")}
                              className="cursor-pointer"
                            >
                              👥 Recruitment & Sourcing
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleApplyTemplate("dev")}
                              className="cursor-pointer"
                            >
                              💻 Engineering & Tech
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleApplyTemplate("sales")}
                              className="cursor-pointer"
                            >
                              💰 Sales & Outreach
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleApplyTemplate("ops")}
                              className="cursor-pointer"
                            >
                              ⚙️ Operations & Process
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleApplyTemplate("clear")}
                              className="cursor-pointer text-destructive focus:text-destructive"
                            >
                              <Trash2 className="size-3.5 mr-1.5" /> Clear All Deliverables
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setIsAddingDeliverable((prev) => !prev)}
                          className="h-7 px-2 text-xs gap-1 cursor-pointer"
                        >
                          <Plus className="size-3" />
                          <span>Add Item</span>
                        </Button>
                      </div>
                    </div>

                    {/* Progress Bar when items exist */}
                    {criteriaItems.length > 0 && (
                      <div className="w-full h-1.5 bg-muted/60 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                          style={{
                            width: `${(criteriaItems.filter((c) => c.completed).length / criteriaItems.length) * 100}%`,
                          }}
                        />
                      </div>
                    )}

                    {/* Inline Add Item Form */}
                    {isAddingDeliverable && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleAddDeliverable();
                        }}
                        className="flex items-center gap-2 p-2 rounded-lg bg-card border border-primary/30 shadow-sm animate-in fade-in duration-150"
                      >
                        <Input
                          placeholder="Enter specific task deliverable or action item..."
                          value={newDeliverableInput}
                          onChange={(e) => setNewDeliverableInput(e.target.value)}
                          className="text-xs h-8 bg-background border-border"
                          autoFocus
                        />
                        <Button
                          type="submit"
                          size="sm"
                          className="h-8 px-2.5 text-xs font-semibold cursor-pointer shrink-0"
                          disabled={!newDeliverableInput.trim()}
                        >
                          <Plus className="size-3.5 mr-1" />
                          Add
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setIsAddingDeliverable(false);
                            setNewDeliverableInput("");
                          }}
                          className="h-8 px-2 text-xs cursor-pointer text-text-dim"
                        >
                          Cancel
                        </Button>
                      </form>
                    )}

                    {/* Deliverables Grid */}
                    {criteriaItems.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {criteriaItems.map((item, idx) => {
                          const isEditingThis = editingDeliverableIdx === idx;

                          if (isEditingThis) {
                            return (
                              <div
                                key={idx}
                                className="flex items-center gap-2 p-2 rounded-lg border border-primary/50 bg-card shadow-sm"
                              >
                                <Input
                                  value={editingDeliverableText}
                                  onChange={(e) => setEditingDeliverableText(e.target.value)}
                                  className="text-xs h-7 bg-background border-border"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      handleSaveEditDeliverable(idx);
                                    } else if (e.key === "Escape") {
                                      setEditingDeliverableIdx(null);
                                    }
                                  }}
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleSaveEditDeliverable(idx)}
                                  className="h-7 w-7 p-0 cursor-pointer"
                                  title="Save"
                                >
                                  <Check className="size-3" />
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingDeliverableIdx(null)}
                                  className="h-7 w-7 p-0 text-text-dim cursor-pointer"
                                  title="Cancel"
                                >
                                  <X className="size-3" />
                                </Button>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={idx}
                              className={`group relative flex items-start gap-2.5 p-2.5 rounded-lg border transition-all shadow-2xs cursor-pointer ${
                                item.completed
                                  ? "border-emerald-500/30 bg-emerald-500/5 text-text-dim hover:border-emerald-500/50"
                                  : "border-border/80 bg-background/60 text-text hover:border-primary/40 hover:bg-card-hover/40"
                              }`}
                              onClick={() => handleToggleDeliverable(idx)}
                            >
                              {/* Checkbox indicator */}
                              <div
                                className={`size-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                  item.completed
                                    ? "bg-emerald-500 text-white"
                                    : "bg-primary/10 border border-primary/20 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
                                }`}
                                title={item.completed ? "Click to mark incomplete" : "Click to mark complete"}
                              >
                                {item.completed ? (
                                  <Check className="size-2.5 stroke-[3]" />
                                ) : (
                                  <span className="text-[10px] font-bold font-mono">{idx + 1}</span>
                                )}
                              </div>

                              {/* Content text */}
                              <span
                                className={`leading-snug font-medium text-xs flex-1 select-none ${
                                  item.completed ? "line-through text-text-dim opacity-75" : "text-text"
                                }`}
                              >
                                {item.text}
                              </span>

                              {/* Action buttons (hover) */}
                              <div
                                className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingDeliverableIdx(idx);
                                    setEditingDeliverableText(item.text);
                                  }}
                                  className="p-1 rounded hover:bg-muted text-text-dim hover:text-text cursor-pointer transition-colors"
                                  title="Edit item text"
                                >
                                  <Pencil className="size-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveDeliverable(idx);
                                  }}
                                  className="p-1 rounded hover:bg-destructive/10 text-text-dim hover:text-destructive cursor-pointer transition-colors"
                                  title="Delete item"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border/80 p-4 text-center text-xs text-text-dim flex flex-col items-center justify-center gap-2 bg-muted/10">
                        <p>No deliverables or action items configured for this task yet.</p>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIsAddingDeliverable(true)}
                            className="h-7 text-xs gap-1 cursor-pointer"
                          >
                            <Plus className="size-3" /> Add Custom Item
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleApplyTemplate("recruitment")}
                            className="h-7 text-xs text-primary hover:bg-primary/10 cursor-pointer"
                          >
                            Load Recruitment Checklist
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Rule 2 Indicator Banner for Multiple Assignees */}
            {isMultipleAssignees && (
              <div className="flex items-start gap-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200">
                <div className="p-1 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="text-xs space-y-0.5 leading-relaxed">
                  <span className="font-bold text-amber-900 dark:text-amber-300 text-xs block">
                    Collaboration Policy: Multiple Assignees
                  </span>
                  <p className="text-amber-800/90 dark:text-amber-200/90">
                    This task has multiple assigned contributors. Per workflow standards, please break down milestones into dedicated subtasks for each team member below.
                  </p>
                </div>
              </div>
            )}

            {/* Subtasks Section */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-text">Subtasks Breakdown</h3>
                  <p className="text-xs text-text-dim">Assign specific recruitment deliverables or stages to team members</p>
                </div>
                {isManagerOrAdmin && (
                  <Button
                    size="sm"
                    onClick={() => setShowSubtaskForm(!showSubtaskForm)}
                    className="gap-1 text-xs font-semibold cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Subtask
                  </Button>
                )}
              </div>

              {/* Subtask Form */}
              {isManagerOrAdmin && showSubtaskForm && (
                <form
                  onSubmit={handleCreateSubtask}
                  className="space-y-3 rounded-lg border border-primary/30 bg-background/80 p-4"
                >
                  <Input
                    placeholder="Subtask Title (e.g. Candidate Phone Screening & Shortlisting)"
                    value={subtaskTitle}
                    onChange={(e) => setSubtaskTitle(e.target.value)}
                    className="text-xs"
                    required
                  />
                  <div className="flex items-center gap-3">
                    <select
                      value={subtaskAssigneeId}
                      onChange={(e) => setSubtaskAssigneeId(e.target.value)}
                      className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-text flex-1 cursor-pointer"
                    >
                      <option value="">Select Assignee...</option>
                      {allUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.firstName} {u.lastName} ({u.role.name})
                        </option>
                      ))}
                    </select>
                    <Button type="submit" size="sm" className="text-xs cursor-pointer">
                      Save Subtask
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSubtaskForm(false)}
                      className="text-xs cursor-pointer"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}

              {/* Subtasks List */}
              {detailedTask.subtasks && detailedTask.subtasks.length > 0 ? (
                <div className="divide-y divide-border rounded-lg border border-border">
                  {detailedTask.subtasks.map((st) => (
                    <div
                      key={st.id}
                      className="flex flex-wrap items-center justify-between gap-4 p-3 hover:bg-card-hover/40 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-text">{st.title}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {TASK_STATUS_LABELS[st.status]}
                          </Badge>
                        </div>
                        {st.assignee && (
                          <div className="flex items-center gap-1.5 text-[11px] text-text-dim">
                            <span>Assigned to:</span>
                            <span className="font-medium text-text">
                              {st.assignee.firstName} {st.assignee.lastName}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <select
                          value={st.status}
                          onChange={(e) =>
                            updateTask.mutate({
                              id: st.id,
                              input: { status: e.target.value as TaskStatus },
                            })
                          }
                          className="rounded-md border border-border bg-background px-2 py-1 text-[11px] text-text"
                        >
                          {TASK_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {TASK_STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-xs italic text-text-dim">
                  No subtasks created yet for this task.
                </p>
              )}
            </div>
          </div>
        )}

        {/* MERGED PANEL: TIME LOGS & DAILY PROGRESS UPDATES */}
        {(activeTab === "timelogs" || (activeTab as string) === "updates") && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-text">Time Logs & Daily Progress Updates</h3>
                <p className="text-xs text-text-dim">
                  Track hours spent, daily accomplishments, next plans, and blockers
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    if (selectedLogDateFilter) {
                      setLogDate(selectedLogDateFilter);
                      setUpdateDate(selectedLogDateFilter);
                    }
                    setShowWorkEntryForm(!showWorkEntryForm);
                  }}
                  className="gap-1.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Log Daily Work & Hours
                </Button>
              </div>
            </div>

            {/* Layout with Embedded Calendar Widget */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Visual Calendar Card */}
              <div className="lg:col-span-4 rounded-xl border border-emerald-500/20 bg-card p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4" /> Time & Activity Calendar
                  </span>
                  {selectedLogDateFilter && (
                    <button
                      onClick={() => setSelectedLogDateFilter(undefined)}
                      className="text-[11px] text-text-dim hover:text-text underline cursor-pointer"
                    >
                      Clear Filter
                    </button>
                  )}
                </div>

                <Calendar
                  mode="single"
                  selected={selectedLogDateFilter || logDate}
                  onSelect={(d) => {
                    setSelectedLogDateFilter(d);
                    if (d) {
                      setLogDate(d);
                      setUpdateDate(d);
                    }
                  }}
                  className="w-full rounded-lg border border-border bg-background/80 p-2"
                />

                <div className="text-xs text-text-dim space-y-2 pt-2 border-t border-border/60">
                  <div className="flex justify-between items-center">
                    <span>Selected Date:</span>
                    <span className="font-semibold text-text">
                      {selectedLogDateFilter
                        ? format(selectedLogDateFilter, "PP")
                        : logDate
                          ? format(logDate, "PP")
                          : "All Dates"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Logged Hours:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {(
                        allTimeLogs
                          .filter(
                            (l) =>
                              !selectedLogDateFilter ||
                              new Date(l.date).toDateString() ===
                                selectedLogDateFilter.toDateString(),
                          )
                          .reduce((acc, l) => acc + l.minutes, 0) / 60
                      ).toFixed(1)}{" "}
                      hrs
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Updates Logged:</span>
                    <span className="font-mono font-bold text-primary">
                      {
                        allUpdates.filter(
                          (u) =>
                            !selectedLogDateFilter ||
                            new Date(u.createdAt).toDateString() ===
                              selectedLogDateFilter.toDateString(),
                        ).length
                      }{" "}
                      entry(s)
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Unified Form & Combined Daily Progress & Time Logs Panel */}
              <div className="lg:col-span-8 space-y-5">
                {/* Unified Work & Time Log Form */}
                {showWorkEntryForm && (
                  <form
                    onSubmit={handleCreateWorkEntry}
                    className="space-y-4 rounded-xl border border-primary/40 bg-card p-5 shadow-md"
                  >
                    <div className="flex items-center justify-between border-b border-border/60 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-text">Record Daily Progress & Log Time</h4>
                          <p className="text-[11px] text-text-dim">Log your work accomplishments and time spent for the day</p>
                        </div>
                      </div>

                      {/* Calendar Picker Field */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-text-dim flex items-center gap-1">
                          <CalendarIcon className="h-3.5 w-3.5 text-primary" /> Work Date:
                        </span>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 text-xs font-normal">
                              <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-primary" />
                              {logDate ? format(logDate, "PPP") : <span>Pick date</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                              mode="single"
                              selected={logDate}
                              onSelect={(d) => {
                                if (d) {
                                  setLogDate(d);
                                  setUpdateDate(d);
                                  setSelectedLogDateFilter(d);
                                }
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {/* Time Tracking Row */}
                    <div className="rounded-lg border border-border/70 bg-background/60 p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" /> Working Time Tracking
                        </span>
                        <label className="flex items-center gap-2 text-xs text-text-dim cursor-pointer">
                          <input
                            type="checkbox"
                            checked={includeTimeLogging}
                            onChange={(e) => setIncludeTimeLogging(e.target.checked)}
                            className="rounded border-border text-emerald-500 focus:ring-emerald-400"
                          />
                          <span>Include Time Log</span>
                        </label>
                      </div>

                      {includeTimeLogging && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-text-dim">Start Time</label>
                            <Input
                              placeholder="10:00 AM"
                              value={startTime}
                              onChange={(e) => {
                                const val = e.target.value;
                                setStartTime(val);
                                const autoHours = calculateDiffHours(val, endTime);
                                if (autoHours !== null && parseFloat(autoHours) >= 0) {
                                  setLogHours(autoHours);
                                }
                              }}
                              className="text-xs h-8"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-text-dim">End Time</label>
                            <Input
                              placeholder="01:00 PM"
                              value={endTime}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEndTime(val);
                                const autoHours = calculateDiffHours(startTime, val);
                                if (autoHours !== null && parseFloat(autoHours) >= 0) {
                                  setLogHours(autoHours);
                                }
                              }}
                              className="text-xs h-8"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-text-dim flex items-center justify-between">
                              <span>Total Hours *</span>
                              <span className="text-[9px] text-emerald-400 font-normal">Auto-calculated</span>
                            </label>
                            <Input
                              type="number"
                              step="0.5"
                              placeholder="3.0"
                              value={logHours}
                              onChange={(e) => setLogHours(e.target.value)}
                              className="text-xs h-8 font-mono font-semibold text-emerald-400"
                              required={includeTimeLogging}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Work Progress Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-text">
                          Work Completed *
                        </label>
                        <Textarea
                          placeholder="What did you build or finish on this date?"
                          value={workCompleted}
                          onChange={(e) => setWorkCompleted(e.target.value)}
                          className="text-xs h-20"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-text-dim">
                          Next Planned Work
                        </label>
                        <Textarea
                          placeholder="What will you work on next?"
                          value={nextPlan}
                          onChange={(e) => setNextPlan(e.target.value)}
                          className="text-xs h-20"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-text-dim">Blockers</label>
                        <Input
                          placeholder="Any impediments holding you back?"
                          value={blockers}
                          onChange={(e) => setBlockers(e.target.value)}
                          className="text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-text-dim">Notes & Links</label>
                        <Input
                          placeholder="Additional comments or PR links"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowWorkEntryForm(false)}
                        className="text-xs"
                      >
                        Cancel
                      </Button>
                      <Button type="submit" size="sm" className="text-xs gap-1.5 bg-primary hover:bg-primary/90">
                        <Check className="h-3.5 w-3.5" /> Save Progress & Time Log
                      </Button>
                    </div>
                  </form>
                )}

                {/* UNIFIED MERGED PANEL: DAILY PROGRESS & TIME LOGS */}
                <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                  {/* Unified Panel Header */}
                  <div className="p-4 border-b border-border bg-card/80 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400">
                        <Clock className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-text">Daily Progress & Time Logs</h4>
                          <Badge variant="secondary" className="text-[10px] font-mono">
                            {
                              allUpdates.filter(
                                (u) =>
                                  !selectedLogDateFilter ||
                                  new Date(u.createdAt).toDateString() ===
                                    selectedLogDateFilter.toDateString(),
                              ).length +
                                allTimeLogs.filter(
                                  (l) =>
                                    !selectedLogDateFilter ||
                                    new Date(l.date).toDateString() ===
                                      selectedLogDateFilter.toDateString(),
                                ).length
                            }{" "}
                            entries
                          </Badge>
                        </div>
                        <p className="text-[11px] text-text-dim">
                          Combined work reports, hours logged, and manager review status
                        </p>
                      </div>
                    </div>

                    {/* Stats & Filters */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs">
                        <span className="text-text-dim font-medium">Logged:</span>
                        <span className="font-mono font-bold text-emerald-400">
                          {(
                            allTimeLogs
                              .filter(
                                (l) =>
                                  !selectedLogDateFilter ||
                                  new Date(l.date).toDateString() ===
                                    selectedLogDateFilter.toDateString(),
                              )
                              .reduce((acc, l) => acc + l.minutes, 0) / 60
                          ).toFixed(1)}{" "}
                          hrs
                        </span>
                      </div>

                      <div className="flex items-center rounded-lg border border-border bg-background p-0.5 text-xs">
                        <button
                          onClick={() => setWorkEntriesFilter("all")}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                            workEntriesFilter === "all"
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-text-dim hover:text-text"
                          }`}
                        >
                          All
                        </button>
                        <button
                          onClick={() => setWorkEntriesFilter("updates")}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                            workEntriesFilter === "updates"
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-text-dim hover:text-text"
                          }`}
                        >
                          Reports (
                          {
                            allUpdates.filter(
                              (u) =>
                                !selectedLogDateFilter ||
                                new Date(u.createdAt).toDateString() ===
                                  selectedLogDateFilter.toDateString(),
                            ).length
                          }
                          )
                        </button>
                        <button
                          onClick={() => setWorkEntriesFilter("timelogs")}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                            workEntriesFilter === "timelogs"
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-text-dim hover:text-text"
                          }`}
                        >
                          Time Logs (
                          {
                            allTimeLogs.filter(
                              (l) =>
                                !selectedLogDateFilter ||
                                new Date(l.date).toDateString() ===
                                  selectedLogDateFilter.toDateString(),
                            ).length
                          }
                          )
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Panel Content Stream */}
                  <div className="p-4 space-y-4">
                    {(() => {
                      const filteredUpdates = allUpdates.filter(
                        (u) =>
                          !selectedLogDateFilter ||
                          new Date(u.createdAt).toDateString() ===
                            selectedLogDateFilter.toDateString(),
                      );

                      const filteredTimeLogs = allTimeLogs.filter(
                        (l) =>
                          !selectedLogDateFilter ||
                          new Date(l.date).toDateString() ===
                            selectedLogDateFilter.toDateString(),
                      );

                      // Pre-match updates with their unique corresponding time logs
                      const usedTimeLogIds = new Set<string>();
                      const updateTimeLogMap = new Map<string, typeof filteredTimeLogs[0]>();

                      filteredUpdates.forEach((u) => {
                        const match = u.content.match(/completed:\s*([^\n]+)/i);
                        const comp = match ? match[1].trim() : "";

                        let matched = filteredTimeLogs.find((l) => {
                          if (usedTimeLogIds.has(l.id)) return false;
                          if (l.userId !== u.userId) return false;
                          if (comp && l.note && (l.note.includes(comp) || comp.includes(l.note.replace(/^[0-9:\sAPMapm-]+:\s*/, '')))) return true;
                          return false;
                        });

                        if (!matched) {
                          let minDiff = Infinity;
                          filteredTimeLogs.forEach((l) => {
                            if (usedTimeLogIds.has(l.id)) return;
                            if (l.userId !== u.userId) return;
                            if (new Date(l.date).toDateString() === new Date(u.createdAt).toDateString()) {
                              const uTime = new Date(u.createdAt).getTime();
                              const lTime = new Date(l.createdAt || l.date).getTime();
                              const diff = Math.abs(uTime - lTime);
                              if (diff < minDiff) {
                                minDiff = diff;
                                matched = l;
                              }
                            }
                          });
                        }

                        if (matched) {
                          usedTimeLogIds.add(matched.id);
                          updateTimeLogMap.set(u.id, matched);
                        }
                      });

                      const hasEntries =
                        (workEntriesFilter === "all" &&
                          (filteredUpdates.length > 0 || filteredTimeLogs.length > 0)) ||
                        (workEntriesFilter === "updates" && filteredUpdates.length > 0) ||
                        (workEntriesFilter === "timelogs" && filteredTimeLogs.length > 0);

                      if (!hasEntries) {
                        return (
                          <div className="py-10 text-center space-y-3 bg-card/40 rounded-xl border border-dashed border-border p-6">
                            <div className="mx-auto w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center text-text-dim">
                              <CalendarDays className="h-5 w-5" />
                            </div>
                            <p className="text-xs italic text-text-dim">
                              No progress updates or time logs recorded yet for this selection.
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (selectedLogDateFilter) {
                                  setLogDate(selectedLogDateFilter);
                                }
                                setShowWorkEntryForm(true);
                              }}
                              className="text-xs gap-1.5"
                            >
                              <Plus className="h-3.5 w-3.5" /> Log Daily Work & Hours
                            </Button>
                          </div>
                        );
                      }

                                            return (
                        <div className="space-y-3">
                          {/* When displaying all or updates */}
                          {(workEntriesFilter === "all" || workEntriesFilter === "updates") &&
                            filteredUpdates.map((u) => {
                              // Retrieve uniquely matched time log for this update
                              const matchedTimeLog = updateTimeLogMap.get(u.id);

                              // Parse structured update fields
                              const contentLines = u.content.split("\n");
                              let completedText = "";
                              let nextPlanText = "";
                              let blockersText = "";
                              let notesText = "";
                              let timeSpentText = "";

                              contentLines.forEach((line: string) => {
                                const trimmed = line.trim();
                                if (/^completed:\s*/i.test(trimmed)) {
                                  completedText = trimmed.replace(/^completed:\s*/i, "");
                                } else if (/^next plan:\s*/i.test(trimmed)) {
                                  nextPlanText = trimmed.replace(/^next plan:\s*/i, "");
                                } else if (/^blockers?:\s*/i.test(trimmed)) {
                                  blockersText = trimmed.replace(/^blockers?:\s*/i, "");
                                } else if (/^notes?:\s*/i.test(trimmed)) {
                                  notesText = trimmed.replace(/^notes?:\s*/i, "");
                                } else if (/^time spent:\s*/i.test(trimmed)) {
                                  timeSpentText = trimmed.replace(/^time spent:\s*/i, "");
                                } else if (!/^date:\s*/i.test(trimmed) && !completedText) {
                                  completedText = trimmed;
                                }
                              });

                              return (
                                <div
                                  key={u.id}
                                  className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3 hover:border-border/80 transition-all"
                                >
                                  {/* Entry Header: User Info & Time Status */}
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
                                    <div className="flex items-center gap-2">
                                      <Avatar className="h-6 w-6">
                                        <AvatarFallback className="text-[10px]">
                                          {(
                                            u.user?.firstName?.[0] ||
                                            u.user?.lastName?.[0] ||
                                            "?"
                                          ).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="font-bold text-xs text-text">
                                        {u.user?.firstName} {u.user?.lastName}
                                      </span>
                                      <Badge variant="outline" className="text-[10px] text-primary border-primary/20 bg-primary/5">
                                        Progress Report
                                      </Badge>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      {/* Attached / Matched Time Log Badge */}
                                      {(matchedTimeLog || timeSpentText) && (
                                        <div className="flex items-center gap-1.5">
                                          <Badge
                                            variant="secondary"
                                            className="text-[11px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                          >
                                            <Clock className="h-3 w-3 mr-1 text-emerald-400" />
                                            {matchedTimeLog
                                              ? `${(matchedTimeLog.minutes / 60).toFixed(1)} hrs`
                                              : timeSpentText}
                                          </Badge>

                                          {matchedTimeLog && (
                                            <>
                                              {isManagerOrAdmin ? (
                                                <DropdownMenu>
                                                  <DropdownMenuTrigger asChild>
                                                    <button
                                                      type="button"
                                                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-[11px] font-semibold border transition-all cursor-pointer ${
                                                        matchedTimeLog.status === "APPROVED"
                                                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                                                          : matchedTimeLog.status === "REJECTED"
                                                            ? "bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20"
                                                            : "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20 shadow-sm"
                                                      }`}
                                                    >
                                                      {matchedTimeLog.status === "APPROVED" ? (
                                                        <>
                                                          <span className="size-1.5 rounded-full bg-emerald-400" />
                                                          <span>Approved</span>
                                                        </>
                                                      ) : matchedTimeLog.status === "REJECTED" ? (
                                                        <>
                                                          <span className="size-1.5 rounded-full bg-rose-400" />
                                                          <span>Rejected</span>
                                                        </>
                                                      ) : (
                                                        <>
                                                          <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
                                                          <span>Approve</span>
                                                        </>
                                                      )}
                                                      <ChevronDown className="h-3 w-3 opacity-70 ml-0.5" />
                                                    </button>
                                                  </DropdownMenuTrigger>
                                                  <DropdownMenuContent align="end" className="w-32 p-1">
                                                    <DropdownMenuItem
                                                      onClick={() => handleUpdateTimeLogStatus(matchedTimeLog.id, "APPROVED")}
                                                      className="text-xs font-semibold text-emerald-400 cursor-pointer flex items-center gap-2 hover:bg-emerald-500/10"
                                                    >
                                                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                                                      <span>Approved</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                      onClick={() => handleUpdateTimeLogStatus(matchedTimeLog.id, "REJECTED")}
                                                      className="text-xs font-semibold text-rose-400 cursor-pointer flex items-center gap-2 hover:bg-rose-500/10"
                                                    >
                                                      <X className="h-3.5 w-3.5 text-rose-400" />
                                                      <span>Rejected</span>
                                                    </DropdownMenuItem>
                                                  </DropdownMenuContent>
                                                </DropdownMenu>
                                              ) : (
                                                <Badge
                                                  variant="outline"
                                                  className={`text-[9px] font-bold ${
                                                    matchedTimeLog.status === "APPROVED"
                                                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                      : matchedTimeLog.status === "REJECTED"
                                                        ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                                        : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                                  }`}
                                                >
                                                  {matchedTimeLog.status || "PENDING"}
                                                </Badge>
                                              )}
                                            </>
                                          )}
                                        </div>
                                      )}

                                      <span className="text-[11px] text-text-dim font-mono flex items-center gap-1">
                                        <CalendarIcon className="h-3 w-3 text-text-dim" />
                                        {new Date(u.createdAt).toLocaleDateString()}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Entry Body: Structured Update Fields */}
                                  <div className="space-y-2 text-xs">
                                    {completedText ? (
                                      <div>
                                        <span className="font-semibold text-text-dim block text-[11px] uppercase tracking-wider mb-0.5">
                                          Accomplishments:
                                        </span>
                                        <p className="text-text leading-relaxed whitespace-pre-wrap">
                                          {completedText}
                                        </p>
                                      </div>
                                    ) : (
                                      <p className="text-text leading-relaxed whitespace-pre-wrap">
                                        {u.content}
                                      </p>
                                    )}

                                    {nextPlanText && (
                                      <div className="rounded-lg bg-background/50 border border-border/50 p-2 text-xs">
                                        <span className="font-semibold text-primary flex items-center gap-1">
                                          <ArrowRight className="h-3 w-3" /> Next Plan:
                                        </span>
                                        <p className="mt-0.5 text-text-dim">{nextPlanText}</p>
                                      </div>
                                    )}

                                    {blockersText && (
                                      <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2 text-xs">
                                        <span className="font-semibold text-rose-400 flex items-center gap-1">
                                          <AlertCircle className="h-3 w-3" /> Blocker:
                                        </span>
                                        <p className="mt-0.5 text-rose-300">{blockersText}</p>
                                      </div>
                                    )}

                                    {notesText && (
                                      <div className="text-[11px] text-text-dim flex items-center gap-1 pt-1">
                                        <span className="font-semibold text-text">Notes:</span>
                                        <span>{notesText}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}

                          {/* Standalone Time Logs (only those not already paired with a progress update) */}
                          {(workEntriesFilter === "all" || workEntriesFilter === "timelogs") &&
                            filteredTimeLogs
                              .filter((l) => {
                                if (workEntriesFilter === "timelogs") return true;
                                return !usedTimeLogIds.has(l.id);
                              })
                              .map((l) => (
                                <div
                                  key={l.id}
                                  className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-2.5 hover:border-border/80 transition-all"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
                                    <div className="flex items-center gap-2">
                                      <Avatar className="h-6 w-6">
                                        <AvatarFallback className="text-[10px]">
                                          {(
                                            l.user.firstName?.[0] ||
                                            l.user.lastName?.[0] ||
                                            "?"
                                          ).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="font-bold text-xs text-text">
                                        {l.user.firstName} {l.user.lastName}
                                      </span>
                                      <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/20 bg-emerald-500/5">
                                        Time Log
                                      </Badge>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-bold text-xs text-emerald-400">
                                        {(l.minutes / 60).toFixed(1)} hrs
                                      </span>

                                      {isManagerOrAdmin ? (
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <button
                                              type="button"
                                              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-[11px] font-semibold border transition-all cursor-pointer ${
                                                l.status === "APPROVED"
                                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                                                  : l.status === "REJECTED"
                                                    ? "bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20"
                                                    : "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20 shadow-sm"
                                              }`}
                                            >
                                              {l.status === "APPROVED" ? (
                                                <>
                                                  <span className="size-1.5 rounded-full bg-emerald-400" />
                                                  <span>Approved</span>
                                                </>
                                              ) : l.status === "REJECTED" ? (
                                                <>
                                                  <span className="size-1.5 rounded-full bg-rose-400" />
                                                  <span>Rejected</span>
                                                </>
                                              ) : (
                                                <>
                                                  <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
                                                  <span>Approve</span>
                                                </>
                                              )}
                                              <ChevronDown className="h-3 w-3 opacity-70 ml-0.5" />
                                            </button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end" className="w-32 p-1">
                                            <DropdownMenuItem
                                              onClick={() => handleUpdateTimeLogStatus(l.id, "APPROVED")}
                                              className="text-xs font-semibold text-emerald-400 cursor-pointer flex items-center gap-2 hover:bg-emerald-500/10"
                                            >
                                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                                              <span>Approved</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              onClick={() => handleUpdateTimeLogStatus(l.id, "REJECTED")}
                                              className="text-xs font-semibold text-rose-400 cursor-pointer flex items-center gap-2 hover:bg-rose-500/10"
                                            >
                                              <X className="h-3.5 w-3.5 text-rose-400" />
                                              <span>Rejected</span>
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      ) : (
                                        <Badge
                                          variant="outline"
                                          className={`text-[9px] font-bold ${
                                            l.status === "APPROVED"
                                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                              : l.status === "REJECTED"
                                                ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                          }`}
                                        >
                                          {l.status || "PENDING"}
                                        </Badge>
                                      )}

                                      <span className="text-[11px] text-text-dim font-mono flex items-center gap-1">
                                        <CalendarIcon className="h-3 w-3 text-emerald-400" />
                                        {new Date(l.date).toLocaleDateString()}
                                      </span>
                                    </div>
                                  </div>

                                  <p className="text-xs text-text leading-relaxed">
                                    {l.note || "No specific summary provided for this time log."}
                                  </p>
                                </div>
                              ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* PANEL: QUALITY REVIEW & SIGNOFF WORKSTATION */}
        {activeTab === "review" && (
          <div className="space-y-6">
            {/* 1. Executive Quality Gate Scorecard & Verdict Bar */}
            <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-card via-card to-purple-500/5 p-6 shadow-sm space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-400 shadow-inner">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-base font-bold text-text">Quality Review & Verification Gate</h3>
                      <Badge
                        variant="outline"
                        className={`text-xs px-2.5 py-0.5 font-bold ${
                          detailedTask.status === "DONE"
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                            : detailedTask.status === "CHANGES_REQUIRED"
                            ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                            : "border-purple-500/30 bg-purple-500/10 text-purple-300"
                        }`}
                      >
                        {TASK_STATUS_LABELS[detailedTask.status]}
                      </Badge>
                    </div>
                    <p className="text-xs text-text-dim mt-0.5">
                      Verify deliverables, inspect daily work accountability, audit time logs, and approve completion signoff
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {detailedTask.status === "READY_FOR_TESTING" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleMoveToInReview}
                      className="h-8 text-xs font-semibold gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 cursor-pointer"
                    >
                      <Clock className="size-3.5" />
                      Mark Under Active Review
                    </Button>
                  )}
                  {pendingTimeLogs.length > 0 && isManagerOrAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isBatchApprovingTimeLogs}
                      onClick={handleBatchApproveTimeLogs}
                      className="h-8 text-xs font-semibold gap-1.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 cursor-pointer shadow-xs"
                      title="Approve all unapproved time logs for this task"
                    >
                      <CheckCheck className="size-3.5" />
                      {isBatchApprovingTimeLogs
                        ? "Approving Logs..."
                        : `Approve All Pending Time (${pendingTimeLogs.length})`}
                    </Button>
                  )}
                  {criteriaItems.length > 0 && !allDeliverablesCompleted && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleVerifyAllDeliverables}
                      className="h-8 text-xs font-semibold gap-1.5 border-primary/40 text-primary hover:bg-primary/10 cursor-pointer"
                    >
                      <ClipboardCheck className="size-3.5" />
                      Verify All Action Items
                    </Button>
                  )}
                </div>
              </div>

              {/* Readiness Progress Bar & Criteria Breakdown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-text flex items-center gap-1.5">
                    <span>Quality Gates Compliance:</span>
                    <span className="font-mono text-purple-400 font-bold">
                      {metCriteriaCount} of {totalCriteriaCount} Requirements Met ({readinessPercentage}%)
                    </span>
                  </span>
                  <span
                    className={`font-semibold text-xs flex items-center gap-1 ${
                      readinessPercentage === 100 ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    {readinessPercentage === 100 ? (
                      <>
                        <CheckCircle2 className="size-3.5" /> All Quality Requirements Satisfied — Ready for Signoff
                      </>
                    ) : (
                      <>
                        <AlertCircle className="size-3.5" /> {totalCriteriaCount - metCriteriaCount} Item(s) Pending Resolution
                      </>
                    )}
                  </span>
                </div>

                <div className="w-full bg-muted/60 h-2.5 rounded-full overflow-hidden p-0.5 border border-border/50">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      readinessPercentage === 100
                        ? "bg-gradient-to-r from-purple-500 to-emerald-400"
                        : "bg-gradient-to-r from-purple-600 via-amber-500 to-primary"
                    }`}
                    style={{ width: `${readinessPercentage}%` }}
                  />
                </div>

                {/* 5 Criteria Pills */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 pt-1">
                  {criteriaStatus.map((c) => (
                    <div
                      key={c.id}
                      className={`p-2.5 rounded-xl border text-xs transition-all ${
                        c.met
                          ? "bg-emerald-500/5 border-emerald-500/25 text-emerald-400"
                          : "bg-muted/40 border-border text-text-dim"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[11px] truncate">{c.label}</span>
                        {c.met ? (
                          <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="size-3.5 text-amber-400 shrink-0" />
                        )}
                      </div>
                      <p className="text-[10px] mt-1 font-mono font-medium truncate">
                        {c.countText}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Detailed Verification Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* CARD A: Deliverables & Scope Checklist */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="size-4 text-purple-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-text">
                      Deliverables & Scope Verification
                    </h4>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-mono font-bold ${
                      allDeliverablesCompleted
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    }`}
                  >
                    {completedDeliverablesCount} / {totalDeliverablesCount} Done
                  </Badge>
                </div>

                {criteriaItems.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-text-dim">
                      Reviewer can verify each deliverable directly. Changes are automatically saved.
                    </p>
                    <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
                      {criteriaItems.map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleToggleDeliverable(idx)}
                          className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                            item.completed
                              ? "bg-emerald-500/5 border-emerald-500/20 text-text hover:bg-emerald-500/10"
                              : "bg-background/60 border-border/70 text-text hover:border-primary/40"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={() => {}}
                            className="mt-0.5 rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 shrink-0 cursor-pointer"
                          />
                          <span
                            className={`flex-1 leading-relaxed ${
                              item.completed ? "line-through text-text-dim font-medium" : "font-normal"
                            }`}
                          >
                            {item.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-5 text-center space-y-2">
                    <ClipboardCheck className="size-6 text-text-dim mx-auto opacity-50" />
                    <p className="text-xs text-text-dim">
                      No deliverables checklist detected in task scope.
                    </p>
                    <p className="text-[11px] text-text-dim/80">
                      You can add deliverables from the Overview tab, or evaluate the narrative scope directly.
                    </p>
                  </div>
                )}
              </div>

              {/* CARD B: Daily Work Submissions & Accountability */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-primary" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-text">
                      Daily Work Updates & Reports ({allUpdates.length})
                    </h4>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowReqUpdateModal(true)}
                    className="h-6 px-2 text-[11px] text-amber-500 hover:bg-amber-500/10 cursor-pointer"
                  >
                    <Bell className="size-3 mr-1" /> Request Update
                  </Button>
                </div>

                {allUpdates.length > 0 ? (
                  <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                    {allUpdates.slice(0, 3).map((up) => (
                      <div
                        key={up.id}
                        className="rounded-lg border border-border/70 bg-background/50 p-3 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between text-[11px] border-b border-border/40 pb-1.5">
                          <div className="flex items-center gap-1.5 font-semibold text-text">
                            <Avatar className="size-4">
                              <AvatarFallback className="text-[8px]">
                                {(up.user?.firstName?.[0] || "?").toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>
                              {up.user?.firstName} {up.user?.lastName}
                            </span>
                          </div>
                          <span className="text-text-dim font-mono">
                            {new Date(up.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-text text-xs whitespace-pre-wrap leading-relaxed">
                          {up.content}
                        </p>
                      </div>
                    ))}
                    {allUpdates.length > 3 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab("timelogs")}
                        className="text-xs text-primary hover:underline font-semibold text-center block w-full py-1 cursor-pointer"
                      >
                        View all {allUpdates.length} daily work updates →
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-center space-y-2">
                    <AlertTriangle className="size-6 text-amber-400 mx-auto" />
                    <p className="text-xs font-semibold text-amber-400">
                      No Daily Work Updates Logged
                    </p>
                    <p className="text-[11px] text-text-dim">
                      The task completion gate requires assignees to log at least one work report.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowReqUpdateModal(true)}
                      className="h-7 text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10 cursor-pointer"
                    >
                      <Bell className="size-3 mr-1" /> Send Update Request to Assignee
                    </Button>
                  </div>
                )}
              </div>

              {/* CARD C: Time Logs Audit & Review */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-emerald-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-text">
                      Time Logs & Review ({allTimeLogs.length})
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-emerald-400">
                      {(totalLoggedMinutes / 60).toFixed(1)} hrs total
                    </span>
                    {pendingTimeLogs.length > 0 && isManagerOrAdmin && (
                      <Button
                        size="sm"
                        onClick={handleBatchApproveTimeLogs}
                        disabled={isBatchApprovingTimeLogs}
                        className="h-6 px-2 text-[10px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-xs"
                      >
                        <Check className="size-3 mr-1" /> Approve All ({pendingTimeLogs.length})
                      </Button>
                    )}
                  </div>
                </div>

                {allTimeLogs.length > 0 ? (
                  <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                    {allTimeLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border/70 bg-background/50 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="size-5 shrink-0">
                            <AvatarFallback className="text-[9px]">
                              {(log.user?.firstName?.[0] || "?").toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-text truncate">
                                {log.user?.firstName} {log.user?.lastName}
                              </span>
                              <span className="text-[10px] text-text-dim font-mono">
                                ({log.date})
                              </span>
                            </div>
                            {log.note && (
                              <p className="text-[11px] text-text-dim truncate max-w-[220px]">
                                {log.note}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono font-bold text-emerald-400 text-xs">
                            {(log.minutes / 60).toFixed(1)} hrs
                          </span>

                          {isManagerOrAdmin ? (
                            <div className="flex items-center gap-1">
                              <Badge
                                variant="outline"
                                className={`text-[9px] font-bold ${
                                  log.status === "APPROVED"
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                    : log.status === "REJECTED"
                                    ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                    : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                }`}
                              >
                                {log.status || "PENDING"}
                              </Badge>

                              {log.status !== "APPROVED" && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateTimeLogStatus(log.id, "APPROVED")}
                                  className="h-6 w-6 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 flex items-center justify-center cursor-pointer transition-colors"
                                  title="Approve this time log"
                                >
                                  <Check className="size-3" />
                                </button>
                              )}
                              {log.status !== "REJECTED" && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateTimeLogStatus(log.id, "REJECTED")}
                                  className="h-6 w-6 rounded border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 flex items-center justify-center cursor-pointer transition-colors"
                                  title="Reject this time log"
                                >
                                  <X className="size-3" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <Badge
                              variant="outline"
                              className={`text-[9px] font-bold ${
                                log.status === "APPROVED"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                  : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              }`}
                            >
                              {log.status || "PENDING"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-center space-y-2">
                    <Clock className="size-6 text-amber-400 mx-auto" />
                    <p className="text-xs font-semibold text-amber-400">No Time Logs Recorded</p>
                    <p className="text-[11px] text-text-dim">
                      Task completion requires at least one time log recorded for accountability.
                    </p>
                  </div>
                )}
              </div>

              {/* CARD D: Defects, Bugs & Subtasks Status */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <BugIcon className="size-4 text-amber-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-text">
                      Defect Clearance & Subtasks
                    </h4>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowBugForm(true)}
                    className="h-6 px-2 text-[11px] text-primary hover:bg-primary/10 cursor-pointer"
                  >
                    <Plus className="size-3 mr-1" /> Log Finding
                  </Button>
                </div>

                <div className="space-y-3">
                  {/* Bugs Status */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-text">Defect Resolution</span>
                      <span
                        className={`font-mono text-[11px] font-bold ${
                          openBugsCount === 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {openBugsCount === 0 ? "Zero Open Bugs (Clean)" : `${openBugsCount} Unresolved`}
                      </span>
                    </div>

                    {allTaskBugs.length > 0 ? (
                      <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                        {allTaskBugs.map((bug) => (
                          <div
                            key={bug.id}
                            className={`flex items-center justify-between p-2 rounded-lg border text-xs ${
                              bug.status === "CLOSED" || bug.status === "FIXED"
                                ? "bg-emerald-500/5 border-emerald-500/20 text-text-dim"
                                : "bg-rose-500/5 border-rose-500/30 text-text"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono font-bold text-[10px] text-text-dim">
                                #{bug.bugNumber}
                              </span>
                              <span className="truncate max-w-[200px]">{bug.title}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className={`text-[9px] font-bold ${
                                  bug.status === "CLOSED" || bug.status === "FIXED"
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                    : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                }`}
                              >
                                {BUG_STATUS_LABELS[bug.status]}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-text-dim italic">
                        No defects or bugs reported on this task.
                      </p>
                    )}
                  </div>

                  {/* Subtasks Summary */}
                  {detailedTask.subtasks && detailedTask.subtasks.length > 0 && (
                    <div className="pt-2 border-t border-border/50">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-text">Subtasks Completion</span>
                        <span className="font-mono text-[11px] font-bold text-purple-400">
                          {detailedTask.subtasks.filter((st) => st.status === "DONE").length} /{" "}
                          {detailedTask.subtasks.length} Done
                        </span>
                      </div>
                      <div className="space-y-1 max-h-[100px] overflow-y-auto pr-1">
                        {detailedTask.subtasks.map((st) => (
                          <div
                            key={st.id}
                            className="flex items-center justify-between p-1.5 text-xs text-text-dim"
                          >
                            <span className="truncate max-w-[220px]">{st.title}</span>
                            <Badge variant="outline" className="text-[9px]">
                              {TASK_STATUS_LABELS[st.status]}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Official Reviewer Signoff Console */}
            <div className="rounded-2xl border border-purple-500/30 bg-card p-6 shadow-md space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
                <div className="flex items-center gap-2.5">
                  <ShieldAlert className="size-5 text-purple-400" />
                  <div>
                    <h3 className="text-sm font-bold text-text">Reviewer Verdict & Signoff Console</h3>
                    <p className="text-xs text-text-dim">
                      Record formal review notes, assign testing ownership, and issue completion decision
                    </p>
                  </div>
                </div>

                {/* Reviewer Selector */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-text-dim font-medium">Designated Reviewer:</span>
                  <select
                    value={detailedTask.testerId || ""}
                    onChange={(e) => handleAssignReviewer(e.target.value || null)}
                    className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-text cursor-pointer font-medium"
                  >
                    <option value="">Unassigned Reviewer</option>
                    {allUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} ({u.role.name})
                      </option>
                    ))}
                  </select>
                  {currentUser?.id && detailedTask.testerId !== currentUser.id && isManagerOrAdmin && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleAssignReviewer(currentUser.id)}
                      className="h-7 px-2 text-[11px] text-primary hover:bg-primary/10 cursor-pointer"
                    >
                      Assign to Me
                    </Button>
                  )}
                </div>
              </div>

              {/* Review Notes & Findings */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-text flex items-center gap-1.5">
                    <span>Review Findings & Quality Notes (testingNotes)</span>
                    {detailedTask.testingApproved && (
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                        Signoff Approved
                      </Badge>
                    )}
                  </label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleSaveReviewNotes}
                    className="h-6 px-2 text-[11px] text-purple-400 hover:bg-purple-500/10 cursor-pointer"
                  >
                    Save Notes
                  </Button>
                </div>

                {/* Quick Preset Feedback Chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-text-dim uppercase font-semibold">Templates:</span>
                  {[
                    "✅ Deliverables verified & quality standards met.",
                    "⏱️ Time logs audited and reconciled with scope.",
                    "⚠️ Revisions required: please resolve the noted checklist items.",
                    "🚀 Tested in staging environment. Verification passed.",
                  ].map((preset, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        setTaskReviewNotes((prev) =>
                          prev ? `${prev}\n${preset}` : preset,
                        )
                      }
                      className="px-2 py-0.5 rounded-md border border-border/80 bg-background/80 hover:bg-card text-[10px] text-text-dim hover:text-text cursor-pointer transition-all"
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <Textarea
                  value={taskReviewNotes}
                  onChange={(e) => setTaskReviewNotes(e.target.value)}
                  placeholder="Enter quality verification findings, feedback for assignees, testing notes, or signoff approval comments..."
                  className="min-h-[90px] text-xs font-normal"
                />
              </div>

              {/* Decision Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/60">
                <div className="flex items-center gap-2 text-xs text-text-dim">
                  <ShieldCheck className="size-4 text-purple-400" />
                  <span>
                    Signoff Authority:{" "}
                    <strong className="text-text">
                      {isTester ? "Designated Tester" : isManagerOrAdmin ? "Admin / Manager" : "Team Member"}
                    </strong>
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <Button
                    variant="outline"
                    onClick={() => setShowReqUpdateModal(true)}
                    className="h-9 px-3 text-xs font-semibold gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 cursor-pointer"
                  >
                    <Bell className="size-3.5" />
                    Request Update
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => setShowChangeRequestDialog(true)}
                    disabled={isSubmittingReview}
                    className="h-9 px-3 text-xs font-semibold gap-1.5 border-rose-500/40 text-rose-400 hover:bg-rose-500/10 cursor-pointer shadow-xs"
                  >
                    <AlertTriangle className="size-3.5" />
                    Request Revisions / Changes
                  </Button>

                  <Button
                    onClick={() => handleApproveAndCompleteTask(false)}
                    disabled={isSubmittingReview}
                    className="h-9 px-4 text-xs font-bold gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white cursor-pointer shadow-md"
                  >
                    <CheckCircle2 className="size-4" />
                    {isSubmittingReview ? "Processing..." : "Approve & Mark Completed"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PANEL 3: AUDIT HISTORY */}
        {activeTab === "activity" && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-text">Activity Timeline</h3>
            {detailedTask.activityLogs && detailedTask.activityLogs.length > 0 ? (
              <div className="relative border-l border-border pl-6 space-y-6">
                {detailedTask.activityLogs.map((log) => (
                  <div key={log.id} className="relative">
                    <span className="absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px]">
                      •
                    </span>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-text">{log.action}</span>
                        <span className="text-[11px] text-text-dim font-mono">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-text">{log.details}</p>
                      <span className="text-[11px] text-text-dim">
                        By: {log.user.firstName} {log.user.lastName}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-xs italic text-text-dim">
                No activity logs recorded yet.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Task Two-Way Communication Modal */}
      {showCommModal && (
        <TaskCommunicationModal
          taskId={taskId}
          open={showCommModal}
          onOpenChange={setShowCommModal}
        />
      )}

      {/* Manager Update Request Confirmation Dialog */}
      {showReqUpdateModal && detailedTask && (
        <TaskRequestUpdateDialog
          taskId={taskId}
          taskTitle={detailedTask.title}
          employeeName={
            detailedTask.assignee
              ? `${detailedTask.assignee.firstName} ${detailedTask.assignee.lastName}`
              : "Assigned employee"
          }
          open={showReqUpdateModal}
          onOpenChange={setShowReqUpdateModal}
        />
      )}

      {/* Task Delete Confirmation Dialog */}
      {showDeleteConfirm && detailedTask && (
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-rose-500">
                <Trash2 className="size-5" />
                Delete Task #{detailedTask.taskNumber}?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-text-dim space-y-2">
                <span>Are you sure you want to permanently delete:</span>
                <span className="block font-semibold text-text text-sm p-2.5 bg-muted/40 rounded-lg border border-border">
                  {detailedTask.title}
                </span>
                <span className="block text-rose-400 font-medium text-[11px]">
                  This action cannot be undone. All deliverables, subtasks, bug logs, and time logs will be deleted.
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
                    await deleteTask.mutateAsync({
                      id: taskId,
                      projectId: detailedTask.projectId,
                    });
                    toast.success(`Task #${detailedTask.taskNumber} deleted successfully`);
                    setShowDeleteConfirm(false);
                    if (onClose) onClose();
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
      {/* Review Revisions / Changes Request Dialog */}
      {showChangeRequestDialog && detailedTask && (
        <Dialog open={showChangeRequestDialog} onOpenChange={setShowChangeRequestDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-rose-500">
                <AlertTriangle className="size-5" />
                Request Changes & Revisions
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted/40 rounded-lg border border-border text-xs space-y-1">
                <div className="font-semibold text-text">
                  Task #{detailedTask.taskNumber}: {detailedTask.title}
                </div>
                <div className="text-text-dim text-[11px]">
                  Assignee:{" "}
                  <strong className="text-text">
                    {detailedTask.assignee
                      ? `${detailedTask.assignee.firstName} ${detailedTask.assignee.lastName}`
                      : "Team Member"}
                  </strong>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="changeReason" className="text-xs font-semibold text-text">
                  Revision Instructions & Required Improvements <span className="text-rose-400">*</span>
                </Label>
                <Textarea
                  id="changeReason"
                  rows={4}
                  placeholder="Specify what deliverables need changes, missing requirements, defect details, or test failures..."
                  value={changeRequestReason}
                  onChange={(e) => setChangeRequestReason(e.target.value)}
                  className="text-xs"
                />
              </div>

              {/* Quick Preset Reasons */}
              <div className="space-y-1">
                <span className="text-[10px] text-text-dim uppercase font-semibold">Quick Reasons:</span>
                <div className="flex flex-wrap gap-1">
                  {[
                    "Missing daily work updates",
                    "Unverified deliverables in checklist",
                    "Please log corresponding time entry",
                    "Defect found during QA testing",
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() =>
                        setChangeRequestReason((prev) =>
                          prev ? `${prev}\n• ${preset}` : `• ${preset}`,
                        )
                      }
                      className="px-2 py-0.5 rounded text-[10px] bg-muted hover:bg-muted/80 text-text-dim hover:text-text border border-border/60 cursor-pointer"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowChangeRequestDialog(false)}
                disabled={isSubmittingReview}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleRequestChanges}
                disabled={isSubmittingReview || !changeRequestReason.trim()}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold gap-1.5 cursor-pointer shadow-xs"
              >
                <AlertTriangle className="size-3.5" />
                {isSubmittingReview ? "Sending..." : "Submit Change Request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Admin Override Confirmation Dialog */}
      {showAdminOverrideConfirm && detailedTask && (
        <AlertDialog open={showAdminOverrideConfirm} onOpenChange={setShowAdminOverrideConfirm}>
          <AlertDialogContent className="max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-amber-500">
                <ShieldAlert className="size-5" />
                Admin Override: Quality Gates Incomplete
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-text-dim space-y-3 pt-2">
                <span>
                  The following requirements have not been fully satisfied before completing Task #{detailedTask.taskNumber}:
                </span>
                <ul className="list-disc pl-5 space-y-1 text-amber-400 font-medium text-xs bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                  {overrideBlockers.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
                <span className="block text-text font-normal">
                  As an Administrator/Manager, you have the authority to bypass these gates and force completion signoff. Do you want to proceed?
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={isSubmittingReview}
                onClick={() => setShowAdminOverrideConfirm(false)}
                className="text-xs cursor-pointer"
              >
                Review Requirements
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={isSubmittingReview}
                onClick={() => handleApproveAndCompleteTask(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold gap-1.5 cursor-pointer"
              >
                <ShieldCheck className="size-3.5" />
                {isSubmittingReview ? "Completing..." : "Force Admin Signoff & Complete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
