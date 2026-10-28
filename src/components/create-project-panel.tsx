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
  FolderPlus,
  Globe,
  Layers,
  ListPlus,
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
import { useCreateProject, useAddProjectMember } from "@/hooks/use-projects";
import { useCreateTaskList } from "@/hooks/use-task-lists";
import { useUsers } from "@/hooks/use-users";
import { useDepartments } from "@/hooks/use-departments";
import { useAuthStore } from "@/stores/auth-store";
import type { ProjectStatus } from "@/lib/api/types";
import { getInitials } from "@/lib/utils";

interface CreateProjectPanelProps {
  onBack: () => void;
  onCreated?: (projectId: string) => void;
  defaultDepartmentId?: string;
}

// Department Archetypes with custom workflows
interface DeptProfile {
  key: string;
  name: string;
  icon: string;
  badgeTone: string;
  themeGradient: string;
  borderColor: string;
  focusSummary: string;
  roleLeadTitle: string;
  roleCollaboratorTitle: string;
  categoryPresets: Array<{ id: string; label: string; icon: string; description: string }>;
  defaultTaskLists: string[];
  defaultDeliverables: string[];
}

const DEPARTMENT_PROFILES: Record<string, DeptProfile> = {
  dev: {
    key: "dev",
    name: "Software & Engineering",
    icon: "💻",
    badgeTone: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    themeGradient: "from-blue-600/20 via-indigo-600/10 to-transparent",
    borderColor: "border-blue-500/30 hover:border-blue-500",
    focusSummary: "Web apps, APIs, microservices, mobile apps, DevOps pipelines & system architecture",
    roleLeadTitle: "Lead Engineer / Project Architect",
    roleCollaboratorTitle: "Engineering Team Members",
    categoryPresets: [
      { id: "web", label: "Web Application", icon: "🌐", description: "Full-stack web application & frontend modules" },
      { id: "api", label: "Backend API & Services", icon: "⚙️", description: "REST/GraphQL APIs, microservices & DB schema" },
      { id: "mobile", label: "Mobile Application", icon: "📱", description: "iOS / Android cross-platform client app" },
      { id: "devops", label: "DevOps & Cloud Infra", icon: "🚀", description: "CI/CD pipelines, Docker, Kubernetes & AWS setup" },
      { id: "internal", label: "Internal Operations Tool", icon: "🛠️", description: "Admin automation tooling & developer utilities" },
      { id: "qa", label: "QA & Security Audit", icon: "🔒", description: "Automated test suites, penetration testing & compliance" },
    ],
    defaultTaskLists: [
      "Architecture & Planning",
      "Backend API Development",
      "Frontend UI / UX",
      "QA & Automated Testing",
      "DevOps & Deployment",
    ],
    defaultDeliverables: [
      "System Architecture Specification (RFC)",
      "Core backend API endpoints with automated unit tests",
      "Production-ready responsive frontend components",
      "Continuous deployment pipeline with monitoring telemetry",
    ],
  },
  sales: {
    key: "sales",
    name: "Sales & Commercial Accounts",
    icon: "💰",
    badgeTone: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    themeGradient: "from-emerald-600/20 via-teal-600/10 to-transparent",
    borderColor: "border-emerald-500/30 hover:border-emerald-500",
    focusSummary: "Commercial pipeline, key enterprise accounts, client pitches & revenue expansion",
    roleLeadTitle: "Account Executive / Deal Lead",
    roleCollaboratorTitle: "Sales & Commercial Representatives",
    categoryPresets: [
      { id: "enterprise_deal", label: "Enterprise Account Deal", icon: "💼", description: "High-value enterprise contract acquisition" },
      { id: "proposal_drive", label: "Proposal & RFP Response", icon: "📄", description: "Comprehensive commercial & scope proposal" },
      { id: "outbound_campaign", label: "Outbound Pipeline Surge", icon: "📈", description: "Targeted executive outreach & lead generation" },
      { id: "client_pitch", label: "Executive Demo & Pitch", icon: "🎯", description: "Tailored solution presentations for buyers" },
      { id: "partner_channel", label: "Partnership & Reseller", icon: "🤝", description: "Channel distribution & partner enablement" },
      { id: "expansion", label: "Account Upsell / Expansion", icon: "🚀", description: "Existing account ARR & seat expansion" },
    ],
    defaultTaskLists: [
      "Prospect Research & Stakeholder Discovery",
      "Commercial Demo & Technical Pitch",
      "Proposal Scope & Pricing Matrix",
      "Contract Legal & Security Review",
      "Deal Closing & Handover",
    ],
    defaultDeliverables: [
      "Executive Decision-Maker Discovery Map",
      "Signed Mutual NDA & Master Services Agreement",
      "Approved Pricing Schedule & Scope of Work",
      "Final Purchase Order / Closed Won Documentation",
    ],
  },
  hr: {
    key: "hr",
    name: "Recruitment & Talent Acquisition",
    icon: "👥",
    badgeTone: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    themeGradient: "from-purple-600/20 via-pink-600/10 to-transparent",
    borderColor: "border-purple-500/30 hover:border-purple-500",
    focusSummary: "Hiring requisitions, candidate sourcing, client staffing drives & eBoarding packets",
    roleLeadTitle: "Primary Recruiter / Talent Lead",
    roleCollaboratorTitle: "Recruitment & Sourcing Specialists",
    categoryPresets: [
      { id: "client_staffing", label: "Client Staffing Drive", icon: "🏢", description: "Fulfilling high-priority client hiring requisitions" },
      { id: "executive_search", label: "Executive Headhunting", icon: "🎯", description: "Sourcing Director & VP level strategic leadership" },
      { id: "campus_surge", label: "Campus & Graduate Drive", icon: "🎓", description: "Bulk junior & internship candidate cohort hiring" },
      { id: "onboarding_packet", label: "eBoarding & Compliance", icon: "📋", description: "Background vetting, contracts & onboarding rollout" },
      { id: "talent_pipeline", label: "Proactive Talent Pipeline", icon: "🔍", description: "Building pre-vetted candidate pools for demand" },
      { id: "branding", label: "Employer Branding", icon: "🌟", description: "Career portal & recruitment outreach branding" },
    ],
    defaultTaskLists: [
      "Job Requisition Intake & Market Benchmark",
      "Candidate Sourcing & Profile Shortlist",
      "Technical & Client Interviews",
      "Offer Letter & Document Verification",
      "Candidate Onboarding & Induction",
    ],
    defaultDeliverables: [
      "Verified Job Description & Compensation Grid",
      "Shortlist of 5+ Qualified & Pre-Screened Candidates",
      "Completed Technical Interview Scorecards",
      "Signed Offer Letter & Verified Background Documents",
    ],
  },
  marketing: {
    key: "marketing",
    name: "Marketing & Growth",
    icon: "🚀",
    badgeTone: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    themeGradient: "from-rose-600/20 via-orange-600/10 to-transparent",
    borderColor: "border-rose-500/30 hover:border-rose-500",
    focusSummary: "Product launches, SEO campaigns, paid media, brand creative & content distribution",
    roleLeadTitle: "Campaign Lead / Growth Strategist",
    roleCollaboratorTitle: "Marketing & Creative Specialists",
    categoryPresets: [
      { id: "product_launch", label: "Product Launch Campaign", icon: "🚀", description: "Multi-channel announcement & launch sprint" },
      { id: "seo_growth", label: "SEO & Content Strategy", icon: "🔍", description: "High-intent keyword clusters & article assets" },
      { id: "paid_ads", label: "Paid Media & PPC Surge", icon: "📊", description: "Google, LinkedIn & Meta performance campaigns" },
      { id: "brand_assets", label: "Brand Design & Assets", icon: "🎨", description: "Visual identity, sales decks & landing page kits" },
      { id: "event_webinar", label: "Event & Webinar Series", icon: "🎪", description: "Industry webinars, live demos & summit presence" },
      { id: "email_lifecycle", label: "Lifecycle & Email Sequences", icon: "✉️", description: "Automated onboarding & re-engagement drips" },
    ],
    defaultTaskLists: [
      "Campaign Strategy & Audience Brief",
      "Copywriting & Creative Asset Design",
      "Internal Review & Compliance Sign-off",
      "Channel Distribution & Live Launch",
      "Performance Metrics & ROAS Optimization",
    ],
    defaultDeliverables: [
      "Comprehensive Campaign Brief & Creative Deck",
      "Final Ad Creatives, Video Assets & Copy Bundles",
      "Live Landing Page with Full Analytics Tracking",
      "Post-Campaign Conversion & ROI Report",
    ],
  },
  operations: {
    key: "operations",
    name: "Operations & Customer Success",
    icon: "🛡️",
    badgeTone: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    themeGradient: "from-amber-600/20 via-yellow-600/10 to-transparent",
    borderColor: "border-amber-500/30 hover:border-amber-500",
    focusSummary: "Client onboarding, SLA governance, workflow automations, compliance & internal SOPs",
    roleLeadTitle: "Operations Lead / CS Manager",
    roleCollaboratorTitle: "Operations & Support Specialists",
    categoryPresets: [
      { id: "client_onboarding", label: "Client Onboarding Rollout", icon: "🛡️", description: "New client provisioning & training rollout" },
      { id: "process_sop", label: "Process Automation & SOPs", icon: "⚙️", description: "Standard operating procedures & workflow optimization" },
      { id: "sla_drive", label: "SLA & Support Ticket Drive", icon: "⏱️", description: "Response time reduction & client satisfaction" },
      { id: "compliance_audit", label: "Security & Compliance Audit", icon: "🔒", description: "SOC2, ISO & internal security governance" },
      { id: "tool_migration", label: "Platform & Tool Migration", icon: "🔄", description: "System upgrade & infrastructure transition" },
      { id: "quality_control", label: "Quality Assurance & Reviews", icon: "📋", description: "Service delivery inspection & retrospectives" },
    ],
    defaultTaskLists: [
      "Requirements Discovery & Gap Analysis",
      "Process Architecture & SOP Draft",
      "Tooling Configuration & Automation",
      "Team Training & Dry-Run Pilot",
      "Continuous Monitoring & SLA Review",
    ],
    defaultDeliverables: [
      "Operational Readiness & Gap Analysis Report",
      "Published Standard Operating Procedure (SOP)",
      "Automated Alerts & Telemetry Dashboard",
      "Executive Sign-off & Client Acceptance Protocol",
    ],
  },
  executive: {
    key: "executive",
    name: "Executive & Strategic Initiatives",
    icon: "🏛️",
    badgeTone: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
    themeGradient: "from-indigo-600/20 via-violet-600/10 to-transparent",
    borderColor: "border-indigo-500/30 hover:border-indigo-500",
    focusSummary: "Company-wide strategic OKRs, board milestones, quarterly targets & cross-team synergy",
    roleLeadTitle: "Executive Sponsor / Initiative Lead",
    roleCollaboratorTitle: "Cross-Functional Task Force",
    categoryPresets: [
      { id: "strategic_okr", label: "Quarterly Strategic OKR", icon: "🎯", description: "Top-level corporate objective & key results" },
      { id: "board_milestone", label: "Board & Investor Milestone", icon: "📊", description: "Quarterly governance & shareholder targets" },
      { id: "cross_rollout", label: "Cross-Department Rollout", icon: "🌐", description: "Organization-wide transformation program" },
      { id: "expansion_geo", label: "Geographic Expansion", icon: "🏢", description: "New branch office, entity or territory launch" },
    ],
    defaultTaskLists: [
      "Strategic Alignment & Executive Charter",
      "Cross-Department Resource Allocation",
      "Milestone Execution & Weekly Cadence",
      "Governance Review & Final Sign-off",
    ],
    defaultDeliverables: [
      "Executive Initiative Charter & Resource Plan",
      "Bi-Weekly Progress & Milestone Tracking Dashboard",
      "Completed Operational Deliverables & Verification",
      "Final Board Review & Impact Summary",
    ],
  },
};

