import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Code2,
  DollarSign,
  FileCheck,
  Folder,
  Layers,
  ListTodo,
  Loader2,
  Plus,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Sparkles,
  Tag,
  Target,
  TrendingUp,
  User,
  UserCheck,
  Users,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateTask } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { useTaskLists } from "@/hooks/use-task-lists";
import { useSprints } from "@/hooks/use-sprints";
import { useUsers } from "@/hooks/use-users";
import { useDepartments } from "@/hooks/use-departments";
import { useAuthStore } from "@/stores/auth-store";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_TYPES,
  type TaskPriority,
  type TaskStatus,
  type TaskType,
} from "@/lib/api/types";
import { getInitials } from "@/lib/utils";

interface CreateTaskPanelProps {
  onBack: () => void;
  onCreated?: (taskId: string) => void;
  defaultProjectId?: string;
  defaultSprintId?: string;
  defaultDepartmentId?: string;
}

interface TaskDeptProfile {
  key: string;
  name: string;
  icon: string;
  badgeTone: string;
  themeGradient: string;
  borderColor: string;
  focusSummary: string;
  assigneeLabel: string;
  reviewerLabel: string;
  effortLabel: string;
  categoryPresets: Array<{ id: TaskType; label: string; icon: string; example: string }>;
  defaultChecklist: string[];
  defaultTags: string[];
}

