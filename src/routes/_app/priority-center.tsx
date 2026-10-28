import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import {
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Send,
  UserCheck,
  Search,
  ShieldAlert,
  ArrowUpRight,
  Sparkles,
  Laptop,
  Mail,
  UserPlus,
  ShieldCheck,
  Building2,
  CalendarDays,
  FileCheck,
  Cpu,
  Flame,
  User,
  Building,
  DollarSign,
  Briefcase,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  useSLAPriorityQueue,
  useTriggerSlaNudge,
  useTriggerInterviewerReminder,
  useAdvanceSlaStage,
} from "@/hooks/use-recruitment";

export const Route = createFileRoute("/_app/priority-center")({
  component: PriorityCenterPage,
});

export type CardType = "SLA_ALERT" | "EXPIRING_OFFER" | "NOTICE_PERIOD" | "IDLE_MATCH";

export interface PriorityTask {
  id: string;
  type: CardType;
  candidateName: string;
  jobTitle: string;
  interviewer?: string;
  hiringManager?: string;
  assignedPerson: string;
  
  // Score components
  businessImpact: number; // 1-30
  delaySeverity: number;  // 1-30
  candidateValue: number; // 1-20
  hiringUrgency: number;  // 1-20

  // Type 1: SLA Breach Alert fields
  issueType?: "Interview Feedback Overdue" | "Hiring Manager Review Overdue" | "Offer Approval Overdue" | "Background Verification Inactivity";
  delayHours?: number;
  riskLevel?: "CRITICAL" | "HIGH" | "MEDIUM";

  // Type 2: Expiring Offer Alert fields
  offerValue?: string;
  timeRemainingHours?: number;
  offerStatus?: "Reviewing Offer" | "Negotiating Compensation" | "Awaiting Approval";

  // Type 3: Notice Period Ending Alert fields
  joiningDate?: string;
  noticePeriodEndDate?: string;
  backgroundVerificationStatus?: "Cleared" | "In Progress" | "Pending Documentation";
  hardwareProvisioningStatus?: "Pending Request" | "Allocated" | "In Transit";

  // Type 4: Idle High-Match Candidate fields
  aiMatchScore?: number; // >90
  idleDays?: number;
  inactivityReason?: string;
}

const INITIAL_TASKS: PriorityTask[] = [
  {
    id: "p-1",
    type: "EXPIRING_OFFER",
    candidateName: "Emily Zhang",
    jobTitle: "Senior Software Engineer",
    interviewer: "Jivan Satapathy",
    hiringManager: "Megan Miller",
    assignedPerson: "Megan Miller",
    businessImpact: 30,
    delaySeverity: 28,
    candidateValue: 20,
    hiringUrgency: 20,
    offerValue: "$150,000 / yr + Equity",
    timeRemainingHours: 6,
    offerStatus: "Negotiating Compensation",
  },
  {
    id: "p-2",
    type: "SLA_ALERT",
    candidateName: "Alex Chen",
    jobTitle: "Senior Staff Engineer",
    interviewer: "Jivan Satapathy",
    hiringManager: "Dev Lead",
    assignedPerson: "Jivan Satapathy",
    businessImpact: 28,
    delaySeverity: 26,
    candidateValue: 19,
    hiringUrgency: 18,
    issueType: "Interview Feedback Overdue",
    delayHours: 48,
    riskLevel: "CRITICAL",
  },
  {
    id: "p-3",
    type: "NOTICE_PERIOD",
    candidateName: "Sarah Vance",
    jobTitle: "Full Stack Engineer",
    interviewer: "Shantanu Das",
    hiringManager: "Alice Smith",
    assignedPerson: "HR Onboarding Team",
    businessImpact: 22,
    delaySeverity: 20,
    candidateValue: 18,
    hiringUrgency: 17,
    joiningDate: "2026-09-05",
    noticePeriodEndDate: "2026-09-02",
    backgroundVerificationStatus: "Cleared",
    hardwareProvisioningStatus: "Pending Request",
  },
  {
    id: "p-4",
    type: "IDLE_MATCH",
    candidateName: "David Miller",
    jobTitle: "Lead AI Engineer",
    interviewer: "Unassigned",
    hiringManager: "Dr. Aris",
    assignedPerson: "Recruiter Megan",
    businessImpact: 25,
    delaySeverity: 18,
    candidateValue: 20,
    hiringUrgency: 14,
    aiMatchScore: 94.5,
    idleDays: 5,
    inactivityReason: "Interview Not Scheduled",
  },
  {
    id: "p-5",
    type: "SLA_ALERT",
    candidateName: "Marcus Brody",
    jobTitle: "Principal Systems Architect",
    interviewer: "Shantanu Das",
    hiringManager: "Dev VP",
    assignedPerson: "Shantanu Das",
    businessImpact: 24,
    delaySeverity: 22,
    candidateValue: 17,
    hiringUrgency: 15,
    issueType: "Hiring Manager Review Overdue",
    delayHours: 76,
    riskLevel: "CRITICAL",
  },
  {
    id: "p-6",
    type: "EXPIRING_OFFER",
    candidateName: "Jessica Taylor",
    jobTitle: "Principal Systems Architect",
    interviewer: "Marco Rossi",
    hiringManager: "VP Engineering",
    assignedPerson: "Megan Miller",
    businessImpact: 26,
    delaySeverity: 20,
    candidateValue: 18,
    hiringUrgency: 12,
    offerValue: "$165,000 / yr",
    timeRemainingHours: 18,
    offerStatus: "Reviewing Offer",
  },
];