export const CreateProjectPanel: React.FC<CreateProjectPanelProps> = ({
  onBack,
  onCreated,
  defaultDepartmentId,
}) => {
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role.name === "ADMIN";

  const createProject = useCreateProject();
  const addProjectMember = useAddProjectMember();
  const createTaskList = useCreateTaskList();

  const { data: users = [] } = useUsers();
  const { data: departments = [] } = useDepartments();

  // Determine initial department profile
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

  // State: whether admin is on department selection step
  const initialDeptId = defaultDepartmentId || currentUser?.department?.id || "";
  const [isSelectingDepartment, setIsSelectingDepartment] = useState(() => {
    // If Admin and no specific department passed in, start on department picker
    return isAdmin && !defaultDepartmentId;
  });

  const [activeProfileKey, setActiveProfileKey] = useState<string>(() =>
    getProfileKeyFromDept(initialDeptId || currentUser?.department?.id)
  );
  const [selectedDeptId, setSelectedDeptId] = useState<string>(initialDeptId);

  const activeProfile = DEPARTMENT_PROFILES[activeProfileKey] || DEPARTMENT_PROFILES.dev;

  // Form State
  const [name, setName] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("ACTIVE");
  const [category, setCategory] = useState(activeProfile.categoryPresets[0]?.id || "web");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("HIGH");
  const [ownerId, setOwnerId] = useState(currentUser?.id || "");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });

  // Dynamic deliverables & task lists based on profile
  const [deliverables, setDeliverables] = useState<string[]>(activeProfile.defaultDeliverables);
  const [newDeliverableInput, setNewDeliverableInput] = useState("");
  const [taskLists, setTaskLists] = useState<string[]>(activeProfile.defaultTaskLists);
  const [newTaskListInput, setNewTaskListInput] = useState("");

  // Team Members
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [selectedMemberToAdd, setSelectedMemberToAdd] = useState("");
  const [showAllUsers, setShowAllUsers] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // When switching department profile
  const handleSelectDepartment = (profileKey: string, dbDeptId?: string) => {
    setActiveProfileKey(profileKey);
    const prof = DEPARTMENT_PROFILES[profileKey] || DEPARTMENT_PROFILES.dev;
    
    // Find matching db dept if not directly provided
    const matchingDbDept = dbDeptId 
      ? departments.find((d) => d.id === dbDeptId)
      : departments.find((d) => getProfileKeyFromDept(d.id) === profileKey);

    setSelectedDeptId(matchingDbDept?.id || dbDeptId || "");
    setCategory(prof.categoryPresets[0]?.id || "default");
    setTaskLists(prof.defaultTaskLists);
    setDeliverables(prof.defaultDeliverables);
    setIsSelectingDepartment(false);
    toast.success(`Configured Project Workspace for ${prof.name}`);
  };

  // Auto-generate project code from name
  useEffect(() => {
    if (name && !projectCode) {
      const code = name
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, "")
        .split(/\s+/)
        .map((w) => w.slice(0, 3))
        .join("-")
        .slice(0, 10);
      if (code) setProjectCode(code);
    }
  }, [name, projectCode]);

  // Filter users by department for collaborator picking
  const availableUsers = useMemo(() => {
    if (showAllUsers || !selectedDeptId) return users;
    const deptUsers = users.filter((u) => u.department?.id === selectedDeptId);
    return deptUsers.length > 0 ? deptUsers : users;
  }, [users, selectedDeptId, showAllUsers]);

  const selectedMembers = useMemo(() => {
    return users.filter((u) => selectedMemberIds.includes(u.id));
  }, [users, selectedMemberIds]);

  const addableUsers = useMemo(() => {
    return availableUsers.filter((u) => !selectedMemberIds.includes(u.id) && u.id !== ownerId);
  }, [availableUsers, selectedMemberIds, ownerId]);

  const durationText = useMemo(() => {
    if (!startDate || !dueDate) return "";
    const start = new Date(startDate).getTime();
    const end = new Date(dueDate).getTime();
    if (isNaN(start) || isNaN(end) || end < start) return "Invalid date range";
    const days = Math.round((end - start) / (1000 * 60 * 60 * 24));
    const weeks = Math.round(days / 7);
    return `${days} day${days === 1 ? "" : "s"} (${weeks} week${weeks === 1 ? "" : "s"})`;
  }, [startDate, dueDate]);

  // Handlers
  const handleAddDeliverable = () => {
    if (!newDeliverableInput.trim()) return;
    setDeliverables((prev) => [...prev, newDeliverableInput.trim()]);
    setNewDeliverableInput("");
  };

  const handleRemoveDeliverable = (index: number) => {
    setDeliverables((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddTaskList = () => {
    if (!newTaskListInput.trim()) return;
    if (taskLists.includes(newTaskListInput.trim())) {
      toast.info("Task list already exists");
      return;
    }
    setTaskLists((prev) => [...prev, newTaskListInput.trim()]);
    setNewTaskListInput("");
  };

  const handleRemoveTaskList = (listName: string) => {
    setTaskLists((prev) => prev.filter((l) => l !== listName));
  };

  const handleAddMember = () => {
    if (!selectedMemberToAdd) return;
    if (!selectedMemberIds.includes(selectedMemberToAdd)) {
      setSelectedMemberIds((prev) => [...prev, selectedMemberToAdd]);
    }
    setSelectedMemberToAdd("");
  };

  const handleRemoveMember = (userId: string) => {
    setSelectedMemberIds((prev) => prev.filter((id) => id !== userId));
  };

  const handleAddAllDepartmentMembers = () => {
    const deptUsers = availableUsers.map((u) => u.id).filter((id) => id !== ownerId);
    setSelectedMemberIds(Array.from(new Set([...selectedMemberIds, ...deptUsers])));
    toast.success(`Added ${deptUsers.length} team members`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage("Project name is required.");
      toast.error("Please provide a project name.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const project = await createProject.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        status,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        departmentId: selectedDeptId || undefined,
      });

      // Add collaborators
      const memberPromises = selectedMemberIds.map((userId) =>
        addProjectMember.mutateAsync({
          projectId: project.id,
          userId,
        }).catch(() => null)
      );

      // Create default task lists
      const listPromises = taskLists.map((listName) =>
        createTaskList.mutateAsync({
          projectId: project.id,
          name: listName,
        }).catch(() => null)
      );

      await Promise.all([...memberPromises, ...listPromises]);

      toast.success("Project Workspace created successfully!");
      if (onCreated) {
        onCreated(project.id);
      }
      onBack();
    } catch (err: any) {
      const msg = err?.message || "Failed to create project.";
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
                Choose the operational division to load the exact tailored project workflow and team rosters
              </p>
            </div>
          </div>
        </div>

        {/* Department Grid */}
        <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <div className="size-12 rounded-2xl bg-primary/10 border border-primary/20 mx-auto flex items-center justify-center text-primary shadow-inner">
              <Building2 className="size-6" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Which department is executing this project?
            </h2>
            <p className="text-xs text-text-dim leading-relaxed">
              Venus CRM automatically personalizes the project category presets, milestone deliverables, task boards, and member rosters for the selected division.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Object.entries(DEPARTMENT_PROFILES).map(([key, profile]) => {
              // Find matching database department count if available
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
                    <span className="font-medium text-foreground/80">{profile.categoryPresets.length} presets</span>
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
  // 2. TAILORED PROJECT WORKSPACE PANEL
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
                  Create Project Workspace
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
                Tailored for {activeProfile.name} • {taskLists.length} default boards • {deliverables.length} milestones
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
            disabled={isSubmitting || !name.trim()}
            className="gap-2 shadow-md bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
            <span>Create Project</span>
          </Button>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left 2 Columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* General Project Details Card */}
            <div className="rounded-xl border border-border bg-panel/60 p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <FolderPlus className="size-4 text-primary" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                    General Project Details
                  </h2>
                </div>
                <Badge variant="outline" className="text-[11px] font-medium bg-secondary/50">
                  Required Details
                </Badge>
              </div>

              {/* Project Name */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="proj-name" className="text-xs font-semibold text-foreground">
                    Project Title <span className="text-destructive">*</span>
                  </Label>
                  <span className="text-[11px] text-text-dim font-mono">{name.length}/100</span>
                </div>
                <Input
                  id="proj-name"
                  placeholder={`e.g. ${activeProfile.key === "dev" ? "Venus Core Platform 2.0" : activeProfile.key === "sales" ? "Enterprise Q4 Pipeline Surge" : activeProfile.key === "hr" ? "Niagara Health JPC-480 Staffing" : "Quarterly Strategic Milestone"}`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  required
                  autoFocus
                  className="h-10 text-sm font-medium bg-secondary/40 border-border focus:border-primary"
                />
              </div>

              {/* Category / Type Chips */}
              <div className="space-y-2.5">
                <Label className="text-xs font-semibold text-foreground">
                  Project Category / Initiative Type
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {activeProfile.categoryPresets.map((cat) => {
                    const isSelected = category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? "bg-primary/20 border-primary text-primary font-semibold shadow-sm"
                            : "bg-secondary/30 border-border text-text-dim hover:text-foreground hover:bg-secondary/60"
                        }`}
                      >
                        <div className="text-sm mb-0.5">{cat.icon}</div>
                        <div className="text-xs font-bold truncate">{cat.label}</div>
                        <div className="text-[10px] opacity-75 line-clamp-1 mt-0.5">{cat.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Scope & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-foreground">Department Scope</Label>
                  <Input
                    value={activeProfile.name}
                    readOnly
                    className="h-10 text-xs font-semibold bg-secondary/30 border-border text-foreground cursor-default"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-foreground">Project Priority</Label>
                  <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                    <SelectTrigger className="h-10 text-xs bg-secondary/40 border-border font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low Priority</SelectItem>
                      <SelectItem value="MEDIUM">Medium Priority</SelectItem>
                      <SelectItem value="HIGH">High Priority</SelectItem>
                      <SelectItem value="URGENT">Critical / Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-foreground">Initial Status</Label>
                  <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                    <SelectTrigger className="h-10 text-xs bg-secondary/40 border-border font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active (Live Work)</SelectItem>
                      <SelectItem value="ON_HOLD">On Hold / Backlog</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="ARCHIVED">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Scope & Deliverables Card */}
            <div className="rounded-xl border border-border bg-panel/60 p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Layers className="size-4 text-primary" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                    Scope & Key Deliverables
                  </h2>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-primary">
                  <Sparkles className="size-3.5" />
                  <span>{activeProfile.name} Milestones</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="proj-desc" className="text-xs font-medium text-foreground">
                  Project Overview & Objectives
                </Label>
                <Textarea
                  id="proj-desc"
                  placeholder={`Outline high-level mandate, client requirements, architecture specs, or key metrics for ${activeProfile.name}...`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="text-sm bg-secondary/40 border-border resize-none leading-relaxed"
                />
              </div>

              {/* Deliverables Checklist */}
              <div className="space-y-3 pt-2">
                <Label className="text-xs font-semibold text-foreground">
                  Key Deliverables & Acceptance Checklist ({deliverables.length})
                </Label>
                <div className="space-y-2">
                  {deliverables.map((item, idx) => (
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
                        onClick={() => handleRemoveDeliverable(idx)}
                        className="text-text-dim hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity p-1"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}

                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      placeholder="Add another deliverable milestone..."
                      value={newDeliverableInput}
                      onChange={(e) => setNewDeliverableInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddDeliverable();
                        }
                      }}
                      className="h-9 text-xs bg-secondary/40 border-border"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddDeliverable}
                      className="h-9 text-xs gap-1 shrink-0"
                    >
                      <Plus className="size-3.5" /> Add Milestone
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Task Lists / Boards Card */}
            <div className="rounded-xl border border-border bg-panel/60 p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <ListPlus className="size-4 text-primary" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                    Default Task Lists & Workflow Stages
                  </h2>
                </div>
                <span className="text-xs text-text-dim font-mono">{taskLists.length} lists</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {taskLists.map((listName) => (
                  <div
                    key={listName}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/40 border border-border text-xs font-semibold text-foreground group"
                  >
                    <span>{listName}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTaskList(listName)}
                      className="text-text-dim hover:text-destructive transition-colors ml-1"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Input
                  placeholder="Create custom task list (e.g. Review & Sign-off)..."
                  value={newTaskListInput}
                  onChange={(e) => setNewTaskListInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTaskList();
                    }
                  }}
                  className="h-9 text-xs bg-secondary/40 border-border"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddTaskList}
                  className="h-9 text-xs gap-1 shrink-0"
                >
                  <Plus className="size-3.5" /> Add List
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

          {/* Right Column: Lead, Collaborators & Schedule */}
          <div className="space-y-6">
            {/* Project Lead Card */}
            <div className="rounded-xl border border-border bg-panel/60 p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <UserCheck className="size-4 text-primary" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-text-dim">
                    {activeProfile.roleLeadTitle}
                  </h3>
                </div>
              </div>

              <div className="space-y-3">
                <Select value={ownerId} onValueChange={setOwnerId}>
                  <SelectTrigger className="h-10 text-xs font-medium bg-secondary/40 border-border">
                    <SelectValue placeholder="Select project lead..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        <div className="flex items-center gap-2">
                          <span>{u.firstName} {u.lastName}</span>
                          <span className="text-[10px] text-text-dim font-mono">({u.role?.name || "Member"})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {ownerId && (
                  (() => {
                    const owner = users.find((u) => u.id === ownerId);
                    if (!owner) return null;
                    return (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border">
                        <Avatar className="size-9 border border-border">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                            {getInitials({ firstName: owner.firstName, lastName: owner.lastName })}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-foreground truncate">
                            {owner.firstName} {owner.lastName}
                          </div>
                          <div className="text-[10px] text-text-dim truncate">{owner.email}</div>
                        </div>
                        <Badge variant="secondary" className="text-[10px] bg-primary/20 text-primary">
                          Lead
                        </Badge>
                      </div>
                    );
                  })()
                )}
              </div>
            </div>

            {/* Collaborators Card */}
            <div className="rounded-xl border border-border bg-panel/60 p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-primary" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-text-dim">
                    {activeProfile.roleCollaboratorTitle} ({selectedMembers.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleAddAllDepartmentMembers}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  Add All {activeProfile.name.split(" ")[0]}
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Select value={selectedMemberToAdd} onValueChange={setSelectedMemberToAdd}>
                    <SelectTrigger className="h-9 text-xs bg-secondary/40 border-border">
                      <SelectValue placeholder="Add team member..." />
                    </SelectTrigger>
                    <SelectContent>
                      {addableUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.firstName} {u.lastName} ({u.department?.name || "General"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddMember}
                    disabled={!selectedMemberToAdd}
                    className="h-9 px-3"
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAllUsers(!showAllUsers)}
                    className="text-[11px] text-text-dim hover:text-foreground transition-colors"
                  >
                    {showAllUsers ? "Filter to this department only" : "Show all cross-department users"}
                  </button>
                </div>

                {selectedMembers.length === 0 ? (
                  <p className="text-xs text-text-dim italic bg-secondary/20 p-3 rounded-lg text-center">
                    No collaborators added yet. Add team members to give them workspace access.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {selectedMembers.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 border border-border text-xs group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="size-6 border border-border shrink-0">
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                              {getInitials({ firstName: m.firstName, lastName: m.lastName })}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-foreground truncate">
                            {m.firstName} {m.lastName}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m.id)}
                          className="text-text-dim hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Schedule & Dates Card */}
            <div className="rounded-xl border border-border bg-panel/60 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-border">
                <Calendar className="size-4 text-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-dim">
                  Timeline & Target Dates
                </h3>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="start-date" className="text-xs font-medium text-foreground">
                    Target Start Date
                  </Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-9 text-xs font-mono bg-secondary/40 border-border"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="due-date" className="text-xs font-medium text-foreground">
                    Target Due Date
                  </Label>
                  <Input
                    id="due-date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="h-9 text-xs font-mono bg-secondary/40 border-border"
                  />
                </div>

                {durationText && (
                  <div className="pt-2 text-[11px] text-text-dim flex items-center justify-between border-t border-border">
                    <span>Estimated Duration:</span>
                    <span className="font-mono font-semibold text-foreground">{durationText}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