const TASK_DEPT_PROFILES: Record<string, TaskDeptProfile> = {
  dev: {
    key: "dev",
    name: "Software & Engineering",
    icon: "💻",
    badgeTone: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    themeGradient: "from-blue-600/20 via-indigo-600/10 to-transparent",
    borderColor: "border-blue-500/30 hover:border-blue-500",
    focusSummary: "Sprint stories, API endpoints, bug patches, PR reviews & cloud infra tasks",
    assigneeLabel: "Primary Developer / Engineer",
    reviewerLabel: "Code Reviewer / QA Lead",
    effortLabel: "Story Points / Dev Effort",
    categoryPresets: [
      { id: "FEATURE", label: "Feature Development", icon: "💻", example: "Implement JWT authentication interceptor & refresh flow" },
      { id: "BUG", label: "Bug Fix & Patch", icon: "🐛", example: "Fix race condition in database websocket synchronization" },
      { id: "REFACTOR", label: "Refactoring & Tech Debt", icon: "⚡", example: "Optimize PostgreSQL query indexing for company lookup" },
      { id: "CHORE", label: "DevOps & Tooling", icon: "⚙️", example: "Upgrade Docker deployment images and configure Sentry logging" },
    ],
    defaultChecklist: [
      "Review architectural RFC and requirements",
      "Implement core logic and write unit tests (>80% coverage)",
      "Create pull request with descriptive test cases",
      "Pass QA verification and merge to staging",
    ],
    defaultTags: ["Engineering", "Sprint-Ready"],
  },
  sales: {
    key: "sales",
    name: "Sales & Commercial Accounts",
    icon: "💰",
    badgeTone: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    themeGradient: "from-emerald-600/20 via-teal-600/10 to-transparent",
    borderColor: "border-emerald-500/30 hover:border-emerald-500",
    focusSummary: "Lead qualification, commercial pitches, contract negotiation & executive follow-up",
    assigneeLabel: "Account Executive / Deal Lead",
    reviewerLabel: "Sales Manager / Commercial Approver",
    effortLabel: "Estimated Commercial Hours",
    categoryPresets: [
      { id: "FEATURE", label: "Lead Qualification & Discovery", icon: "🔍", example: "Conduct discovery call with VP of Technology at Acme Corp" },
      { id: "CHORE", label: "Demo & Pitch Presentation", icon: "🗓️", example: "Deliver custom product demonstration to Enterprise evaluation committee" },
      { id: "REFACTOR", label: "Proposal & Pricing Matrix", icon: "📄", example: "Draft customized commercial quote with annual volume discount" },
      { id: "BUG", label: "Deal Follow-up & Contract Closing", icon: "💬", example: "Follow up with legal counsel on redlined Master Services Agreement" },
    ],
    defaultChecklist: [
      "Identify buyer pain points, budget, and decision timeframe",
      "Deliver tailored capability demo addressing key requirements",
      "Submit commercial proposal and scope schedule",
      "Secure executive verbal agreement and send for e-signature",
    ],
    defaultTags: ["Sales", "Pipeline", "High-Value"],
  },
  hr: {
    key: "hr",
    name: "Recruitment & Talent Acquisition",
    icon: "👥",
    badgeTone: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    themeGradient: "from-purple-600/20 via-pink-600/10 to-transparent",
    borderColor: "border-purple-500/30 hover:border-purple-500",
    focusSummary: "Candidate sourcing, technical screenings, client interviews & eBoarding packets",
    assigneeLabel: "Primary Recruiter / Talent Lead",
    reviewerLabel: "Hiring Manager / Team Approver",
    effortLabel: "Sourcing & Screening Effort",
    categoryPresets: [
      { id: "FEATURE", label: "Candidate Sourcing & Screening", icon: "🔍", example: "Screen and shortlist candidates for JPC-480 (Mechanical Design Technologist)" },
      { id: "CHORE", label: "Interview & Client Scheduling", icon: "🗓️", example: "Coordinate Technical Interview with Niagara Health for Sarah Chen" },
      { id: "REFACTOR", label: "Offer & eBoarding Packet", icon: "📄", example: "Dispatch and track eBoarding document packet for David Miller" },
      { id: "BUG", label: "Client & Candidate Follow-up", icon: "💬", example: "Follow up with client hiring manager on pending candidate feedback" },
    ],
    defaultChecklist: [
      "Review client job requisition specs and target criteria",
      "Source 10+ matching profiles and conduct 30-min phone screens",
      "Submit shortlisted candidate profiles with interview notes",
      "Coordinate client technical interview and follow up within 24h",
    ],
    defaultTags: ["Recruitment", "Priority-Req", "Candidate-Pipeline"],
  },
  marketing: {
    key: "marketing",
    name: "Marketing & Growth",
    icon: "🚀",
    badgeTone: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    themeGradient: "from-rose-600/20 via-orange-600/10 to-transparent",
    borderColor: "border-rose-500/30 hover:border-rose-500",
    focusSummary: "Campaign copywriting, SEO optimization, ad creative design & webinar launches",
    assigneeLabel: "Campaign Strategist / Copywriter",
    reviewerLabel: "Marketing Director / Creative Approver",
    effortLabel: "Creative Effort Hours",
    categoryPresets: [
      { id: "FEATURE", label: "Campaign Strategy & Concept", icon: "🎨", example: "Develop Q4 enterprise campaign theme and multi-channel asset plan" },
      { id: "CHORE", label: "Copywriting & Content Production", icon: "✍️", example: "Write 3 long-form thought leadership articles targeting CTOs" },
      { id: "REFACTOR", label: "SEO Audit & Keyword Optimization", icon: "📈", example: "Optimize CRM landing page on-page SEO and schema metadata" },
      { id: "BUG", label: "Ad Performance & A/B Testing", icon: "🎯", example: "A/B test LinkedIn sponsored ad headlines and conversion landing page" },
    ],
    defaultChecklist: [
      "Draft creative brief aligned with ICP and buyer persona",
      "Produce copy assets, banners, and video collateral",
      "Review copy compliance and schedule multi-channel distribution",
      "Monitor CTR, conversions, and prepare ROI retrospective",
    ],
    defaultTags: ["Marketing", "Growth-Sprint", "Content"],
  },
  operations: {
    key: "operations",
    name: "Operations & Customer Success",
    icon: "🛡️",
    badgeTone: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    themeGradient: "from-amber-600/20 via-yellow-600/10 to-transparent",
    borderColor: "border-amber-500/30 hover:border-amber-500",
    focusSummary: "Client onboarding, SOP documentation, system integrations & SLA management",
    assigneeLabel: "Operations Specialist / CS Manager",
    reviewerLabel: "VP Operations / Compliance Approver",
    effortLabel: "Operational Effort Hours",
    categoryPresets: [
      { id: "FEATURE", label: "Client Workflow Setup", icon: "🛠️", example: "Configure custom workspace pipelines and user roles for Acme Corp" },
      { id: "CHORE", label: "SOP & Documentation Writing", icon: "📄", example: "Document standard operating procedure for data migration audits" },
      { id: "REFACTOR", label: "Workflow & Tool Automation", icon: "⚡", example: "Automate email webhook ingestion and task auto-assignment" },
      { id: "BUG", label: "Incident Resolution & SLA Guard", icon: "🛡️", example: "Investigate high-priority telephony latency ticket for sales team" },
    ],
    defaultChecklist: [
      "Assess operational scope and dependencies",
      "Draft standard operating procedure (SOP)",
      "Test execution in staging / sandbox environment",
      "Deploy workflow live and update team training knowledge base",
    ],
    defaultTags: ["Operations", "SOP", "SLA-Critical"],
  },
  executive: {
    key: "executive",
    name: "Executive & Strategic Workspace",
    icon: "🏛️",
    badgeTone: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
    themeGradient: "from-indigo-600/20 via-violet-600/10 to-transparent",
    borderColor: "border-indigo-500/30 hover:border-indigo-500",
    focusSummary: "Strategic OKRs, board governance, cross-functional reviews & corporate milestones",
    assigneeLabel: "Initiative Owner / Exec Sponsor",
    reviewerLabel: "Executive Committee / Board",
    effortLabel: "Strategic Priority Level",
    categoryPresets: [
      { id: "FEATURE", label: "Strategic OKR Objective", icon: "🎯", example: "Deliver Q3 revenue expansion milestone across key enterprise sectors" },
      { id: "CHORE", label: "Executive Review & Governance", icon: "📑", example: "Prepare executive briefing deck for upcoming quarterly board meeting" },
      { id: "REFACTOR", label: "Resource & Budget Allocation", icon: "💼", example: "Review annual software tool licensing and departmental budget allocations" },
      { id: "BUG", label: "Strategic Blocker Resolution", icon: "⚡", example: "Resolve inter-departmental roadblock on data compliance requirements" },
    ],
    defaultChecklist: [
      "Define strategic objectives, success criteria, and key metrics",
      "Coordinate cross-functional alignment meeting with division leads",
      "Deliver strategic initiative documentation and milestones",
      "Present executive review summary to senior leadership",
    ],
    defaultTags: ["Executive", "Strategic-OKR", "Leadership"],
  },
};