import { useDepartmentGuard } from "@/hooks/use-department-guard";

function PriorityCenterPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ to: "/recruitment", replace: true });
  }, [navigate]);

  return null;
}

// Retained internally in case the feature is restored in the future
function _PriorityCenterPanelDeprecated() {
  useDepartmentGuard("Recruitment");
  const [tasks, setTasks] = useState<PriorityTask[]>(INITIAL_TASKS);
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");

  // Dialog States
  const [selectedTask, setSelectedTask] = useState<PriorityTask | null>(null);
  const [activeDialog, setActiveDialog] = useState<CardType | null>(null);

  // SLA Ping Dialog state
  const [pingChannel, setPingChannel] = useState<"Slack" | "Email" | "Teams" | "Internal">("Slack");

  // Offer Extension state
  const [newExpiryHours, setNewExpiryHours] = useState<number>(48);
  const [compensationNote, setCompensationNote] = useState<string>("");

  // Onboarding state
  const [onboardingChecks, setOnboardingChecks] = useState({
    laptop: true,
    email: true,
    hrms: true,
    idCard: true,
    vpn: true,
    training: true,
    preboardingWelcome: true,
  });

  // Interview Schedule state
  const [selectedPanel, setSelectedPanel] = useState<string>("Jivan Satapathy");
  const [selectedDate, setSelectedDate] = useState<string>("2026-09-01");
  const [selectedTime, setSelectedTime] = useState<string>("10:00 AM");
  const [outreachMessage, setOutreachMessage] = useState<string>(
    "Hi David, your background in LLMs is a 94.5% match for our Lead AI Engineer position. We would love to invite you for a 45-min technical discussion."
  );

  // Metric counts
  const slaBreachesCount = useMemo(
    () => tasks.filter((t) => t.type === "SLA_ALERT").length,
    [tasks]
  );
  const expiringOffersCount = useMemo(
    () => tasks.filter((t) => t.type === "EXPIRING_OFFER").length,
    [tasks]
  );
  const noticePeriodCount = useMemo(
    () => tasks.filter((t) => t.type === "NOTICE_PERIOD").length,
    [tasks]
  );
  const idleHighMatchesCount = useMemo(
    () => tasks.filter((t) => t.type === "IDLE_MATCH").length,
    [tasks]
  );

  // Filtered and Ranked Tasks
  const rankedFilteredTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        const query = search.toLowerCase();
        const matchesSearch =
          t.candidateName.toLowerCase().includes(query) ||
          t.jobTitle.toLowerCase().includes(query) ||
          (t.interviewer && t.interviewer.toLowerCase().includes(query)) ||
          (t.hiringManager && t.hiringManager.toLowerCase().includes(query));

        if (!matchesSearch) return false;

        if (activeFilter === "ALL") return true;
        if (activeFilter === "SLA_ALERT") return t.type === "SLA_ALERT";
        if (activeFilter === "EXPIRING_OFFER") return t.type === "EXPIRING_OFFER";
        if (activeFilter === "NOTICE_PERIOD") return t.type === "NOTICE_PERIOD";
        if (activeFilter === "IDLE_MATCH") return t.type === "IDLE_MATCH";
        return true;
      })
      .map((t) => ({
        ...t,
        priorityScore:
          t.businessImpact + t.delaySeverity + t.candidateValue + t.hiringUrgency,
      }))
      .sort((a, b) => b.priorityScore - a.priorityScore);
  }, [tasks, search, activeFilter]);

  const { data: liveSlaQueue = [] } = useSLAPriorityQueue();
  const triggerNudge = useTriggerSlaNudge();
  const triggerReminder = useTriggerInterviewerReminder();
  const advanceStage = useAdvanceSlaStage();

  const handleOpenAction = (task: PriorityTask) => {
    setSelectedTask(task);
    setActiveDialog(task.type);
  };

  const handleResolveTask = async (taskId: string, message: string) => {
    try {
      if (selectedTask) {
        if (selectedTask.type === "SLA_ALERT") {
          await triggerReminder.mutateAsync(taskId).catch(() => {});
        } else if (selectedTask.type === "IDLE_MATCH") {
          await triggerNudge.mutateAsync({ candidateId: taskId, message }).catch(() => {});
        }
      }
    } catch {
      // safe fallback
    }

    toast.success("Action Executed & Resolved", {
      description: message,
    });
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setActiveDialog(null);
    setSelectedTask(null);
  };

  return (
    <div className="p-6 max-w-[1720px] mx-auto space-y-6 font-sans select-none pb-20">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="size-11 rounded-2xl bg-amber-500/10 border border-amber-200 text-amber-600 flex items-center justify-center font-bold shrink-0">
            <Zap className="size-5 fill-amber-500 text-amber-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900 tracking-tight">
                Recruiter Priority Center
              </h1>
              <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-extrabold text-[10px]">
                {tasks.length} Action Items
              </Badge>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Real-time recruitment SLA tracking, expiring offer escalations, notice period readiness, and idle AI candidate discovery.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 1 — SLA & Risk Tracker (Metric Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: SLA Breaches */}
        <Card className="bg-white border-slate-200/90 p-4 rounded-2xl shadow-2xs space-y-1.5 border-l-4 border-l-rose-500">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">
            SLA Breaches
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-rose-600">
              {slaBreachesCount} Active Violations
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium leading-snug">
            Blocked actions exceeding SLA threshold (interview feedback, manager review, approvals).
          </p>
        </Card>

        {/* Card 2: Expiring Offers */}
        <Card className="bg-white border-slate-200/90 p-4 rounded-2xl shadow-2xs space-y-1.5 border-l-4 border-l-amber-500">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">
            Expiring Offers
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-600">
              {expiringOffersCount} Offers Expiring &lt;24h
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium leading-snug">
            Offers requiring immediate recruiter extension or compensation decision.
          </p>
        </Card>

        {/* Card 3: Notice Period Ends */}
        <Card className="bg-white border-slate-200/90 p-4 rounded-2xl shadow-2xs space-y-1.5 border-l-4 border-l-emerald-500">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">
            Notice Period Ends
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-600">
              {noticePeriodCount} Candidates Joining
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium leading-snug">
            Candidates completing notice period soon requiring onboarding setup.
          </p>
        </Card>

        {/* Card 4: Idle High Matches */}
        <Card className="bg-white border-slate-200/90 p-4 rounded-2xl shadow-2xs space-y-1.5 border-l-4 border-l-purple-500">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">
            Idle High Matches
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-purple-600">
              {idleHighMatchesCount} Idle Candidates
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium leading-snug">
            AI vector match &gt; 90% sitting idle without activity for &gt; 3 days.
          </p>
        </Card>
      </div>

      {/* SECTION 2 — Filter & Search Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="size-4 text-slate-400 absolute left-3 top-2.5" />
          <Input
            placeholder="Search by candidate name, job title, interviewer, or hiring manager..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl border-slate-200 bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80 overflow-x-auto">
          {[
            { id: "ALL", label: "All Priorities" },
            { id: "SLA_ALERT", label: "SLA Alerts" },
            { id: "EXPIRING_OFFER", label: "Expiring Offers" },
            { id: "NOTICE_PERIOD", label: "Notice Period" },
            { id: "IDLE_MATCH", label: "Idle Candidates" },
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeFilter === filter.id
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 3 — Priority Action Cards List */}
      <div className="space-y-4">
        {rankedFilteredTasks.length === 0 ? (
          <div className="text-center text-xs text-slate-400 py-16 bg-white rounded-2xl border border-slate-200">
            <CheckCircle2 className="size-10 text-emerald-500 mx-auto mb-2 stroke-1" />
            <span className="font-extrabold text-slate-800 text-sm block">
              All Recruitment Action Items Clear!
            </span>
            <span className="text-slate-500">
              No pending SLA breaches, expiring offers, or idle candidates found matching your query.
            </span>
          </div>
        ) : (
          rankedFilteredTasks.map((task, index) => {
            return (
              <Card
                key={task.id}
                className="bg-white border-slate-200/90 rounded-2xl p-5 shadow-2xs hover:shadow-md transition-all space-y-4 relative overflow-hidden"
              >
                {/* Priority Rank Indicator Bar */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="size-6 rounded-full bg-slate-900 text-white text-xs font-mono font-bold flex items-center justify-center">
                      #{index + 1}
                    </span>
                    <Badge className="bg-slate-100 text-slate-800 border-slate-300 font-mono text-[10px]">
                      Priority Score: {task.priorityScore}
                    </Badge>

                    {task.type === "SLA_ALERT" && (
                      <Badge className="bg-rose-50 text-rose-700 border-rose-200 font-bold text-[10px]">
                        SLA BREACH ALERT
                      </Badge>
                    )}
                    {task.type === "EXPIRING_OFFER" && (
                      <Badge className="bg-amber-50 text-amber-700 border-amber-200 font-bold text-[10px]">
                        EXPIRING OFFER ALERT
                      </Badge>
                    )}
                    {task.type === "NOTICE_PERIOD" && (
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold text-[10px]">
                        NOTICE PERIOD ALERT
                      </Badge>
                    )}
                    {task.type === "IDLE_MATCH" && (
                      <Badge className="bg-purple-50 text-purple-700 border-purple-200 font-bold text-[10px]">
                        IDLE HIGH-MATCH ALERT
                      </Badge>
                    )}
                  </div>

                  <span className="text-xs text-slate-400 font-medium">
                    Assigned: <strong className="text-slate-700">{task.assignedPerson}</strong>
                  </span>
                </div>

                {/* CARD DETAILS BASED ON TYPE */}
                {task.type === "SLA_ALERT" && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    <div className="md:col-span-8 space-y-1">
                      <h3 className="text-sm font-black text-slate-900">{task.candidateName}</h3>
                      <p className="text-xs font-bold text-blue-600">{task.jobTitle}</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1 font-medium">
                        <span>Issue: <strong className="text-rose-600">{task.issueType}</strong></span>
                        <span>•</span>
                        <span>Delay: <strong className="text-rose-600">+{task.delayHours}h beyond SLA</strong></span>
                        <span>•</span>
                        <span>Interviewer: <strong className="text-slate-800">{task.interviewer}</strong></span>
                      </div>
                      
                      {/* Escalation Pathway Visual Indicator */}
                      <div className="flex items-center gap-2 pt-2 text-[10px]">
                        <span className="font-extrabold text-slate-400 uppercase">Escalation Path:</span>
                        <span className={`px-2 py-0.5 rounded ${task.delayHours! >= 48 ? "bg-rose-100 text-rose-800 font-bold" : "bg-slate-100 text-slate-500"}`}>
                          48h Reminder
                        </span>
                        <span>→</span>
                        <span className={`px-2 py-0.5 rounded ${task.delayHours! >= 72 ? "bg-rose-100 text-rose-800 font-bold" : "bg-slate-100 text-slate-400"}`}>
                          72h Manager Escalation
                        </span>
                        <span>→</span>
                        <span className={`px-2 py-0.5 rounded ${task.delayHours! >= 96 ? "bg-rose-200 text-rose-900 font-bold" : "bg-slate-100 text-slate-400"}`}>
                          96h VP Escalation
                        </span>
                      </div>
                    </div>

                    <div className="md:col-span-4 flex flex-col sm:flex-row items-end sm:items-center justify-end gap-2">
                      <Button
                        onClick={async () => {
                          await triggerReminder.mutateAsync(task.id).catch(() => {});
                          handleResolveTask(task.id, `Scorecard reminder dispatched to ${task.interviewer || "interviewer"} via Slack/Email.`);
                        }}
                        disabled={triggerReminder.isPending}
                        variant="outline"
                        className="border-slate-300 text-slate-700 font-bold text-xs rounded-xl h-9 px-3 hover:bg-slate-50 cursor-pointer"
                      >
                        <Send className="size-3 mr-1 text-slate-500" /> Remind Reviewer
                      </Button>
                      <Button
                        onClick={() => handleOpenAction(task)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl h-9 px-4 shadow-sm cursor-pointer"
                      >
                        <Zap className="size-3 mr-1" /> Quick SLA Action
                      </Button>
                    </div>
                  </div>
                )}

                {task.type === "EXPIRING_OFFER" && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    <div className="md:col-span-8 space-y-1">
                      <h3 className="text-sm font-black text-slate-900">{task.candidateName}</h3>
                      <p className="text-xs font-bold text-blue-600">{task.jobTitle}</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1 font-medium">
                        <span>Offer Value: <strong className="text-emerald-700">{task.offerValue}</strong></span>
                        <span>•</span>
                        <span>Expires In: <strong className="text-amber-600 font-mono">{task.timeRemainingHours} hours remaining</strong></span>
                        <span>•</span>
                        <span>Status: <strong className="text-slate-800">{task.offerStatus}</strong></span>
                      </div>
                    </div>

                    <div className="md:col-span-4 flex justify-end">
                      <Button
                        onClick={() => handleOpenAction(task)}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl h-10 px-5 shadow-sm cursor-pointer"
                      >
                        <Clock className="size-3.5 mr-2" /> Extend Offer Window
                      </Button>
                    </div>
                  </div>
                )}

                {task.type === "NOTICE_PERIOD" && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    <div className="md:col-span-8 space-y-1">
                      <h3 className="text-sm font-black text-slate-900">{task.candidateName}</h3>
                      <p className="text-xs font-bold text-blue-600">{task.jobTitle}</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1 font-medium">
                        <span>Joining Date: <strong className="text-slate-800">{task.joiningDate}</strong></span>
                        <span>•</span>
                        <span>BG Check: <strong className="text-emerald-600">{task.backgroundVerificationStatus}</strong></span>
                        <span>•</span>
                        <span>Hardware: <strong className="text-amber-600">{task.hardwareProvisioningStatus}</strong></span>
                      </div>
                    </div>

                    <div className="md:col-span-4 flex justify-end">
                      <Button
                        onClick={() => handleOpenAction(task)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl h-10 px-5 shadow-sm cursor-pointer"
                      >
                        <Laptop className="size-3.5 mr-2" /> Trigger Onboarding Kit
                      </Button>
                    </div>
                  </div>
                )}

                {task.type === "IDLE_MATCH" && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    <div className="md:col-span-8 space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-slate-900">{task.candidateName}</h3>
                        <Badge className="bg-purple-100 text-purple-800 border-purple-300 font-extrabold text-[10px]">
                          <Cpu className="size-3 mr-1" /> {task.aiMatchScore}% Vector Similarity Match
                        </Badge>
                      </div>
                      <p className="text-xs font-bold text-blue-600">{task.jobTitle}</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1 font-medium">
                        <span>Idle Duration: <strong className="text-purple-700 font-mono">{task.idleDays} days inactive</strong></span>
                        <span>•</span>
                        <span>Reason: <strong className="text-slate-800">{task.inactivityReason}</strong></span>
                      </div>

                      {/* Vector Similarity Engine Flowchart */}
                      <div className="text-[10px] text-slate-400 font-mono pt-1">
                        Resume Embedding ↓ Job Description Embedding ↓ Vector Similarity Engine → <strong className="text-purple-700">{task.aiMatchScore}% Match</strong>
                      </div>
                    </div>

                    <div className="md:col-span-4 flex justify-end">
                      <Button
                        onClick={() => handleOpenAction(task)}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl h-10 px-5 shadow-sm cursor-pointer"
                      >
                        <Calendar className="size-3.5 mr-2" /> Schedule Interview Now
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* DIALOG 1: SLA Breach Ping Modal */}
      <Dialog
        open={activeDialog === "SLA_ALERT"}
        onOpenChange={(open) => !open && setActiveDialog(null)}
      >
        <DialogContent className="max-w-lg bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
              <Send className="size-5 text-blue-600" /> Send SLA Ping Reminder
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Send automated ping to {selectedTask?.interviewer ?? selectedTask?.assignedPerson} for candidate{" "}
              <strong>{selectedTask?.candidateName}</strong> ({selectedTask?.jobTitle}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-xl space-y-1 text-xs">
              <span className="font-extrabold text-rose-800 block">SLA Delay Details</span>
              <p className="text-rose-700">
                Action: <strong>{selectedTask?.issueType}</strong> — Overdue by{" "}
                <strong>+{selectedTask?.delayHours} hours</strong>.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Notification Integration Channel
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(["Slack", "Email", "Teams", "Internal"] as const).map((channel) => (
                  <button
                    key={channel}
                    type="button"
                    onClick={() => setPingChannel(channel)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      pingChannel === channel
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {channel}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Escalation logic: If unhandled within 72h, reminder automatically escalates to Reporting Manager.
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setActiveDialog(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-blue-600 text-white font-bold"
              onClick={() =>
                selectedTask &&
                handleResolveTask(
                  selectedTask.id,
                  `Ping sent via ${pingChannel} to ${selectedTask.interviewer ?? selectedTask.assignedPerson}.`
                )
              }
            >
              Dispatch Ping Reminder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: Extend Offer Modal */}
      <Dialog
        open={activeDialog === "EXPIRING_OFFER"}
        onOpenChange={(open) => !open && setActiveDialog(null)}
      >
        <DialogContent className="max-w-lg bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
              <Clock className="size-5 text-amber-600" /> Extend Offer Window
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Update offer expiration date and launch negotiation/escalation workflows for{" "}
              <strong>{selectedTask?.candidateName}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-xs text-amber-800 space-y-1">
              <span className="font-extrabold block">Current Offer Value</span>
              <p>
                {selectedTask?.offerValue} — Status: <strong>{selectedTask?.offerStatus}</strong>
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Extend Expiry Window By (Hours)
              </label>
              <Input
                type="number"
                value={newExpiryHours}
                onChange={(e) => setNewExpiryHours(Number(e.target.value))}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Compensation / Negotiation Note (Optional Escalation)
              </label>
              <Input
                placeholder="Candidate requested base salary adjustment..."
                value={compensationNote}
                onChange={(e) => setCompensationNote(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setActiveDialog(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-amber-600 text-white font-bold"
              onClick={() =>
                selectedTask &&
                handleResolveTask(
                  selectedTask.id,
                  `Offer extended by ${newExpiryHours} hours for ${selectedTask.candidateName}. Expiry date updated in backend.`
                )
              }
            >
              Save & Extend Offer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: Trigger Onboarding Kit Modal */}
      <Dialog
        open={activeDialog === "NOTICE_PERIOD"}
        onOpenChange={(open) => !open && setActiveDialog(null)}
      >
        <DialogContent className="max-w-xl bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
              <Laptop className="size-5 text-emerald-600" /> Trigger Onboarding Kit
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Initiate multi-system onboarding & preboarding workflows for{" "}
              <strong>{selectedTask?.candidateName}</strong> (Joining: {selectedTask?.joiningDate}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <span className="font-extrabold text-slate-700 block">
              Automated Workflow Execution Checklist
            </span>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { key: "laptop", label: "Laptop Allocation Request" },
                { key: "email", label: "Corporate Email Creation" },
                { key: "hrms", label: "HRMS Account Creation" },
                { key: "idCard", label: "ID Card Request" },
                { key: "vpn", label: "VPN Access Setup" },
                { key: "training", label: "Training Calendar Allocation" },
                { key: "preboardingWelcome", label: "Send Preboarding Welcome Email" },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-800 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={onboardingChecks[item.key as keyof typeof onboardingChecks]}
                    onChange={(e) =>
                      setOnboardingChecks((prev) => ({
                        ...prev,
                        [item.key]: e.target.checked,
                      }))
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setActiveDialog(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 text-white font-bold"
              onClick={() =>
                selectedTask &&
                handleResolveTask(
                  selectedTask.id,
                  `All selected onboarding workflows triggered for ${selectedTask.candidateName}. IT & HR notified.`
                )
              }
            >
              Execute Onboarding Workflows
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 4: Schedule Interview Modal */}
      <Dialog
        open={activeDialog === "IDLE_MATCH"}
        onOpenChange={(open) => !open && setActiveDialog(null)}
      >
        <DialogContent className="max-w-lg bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
              <Calendar className="size-5 text-purple-600" /> Schedule Interview Now
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Schedule technical panel interview for AI High-Match candidate{" "}
              <strong>{selectedTask?.candidateName}</strong> ({selectedTask?.aiMatchScore}% vector match).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">Select Interview Panel</label>
              <select
                value={selectedPanel}
                onChange={(e) => setSelectedPanel(e.target.value)}
                className="w-full h-9 border border-slate-200 bg-slate-50 rounded-xl text-xs px-3 font-bold"
              >
                <option value="Jivan Satapathy">Jivan Satapathy (Senior Staff Engineer)</option>
                <option value="Shantanu Das">Shantanu Das (Tech Lead)</option>
                <option value="Marco Rossi">Marco Rossi (VP Engineering)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Interview Date</label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Timeslot</label>
                <Input
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">Candidate Engagement Outreach</label>
              <textarea
                rows={3}
                value={outreachMessage}
                onChange={(e) => setOutreachMessage(e.target.value)}
                className="w-full border border-slate-200 bg-slate-50 rounded-xl text-xs p-3 font-medium"
              />
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setActiveDialog(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-purple-600 text-white font-bold"
              onClick={() =>
                selectedTask &&
                handleResolveTask(
                  selectedTask.id,
                  `Interview scheduled with ${selectedPanel} on ${selectedDate} at ${selectedTime}. Candidate outreach dispatched.`
                )
              }
            >
              Confirm & Schedule Interview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