const EFFORT_HOURS_PRESETS = [
  { points: 1, label: "1 hr" },
  { points: 2, label: "2 hrs" },
  { points: 4, label: "4 hrs" },
  { points: 8, label: "1 day" },
  { points: 16, label: "2 days" },
  { points: 24, label: "3 days" },
];

const UNASSIGNED = "__unassigned__";
const NO_PROJECT = "__none__";
const NO_TASK_LIST = "__none__";
const NO_SPRINT = "__none__";

export const CreateTaskPanel: React.FC<CreateTaskPanelProps> = ({
  onBack,
  onCreated,
  defaultProjectId,
  defaultSprintId,
  defaultDepartmentId,
}) => {
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role.name === "ADMIN";

  const createTask = useCreateTask();
  const { data: users = [] } = useUsers();
  const { data: departments = [] } = useDepartments();

  const getProfileKeyFromDept = (deptNameOrId?: string): string => {
    if (!deptNameOrId) return "dev";
    const name = (departments.find((d) => d.id === deptNameOrId)?.name || deptNameOrId).toLowerCase();
    if (name.includes("dev") || name.includes("tech") || name.includes("eng") || name.includes("software")) return "dev";
    if (name.includes("sale") || name.includes("crm") || name.includes("account") || name.includes("deal")) return "sales";
    if (name.includes("hr") || name.includes("recruit") || name.includes("talent") || name.includes("staff")) return "hr";
    if (name.includes("market") || name.includes("growth") || name.includes("brand")) return "marketing";
    if (name.includes("op") || name.includes("support") || name.includes("succ") || name.includes("custom")) return "operations";
    return "executive";
  };

  const initialDeptId = defaultDepartmentId || currentUser?.department?.id || "";
  const [isSelectingDepartment, setIsSelectingDepartment] = useState(() => {
    return isAdmin && !defaultDepartmentId && !defaultProjectId;
  });

  const [activeProfileKey, setActiveProfileKey] = useState<string>(() =>
    getProfileKeyFromDept(initialDeptId || currentUser?.department?.id)
  );
  const [selectedDeptId, setSelectedDeptId] = useState<string>(initialDeptId);

  const activeProfile = TASK_DEPT_PROFILES[activeProfileKey] || TASK_DEPT_PROFILES.dev;

  // Projects filtered by selected department
  const { data: allProjects = [] } = useProjects();
  const filteredProjects = useMemo(() => {
    if (!selectedDeptId) return allProjects;
    return allProjects.filter((p) => !p.departmentId || p.departmentId === selectedDeptId);
  }, [allProjects, selectedDeptId]);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<TaskType>("FEATURE");
  const [status, setStatus] = useState<TaskStatus>("TODO");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [storyPoints, setStoryPoints] = useState<number>(2);

  // Project & Sprints
  const [projectId, setProjectId] = useState<string>(defaultProjectId || NO_PROJECT);
  const [taskListId, setTaskListId] = useState<string>(NO_TASK_LIST);
  const [sprintId, setSprintId] = useState<string>(defaultSprintId || NO_SPRINT);

  const { data: taskLists = [] } = useTaskLists(projectId !== NO_PROJECT ? projectId : undefined);
  const { data: sprints = [] } = useSprints(projectId !== NO_PROJECT ? projectId : undefined);

  // Dates & Times
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("09:00");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [dueTime, setDueTime] = useState("18:00");

  // Assignees
  const [primaryAssigneeId, setPrimaryAssigneeId] = useState<string>(currentUser?.id || UNASSIGNED);
  const [testerId, setTesterId] = useState<string>(UNASSIGNED);
  const [secondaryAssigneeIds, setSecondaryAssigneeIds] = useState<string[]>([]);
  const [selectedSecondaryToAdd, setSelectedSecondaryToAdd] = useState("");
  const [showAllUsers, setShowAllUsers] = useState(false);

  // Tags & Acceptance criteria
  const [tags, setTags] = useState<string[]>(activeProfile.defaultTags);
  const [newTagInput, setNewTagInput] = useState("");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState<string[]>(activeProfile.defaultChecklist);
  const [newCriteriaInput, setNewCriteriaInput] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // When switching department
  const handleSelectDepartment = (profileKey: string, dbDeptId?: string) => {
    setActiveProfileKey(profileKey);
    const prof = TASK_DEPT_PROFILES[profileKey] || TASK_DEPT_PROFILES.dev;

    const matchingDbDept = dbDeptId
      ? departments.find((d) => d.id === dbDeptId)
      : departments.find((d) => getProfileKeyFromDept(d.id) === profileKey);

    setSelectedDeptId(matchingDbDept?.id || dbDeptId || "");
    setTags(prof.defaultTags);
    setAcceptanceCriteria(prof.defaultChecklist);
    setType(prof.categoryPresets[0]?.id || "FEATURE");
    setIsSelectingDepartment(false);
    toast.success(`Configured Task Builder for ${prof.name}`);
  };

  // Filter users by selected department
  const isManager = currentUser?.role.name === "MANAGER";
  // Teams a Manager can hand work to besides their own department.
  const crossTeamNames = ["Dev", "Sales"];
  const availableUsers = useMemo(() => {
    if (showAllUsers || !selectedDeptId) return users;
    const deptUsers = users.filter(
      (u) =>
        u.department?.id === selectedDeptId ||
        (isManager && crossTeamNames.includes(u.department?.name ?? "")),
    );
    return deptUsers.length > 0 ? deptUsers : users;
  }, [users, selectedDeptId, showAllUsers, isManager]);

  // Whole teams a Manager/Admin can add in one click.
  const assignableTeams = useMemo(() => {
    if (!isAdmin && !isManager) return [];
    return departments
      .filter((d) => isAdmin || crossTeamNames.includes(d.name) || d.id === currentUser?.department?.id)
      .map((d) => ({ id: d.id, name: d.name, members: users.filter((u) => u.department?.id === d.id) }))
      .filter((t) => t.members.length > 0);
  }, [departments, users, isAdmin, isManager, currentUser?.department?.id]);

  const selectedSecondaries = useMemo(() => {
    return users.filter((u) => secondaryAssigneeIds.includes(u.id));
  }, [users, secondaryAssigneeIds]);

  const addableSecondaries = useMemo(() => {
    return availableUsers.filter(
      (u) => !secondaryAssigneeIds.includes(u.id) && u.id !== primaryAssigneeId
    );
  }, [availableUsers, secondaryAssigneeIds, primaryAssigneeId]);

  // Handlers
  const handleAddCriteria = () => {
    if (!newCriteriaInput.trim()) return;
    setAcceptanceCriteria((prev) => [...prev, newCriteriaInput.trim()]);
    setNewCriteriaInput("");
  };

  const handleRemoveCriteria = (index: number) => {
    setAcceptanceCriteria((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddTag = () => {
    if (!newTagInput.trim()) return;
    if (tags.includes(newTagInput.trim())) {
      toast.info("Tag already exists");
      return;
    }
    setTags((prev) => [...prev, newTagInput.trim()]);
    setNewTagInput("");
  };

  const handleRemoveTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleAddSecondary = () => {
    if (!selectedSecondaryToAdd) return;
    if (!secondaryAssigneeIds.includes(selectedSecondaryToAdd)) {
      setSecondaryAssigneeIds((prev) => [...prev, selectedSecondaryToAdd]);
    }
    setSelectedSecondaryToAdd("");
  };

  const handleAddTeam = (memberIds: string[]) => {
    setSecondaryAssigneeIds((prev) => {
      const next = new Set(prev);
      memberIds.filter((id) => id !== primaryAssigneeId).forEach((id) => next.add(id));
      return Array.from(next);
    });
  };

  const handleRemoveSecondary = (userId: string) => {
    setSecondaryAssigneeIds((prev) => prev.filter((id) => id !== userId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage("Task title is required.");
      toast.error("Please enter a task title.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      // Append checklist to description if present
      let finalDescription = description.trim();
      if (acceptanceCriteria.length > 0) {
        const checklistText = "\n\n**Key Deliverables & Action Items:**\n" +
          acceptanceCriteria.map((c) => `• [ ] ${c}`).join("\n");
        finalDescription += checklistText;
      }

      const created = await createTask.mutateAsync({
        title: title.trim(),
        description: finalDescription || undefined,
        type,
        status,
        priority,
        storyPoints: storyPoints || undefined,
        projectId: projectId !== NO_PROJECT ? projectId : undefined,
        taskListId: taskListId !== NO_TASK_LIST ? taskListId : undefined,
        sprintId: sprintId !== NO_SPRINT ? sprintId : undefined,
        assigneeId: primaryAssigneeId !== UNASSIGNED ? primaryAssigneeId : undefined,
        assigneeIds:
          secondaryAssigneeIds.length > 0
            ? Array.from(
                new Set([
                  ...(primaryAssigneeId !== UNASSIGNED ? [primaryAssigneeId] : []),
                  ...secondaryAssigneeIds,
                ]),
              )
            : undefined,
        testerId: testerId !== UNASSIGNED ? testerId : undefined,
        startDate: startDate ? new Date(`${startDate}T${startTime || "00:00"}:00`).toISOString() : undefined,
        dueDate: dueDate ? new Date(`${dueDate}T${dueTime || "23:59"}:00`).toISOString() : undefined,
        tags: tags.length > 0 ? tags : undefined,
      });

      toast.success("Task created and assigned successfully!");
      if (onCreated) {
        onCreated(created.id);
      }
      onBack();
    } catch (err: any) {
      const msg = err?.message || "Failed to create task.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. DEPARTMENT SELECTION SCREEN (Admin First Step)
  // ─────────────────────────────────────────────────────────────────────────────
  if (isSelectingDepartment) {
    return (
      <div className="min-h-screen bg-canvas text-foreground pb-20 selection:bg-primary/20">
        {/* Sticky Header */}
        <div className="sticky top-0 z-30 bg-panel/90 backdrop-blur-md border-b border-border px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="gap-2 text-text-dim hover:text-foreground -ml-2"
            >
              <ArrowLeft className="size-4" />
              <span>Back</span>
            </Button>
            <div className="h-4 w-px bg-border hidden sm:block" />
            <div>
              <h1 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                <span>Select Department Workspace</span>
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                  Step 1 of 2
                </Badge>
              </h1>
              <p className="text-xs text-text-dim">
                Choose the department to initialize the tailored task assignment interface and team roster
              </p>
            </div>
          </div>
        </div>

        {/* Department Grid */}
        <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <div className="size-12 rounded-2xl bg-primary/10 border border-primary/20 mx-auto flex items-center justify-center text-primary shadow-inner">
              <ListTodo className="size-6" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Which department are you assigning tasks for?
            </h2>
            <p className="text-xs text-text-dim leading-relaxed">
              Venus CRM personalizes task categories, estimation metrics, action item templates, reviewer flows, and member lists specifically for the chosen division.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Object.entries(TASK_DEPT_PROFILES).map(([key, profile]) => {
              const matchedDb = departments.find((d) => getProfileKeyFromDept(d.id) === key);
              const memberCount = matchedDb
                ? users.filter((u) => u.department?.id === matchedDb.id).length
                : users.filter((u) => getProfileKeyFromDept(u.department?.name) === key).length;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectDepartment(key, matchedDb?.id)}
                  className={`p-6 rounded-2xl border bg-panel/80 hover:bg-panel transition-all duration-200 text-left shadow-sm group relative overflow-hidden flex flex-col justify-between ${profile.borderColor} hover:shadow-lg hover:-translate-y-0.5`}
                >
                  <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${profile.themeGradient} rounded-full blur-2xl pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity`} />
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="size-12 rounded-xl bg-secondary/80 border border-border flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform">
                        {profile.icon}
                      </div>
                      <Badge variant="outline" className={`text-[11px] font-semibold ${profile.badgeTone}`}>
                        {memberCount > 0 ? `${memberCount} members` : "Division"}
                      </Badge>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                        {profile.name}
                        <ChevronRight className="size-4 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1" />
                      </h3>
                      <p className="text-xs text-text-dim mt-1 line-clamp-2 leading-relaxed">
                        {profile.focusSummary}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-border/60 flex items-center justify-between text-xs text-text-dim">
                    <span className="font-medium text-foreground/80">{profile.categoryPresets.length} workflows</span>
                    <span className="text-primary font-semibold flex items-center gap-1">
                      Configure <ChevronRight className="size-3.5" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. TAILORED TASK BUILDER PANEL
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-canvas text-foreground pb-20 selection:bg-primary/20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-panel/90 backdrop-blur-md border-b border-border px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="gap-2 text-text-dim hover:text-foreground -ml-2"
          >
            <ArrowLeft className="size-4" />
            <span>Back</span>
          </Button>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-xl shadow-inner">
              {activeProfile.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-foreground">
                  New Task Builder
                </h1>
                <Badge variant="outline" className={`text-xs font-semibold ${activeProfile.badgeTone}`}>
                  {activeProfile.name}
                </Badge>
                {isAdmin && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsSelectingDepartment(true)}
                    className="h-6 px-2 text-[11px] font-semibold text-text-dim hover:text-primary hover:bg-primary/10 gap-1 rounded-md"
                  >
                    <RefreshCw className="size-3" />
                    <span>Switch Dept</span>
                  </Button>
                )}
              </div>
              <p className="text-xs text-text-dim">
                Tailored for {activeProfile.name} • {acceptanceCriteria.length} checklist items • {availableUsers.length} team members
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={onBack} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim()}
            className="gap-2 shadow-md bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
            <span>Create Task</span>
          </Button>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left 2 Columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Task Specification Card */}
            <div className="rounded-xl border border-border bg-panel/60 p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <ListTodo className="size-4 text-primary" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                    Task Specification
                  </h2>
                </div>
                <Badge variant="outline" className="text-[11px] font-medium bg-secondary/50">
                  Required Details
                </Badge>
              </div>

              {/* Task Title */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="task-title" className="text-xs font-semibold text-foreground">
                    Task Title <span className="text-destructive">*</span>
                  </Label>
                  <span className="text-[11px] text-text-dim font-mono">{title.length}/150</span>
                </div>
                <Input
                  id="task-title"
                  placeholder={`e.g. ${activeProfile.categoryPresets[0]?.example || "Enter task summary..."}`}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={150}
                  required
                  autoFocus
                  className="h-10 text-sm font-medium bg-secondary/40 border-border focus:border-primary"
                />
              </div>

              {/* Task Category Presets */}
              <div className="space-y-2.5">
                <Label className="text-xs font-semibold text-foreground">
                  Task Workflow Category
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeProfile.categoryPresets.map((preset) => {
                    const isSelected = type === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setType(preset.id);
                          if (!title) setTitle(preset.example);
                        }}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? "bg-primary/20 border-primary text-primary font-semibold shadow-sm"
                            : "bg-secondary/30 border-border text-text-dim hover:text-foreground hover:bg-secondary/60"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base">{preset.icon}</span>
                          <span className="text-xs font-bold">{preset.label}</span>
                        </div>
                        <div className="text-[10px] opacity-75 line-clamp-1 italic">
                          "{preset.example}"
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status, Priority, Effort */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-foreground">Status</Label>
                  <Select value={status} onValueChange={(v: TaskStatus) => setStatus(v)}>
                    <SelectTrigger className="h-10 text-xs bg-secondary/40 border-border font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {TASK_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-foreground">Priority</Label>
                  <Select value={priority} onValueChange={(v: TaskPriority) => setPriority(v)}>
                    <SelectTrigger className="h-10 text-xs bg-secondary/40 border-border font-medium">
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

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-foreground">{activeProfile.effortLabel}</Label>
                  <div className="flex flex-wrap gap-1">
                    {EFFORT_HOURS_PRESETS.map((eff) => (
                      <button
                        key={eff.points}
                        type="button"
                        onClick={() => setStoryPoints(eff.points)}
                        className={`text-[11px] px-2.5 py-1.5 rounded-lg border transition-all ${
                          storyPoints === eff.points
                            ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                            : "bg-secondary/30 border-border text-text-dim hover:text-foreground hover:bg-secondary/60"
                        }`}
                      >
                        {eff.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Description & Action Items Checklist */}
            <div className="rounded-xl border border-border bg-panel/60 p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <FileCheck className="size-4 text-primary" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                    Description & Action Items
                  </h2>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-primary">
                  <Sparkles className="size-3.5" />
                  <span>{activeProfile.name} SOPs</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-desc" className="text-xs font-medium text-foreground">
                  Task Details & Objectives
                </Label>
                <Textarea
                  id="task-desc"
                  placeholder={`Provide background context, requirements, client contact notes, or actionable next steps for ${activeProfile.name}...`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="text-sm bg-secondary/40 border-border resize-none leading-relaxed"
                />
              </div>

              {/* Action Items Checklist */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground">
                    Deliverables & Action Items Checklist ({acceptanceCriteria.length})
                  </Label>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        setAcceptanceCriteria([
                          "Screen candidate profiles against job specifications",
                          "Conduct technical evaluation & background screening",
                          "Submit candidate shortlist with executive notes",
                          "Coordinate hiring manager client interview",
                        ])
                      }
                      className="text-[11px] text-primary hover:underline cursor-pointer"
                    >
                      Recruitment Preset
                    </button>
                    {acceptanceCriteria.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setAcceptanceCriteria([])}
                        className="text-[11px] text-destructive hover:underline cursor-pointer ml-1"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  {acceptanceCriteria.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border text-xs text-foreground group"
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <CheckCircle2 className="size-4 text-primary shrink-0" />
                        {item}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCriteria(idx)}
                        className="text-text-dim hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity p-1"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}

                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      placeholder="Add an action item (e.g. Screen 5 candidate profiles, confirm interview schedule)..."
                      value={newCriteriaInput}
                      onChange={(e) => setNewCriteriaInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddCriteria();
                        }
                      }}
                      className="h-9 text-xs bg-secondary/40 border-border"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddCriteria}
                      className="h-9 text-xs gap-1 shrink-0"
                    >
                      <Plus className="size-3.5" /> Add Item
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Tags & Taxonomy */}
            <div className="rounded-xl border border-border bg-panel/60 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <Tag className="size-4 text-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-dim">
                  Tags & Metadata
                </h3>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-xs py-1 px-2.5 bg-secondary/60 text-foreground border border-border gap-1.5"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-destructive transition-colors"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Input
                  placeholder="Add custom tag (e.g. Priority-Req, High-Value-Client)..."
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  className="h-9 text-xs bg-secondary/40 border-border max-w-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddTag}
                  className="h-9 text-xs gap-1"
                >
                  <Plus className="size-3.5" /> Add Tag
                </Button>
              </div>
            </div>

            {errorMessage && (
              <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm font-medium flex items-center gap-2.5">
                <X className="size-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Primary Assignee Card */}
            <div className="rounded-xl border border-border bg-panel/60 p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <UserCheck className="size-4 text-primary" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-text-dim">
                    {activeProfile.assigneeLabel}
                  </h3>
                </div>
              </div>

              <div className="space-y-3">
                <Select value={primaryAssigneeId} onValueChange={setPrimaryAssigneeId}>
                  <SelectTrigger className="h-10 text-xs font-medium bg-secondary/40 border-border">
                    <SelectValue placeholder="Assign team member..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>
                      <span className="text-text-dim">Unassigned (Leave Open)</span>
                    </SelectItem>
                    {availableUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        <div className="flex items-center gap-2">
                          <span>{u.firstName} {u.lastName}</span>
                          <span className="text-[10px] text-text-dim font-mono">({u.role?.name || "Member"})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {primaryAssigneeId !== UNASSIGNED && (
                  (() => {
                    const assignee = users.find((u) => u.id === primaryAssigneeId);
                    if (!assignee) return null;
                    return (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border">
                        <Avatar className="size-9 border border-border">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                            {getInitials({ firstName: assignee.firstName, lastName: assignee.lastName })}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-foreground truncate">
                            {assignee.firstName} {assignee.lastName}
                          </div>
                          <div className="text-[10px] text-text-dim truncate">{assignee.email}</div>
                        </div>
                        <Badge variant="secondary" className="text-[10px] bg-primary/20 text-primary">
                          Lead
                        </Badge>
                      </div>
                    );
                  })()
                )}

                {(isAdmin || isManager) && (
                  <div className="space-y-2 rounded-xl border border-border bg-secondary/20 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-text-dim">
                      Also assign to
                    </div>
                    {assignableTeams.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {assignableTeams.map((t) => (
                          <Button
                            key={t.id}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-[11px]"
                            onClick={() => handleAddTeam(t.members.map((m) => m.id))}
                          >
                            <Users className="size-3" /> Whole {t.name} team ({t.members.length})
                          </Button>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Select value={selectedSecondaryToAdd} onValueChange={setSelectedSecondaryToAdd}>
                        <SelectTrigger className="h-8 flex-1 text-xs bg-secondary/40 border-border">
                          <SelectValue placeholder="Add a team member..." />
                        </SelectTrigger>
                        <SelectContent>
                          {addableSecondaries.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.firstName} {u.lastName}
                              {u.department?.name ? ` · ${u.department.name}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" size="sm" className="h-8" onClick={handleAddSecondary}>
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                    {selectedSecondaries.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {selectedSecondaries.map((u) => (
                          <Badge key={u.id} variant="secondary" className="gap-1 pr-1 text-[11px]">
                            {u.firstName} {u.lastName}
                            <button
                              type="button"
                              aria-label={`Remove ${u.firstName} ${u.lastName}`}
                              onClick={() => handleRemoveSecondary(u.id)}
                              className="rounded p-0.5 hover:bg-background/60"
                            >
                              <X className="size-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAllUsers(!showAllUsers)}
                    className="text-[11px] text-text-dim hover:text-foreground transition-colors"
                  >
                    {showAllUsers ? "Filter to this department only" : "Show cross-department team members"}
                  </button>
                </div>
              </div>
            </div>

            {/* Reviewer / Approver Card */}
            <div className="rounded-xl border border-border bg-panel/60 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-text-dim">
                    {activeProfile.reviewerLabel}
                  </h3>
                </div>
                <Badge variant="outline" className="text-[10px] text-text-dim">
                  Validation Gate
                </Badge>
              </div>

              <div className="space-y-2">
                <Select value={testerId} onValueChange={setTesterId}>
                  <SelectTrigger className="h-9 text-xs bg-secondary/40 border-border">
                    <SelectValue placeholder="No reviewer assigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>
                      <span className="text-text-dim">No Reviewer Assigned</span>
                    </SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} ({u.role?.name || "Member"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-text-dim leading-relaxed">
                  A Manager or Lead will review deliverables, submissions, or client notes before marking complete.
                </p>
              </div>
            </div>

            {/* Project / Workspace Association */}
            <div className="rounded-xl border border-border bg-panel/60 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-border">
                <Folder className="size-4 text-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-dim">
                  Project & Sprint Association
                </h3>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Project Workspace</Label>
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger className="h-9 text-xs bg-secondary/40 border-border">
                      <SelectValue placeholder="Standalone Task (No Project)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_PROJECT}>Standalone Task (No Project)</SelectItem>
                      {filteredProjects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {projectId !== NO_PROJECT && taskLists.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground">Task Board / List</Label>
                    <Select value={taskListId} onValueChange={setTaskListId}>
                      <SelectTrigger className="h-9 text-xs bg-secondary/40 border-border">
                        <SelectValue placeholder="Select task list..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_TASK_LIST}>Default List</SelectItem>
                        {taskLists.map((tl) => (
                          <SelectItem key={tl.id} value={tl.id}>
                            {tl.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {projectId !== NO_PROJECT && sprints.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground">Active Sprint</Label>
                    <Select value={sprintId} onValueChange={setSprintId}>
                      <SelectTrigger className="h-9 text-xs bg-secondary/40 border-border">
                        <SelectValue placeholder="No sprint assigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_SPRINT}>No Sprint</SelectItem>
                        {sprints.map((sp) => (
                          <SelectItem key={sp.id} value={sp.id}>
                            {sp.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            {/* Target Dates */}
            <div className="rounded-xl border border-border bg-panel/60 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-border">
                <Calendar className="size-4 text-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-dim">
                  Schedule & Dates
                </h3>
              </div>

              <div className="space-y-4">
                {/* Start Schedule */}
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="t-start-date" className="text-xs font-medium text-foreground">
                        Start Date
                      </Label>
                      <Input
                        id="t-start-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="h-9 text-xs font-mono bg-secondary/40 border-border"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="t-start-time" className="text-xs font-medium text-foreground">
                        Start Time
                      </Label>
                      <Input
                        id="t-start-time"
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="h-9 text-xs font-mono bg-secondary/40 border-border"
                      />
                    </div>
                  </div>
                </div>

                {/* Due Schedule */}
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="t-due-date" className="text-xs font-medium text-foreground">
                        Due Date
                      </Label>
                      <Input
                        id="t-due-date"
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="h-9 text-xs font-mono bg-secondary/40 border-border"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="t-due-time" className="text-xs font-medium text-foreground">
                        Due Time
                      </Label>
                      <Input
                        id="t-due-time"
                        type="time"
                        value={dueTime}
                        onChange={(e) => setDueTime(e.target.value)}
                        className="h-9 text-xs font-mono bg-secondary/40 border-border"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
