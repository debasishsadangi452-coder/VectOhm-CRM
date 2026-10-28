import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileCheck,
  HeartPulse,
  Info,
  Layers,
  Loader2,
  Palmtree,
  Send,
  ShieldAlert,
  ShieldCheck,
  SunMedium,
  Umbrella,
  User,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthStore } from "@/stores/auth-store";
import { useCreateLeaveRequest, useLeaveRequests, useLeaveStats } from "@/hooks/use-leave-requests";
import { LeaveType, LEAVE_TYPE_LABELS, LEAVE_TYPE_COLORS } from "@/lib/api/types";

interface LeaveRequestPagePanelProps {
  onBack: () => void;
  onCreated?: () => void;
}

interface LeaveOption {
  type: LeaveType;
  title: string;
  subtitle: string;
  badge: string;
  icon: React.ElementType;
  tone: string;
  borderTone: string;
  bgTone: string;
  policyNote: string;
}

const LEAVE_OPTIONS: LeaveOption[] = [
  {
    type: "ANNUAL",
    title: "Annual Leave",
    subtitle: "Vacation, family trips, personal recreation & planned time off",
    badge: "Planned Time Off",
    icon: Palmtree,
    tone: "text-emerald-500",
    borderTone: "border-emerald-500/40 hover:border-emerald-500/70",
    bgTone: "bg-emerald-500/10",
    policyNote: "Please apply at least 2 business days in advance for operational scheduling.",
  },
  {
    type: "SICK",
    title: "Sick Leave",
    subtitle: "Medical care, unexpected illness, doctor visits & health recovery",
    badge: "Medical & Health",
    icon: HeartPulse,
    tone: "text-rose-500",
    borderTone: "border-rose-500/40 hover:border-rose-500/70",
    bgTone: "bg-rose-500/10",
    policyNote: "A medical certificate may be requested for sick leaves exceeding 2 consecutive days.",
  },
  {
    type: "CASUAL",
    title: "Casual Leave",
    subtitle: "Short personal errands, urgent domestic matters & unexpected tasks",
    badge: "Short Notice",
    icon: SunMedium,
    tone: "text-amber-500",
    borderTone: "border-amber-500/40 hover:border-amber-500/70",
    bgTone: "bg-amber-500/10",
    policyNote: "Ideal for urgent short-notice personal commitments (1-2 days).",
  },
  {
    type: "UNPAID",
    title: "Unpaid Leave",
    subtitle: "Extended time off without salary deduction once limits are reached",
    badge: "Loss of Pay",
    icon: Umbrella,
    tone: "text-slate-400",
    borderTone: "border-slate-500/40 hover:border-slate-500/70",
    bgTone: "bg-slate-500/10",
    policyNote: "Requires explicit manager approval and HR sign-off.",
  },
];

export function LeaveRequestPagePanel({ onBack, onCreated }: LeaveRequestPagePanelProps) {
  const currentUser = useAuthStore((s) => s.user);
  const createLeaveMutation = useCreateLeaveRequest();
  const { data: myLeaves = [] } = useLeaveRequests({ userId: currentUser?.id });

  const [selectedType, setSelectedType] = useState<LeaveType>("ANNUAL");
  const [dayType, setDayType] = useState<"FULL" | "FIRST_HALF" | "SECOND_HALF">("FULL");
  const [startDate, setStartDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });
  const [reason, setReason] = useState("");
  const [handoverNotes, setHandoverNotes] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Calculate working days between start & end
  const durationDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) return 0;

    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) {
        count++;
      }
      cur.setDate(cur.getDate() + 1);
    }
    const baseDays = count === 0 ? 1 : count;
    if (dayType === "FIRST_HALF" || dayType === "SECOND_HALF") {
      return 0.5;
    }
    return baseDays;
  }, [startDate, endDate, dayType]);

  // Historical leave summary
  const approvedLeavesCount = myLeaves.filter((l) => l.status === "APPROVED").length;
  const pendingLeavesCount = myLeaves.filter((l) => l.status === "PENDING").length;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    if (!startDate || !endDate) {
      const msg = "Please select both start and end dates.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      const msg = "End date cannot be earlier than start date.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    if (!reason.trim()) {
      const msg = "Please provide a reason for your leave request.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    let compiledReason = reason.trim();
    if (dayType !== "FULL") {
      const sessionLabel = dayType === "FIRST_HALF" ? "First Half (Morning)" : "Second Half (Afternoon)";
      compiledReason = `[Session: ${sessionLabel} - 4 hrs]\n` + compiledReason;
    }
    if (handoverNotes.trim()) {
      compiledReason += `\n\n[Handover / Stand-in]: ${handoverNotes.trim()}`;
    }
    if (emergencyPhone.trim()) {
      compiledReason += `\n[Emergency Contact]: ${emergencyPhone.trim()}`;
    }

    try {
      await createLeaveMutation.mutateAsync({
        type: selectedType,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        reason: compiledReason || undefined,
      });

      toast.success("Leave request submitted successfully for approval!");
      if (onCreated) onCreated();
      else onBack();
    } catch (err: unknown) {
      console.error("Failed to submit leave request:", err);
      const msg = (err as { message?: string })?.message || "Failed to submit leave request. Please try again.";
      setErrorMessage(msg);
      toast.error(msg);
    }
  };

  const currentOption = LEAVE_OPTIONS.find((o) => o.type === selectedType) || LEAVE_OPTIONS[0];

  return (
    <div className="bg-canvas min-h-[calc(100vh-4rem)] flex flex-col text-text animate-in fade-in duration-150">
      {/* ── Sticky Top Bar ── */}
      <div className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur-md px-6 py-4">
        <div className="max-w-[1500px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-xl border border-border bg-card hover:bg-card-hover text-text-dim hover:text-text transition-colors shadow-2xs group cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="size-4 group-hover:-translate-x-0.5 transition-transform" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-text-dim">HR & Operations</span>
                <span className="text-xs text-text-dim">/</span>
                <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary bg-primary/5">
                  HR Portal
                </Badge>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-text mt-0.5">
                Submit Leave Request
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              disabled={createLeaveMutation.isPending}
              className="border-border hover:bg-card-hover text-xs font-semibold"
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={() => handleSubmit()}
              disabled={createLeaveMutation.isPending || !reason.trim()}
              className="bg-primary hover:bg-primary-hover text-primary-foreground font-bold text-xs gap-2 shadow-sm min-w-[140px]"
            >
              {createLeaveMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  Submit Request
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Main Layout Container ── */}
      <div className="max-w-[1500px] mx-auto w-full p-6 space-y-6 flex-1">
        {errorMessage && (
          <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-destructive/80 hover:text-destructive"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ── Left Rail: Main Form Inputs (8 cols) ── */}
          <div className="lg:col-span-8 space-y-6">
            {/* Section 1: Leave Category Selection */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-2xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Layers className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-text">1. Choose Leave Type</h2>
                    <p className="text-xs text-text-dim">
                      Select the category that corresponds to your time-off request
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs font-semibold border-border">
                  Selected: <strong className="text-primary ml-1">{LEAVE_TYPE_LABELS[selectedType]}</strong>
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {LEAVE_OPTIONS.map((opt) => {
                  const isSelected = selectedType === opt.type;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.type}
                      type="button"
                      onClick={() => setSelectedType(opt.type)}
                      className={`relative text-left p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? `border-primary bg-primary/5 ring-1 ring-primary/40 shadow-xs`
                          : "border-border bg-card/60 hover:bg-card hover:border-border-hover"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className={`p-2 rounded-lg ${opt.bgTone} ${opt.tone}`}>
                            <Icon className="size-4" />
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-semibold ${opt.tone} border-current/20`}
                          >
                            {opt.badge}
                          </Badge>
                        </div>
                        <h3 className="font-bold text-sm text-text">{opt.title}</h3>
                        <p className="text-xs text-text-dim mt-1 leading-relaxed line-clamp-2">
                          {opt.subtitle}
                        </p>
                      </div>

                      {isSelected && (
                        <div className="mt-3 pt-2 border-t border-primary/20 flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                          <CheckCircle2 className="size-3.5" />
                          <span>Active Selection</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Duration & Dates */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-2xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <CalendarDays className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-text">2. Duration & Schedule</h2>
                    <p className="text-xs text-text-dim">
                      Specify the leave interval, session type, and calculated working duration
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="start-date" className="text-xs font-semibold text-text">
                    Start Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (new Date(e.target.value) > new Date(endDate)) {
                        setEndDate(e.target.value);
                      }
                    }}
                    required
                    className="bg-background text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="end-date" className="text-xs font-semibold text-text">
                    End Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="end-date"
                    type="date"
                    min={startDate}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="bg-background text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-text">Session Type</Label>
                  <Select
                    value={dayType}
                    onValueChange={(val: "FULL" | "FIRST_HALF" | "SECOND_HALF") => setDayType(val)}
                  >
                    <SelectTrigger className="bg-background text-xs">
                      <SelectValue placeholder="Session" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FULL">Full Day (8 hrs)</SelectItem>
                      <SelectItem value="FIRST_HALF">First Half - Morning (4 hrs)</SelectItem>
                      <SelectItem value="SECOND_HALF">Second Half - Afternoon (4 hrs)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Working Duration Highlight Banner */}
              <div className="rounded-xl bg-card-hover border border-border p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                    <Calendar className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-text">Calculated Workday Impact</p>
                    <p className="text-[11px] text-text-dim">
                      Excludes weekends (Saturday & Sunday) automatically
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="px-3 py-1 text-xs font-bold font-mono">
                    {durationDays} {durationDays === 1 ? "Working Day" : "Working Days"}
                  </Badge>
                  <Badge variant="outline" className="px-2.5 py-1 text-xs font-mono text-text-dim border-border">
                    {durationDays * 8} Hours
                  </Badge>
                </div>
              </div>
            </div>

            {/* Section 3: Reason & Coverage Details */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-2xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <FileCheck className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-text">3. Reason & Handover Information</h2>
                    <p className="text-xs text-text-dim">
                      Provide justification and work coverage details for your team
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="leave-reason" className="text-xs font-semibold text-text">
                    Reason for Leave <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="leave-reason"
                    rows={4}
                    placeholder="Brief explanation of your leave request and operational plan..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                    className="bg-background text-xs resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="handover-notes" className="text-xs font-medium text-text-dim">
                      Work Handover / Stand-in Person (Optional)
                    </Label>
                    <Input
                      id="handover-notes"
                      type="text"
                      placeholder="e.g. Subhram will cover tickets and sprint reviews"
                      value={handoverNotes}
                      onChange={(e) => setHandoverNotes(e.target.value)}
                      className="bg-background text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="emergency-phone" className="text-xs font-medium text-text-dim">
                      Emergency Contact Number (Optional)
                    </Label>
                    <Input
                      id="emergency-phone"
                      type="tel"
                      placeholder="e.g. +1 (555) 019-2834"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      className="bg-background text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Policy Alert Banner */}
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 flex items-start gap-3 text-xs text-text">
                  <ShieldCheck className="size-4 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-primary">Policy Note for {currentOption.title}</p>
                    <p className="text-text-dim text-[11px] leading-relaxed">
                      {currentOption.policyNote} Upon submission, this request is queued for automated
                      routing to your reporting manager and the HR Operations team.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right Rail: Summary & Balances Sidebar (4 cols) ── */}
          <div className="lg:col-span-4 space-y-6">
            {/* Card 1: Leave Balances & Entitlement */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-2xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-primary" />
                  <h2 className="text-sm font-bold text-text">Leave Balances</h2>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono border-border">
                  Year 2026
                </Badge>
              </div>

              <div className="space-y-4">
                {/* Annual */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-text flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-emerald-500" />
                      Annual Leave
                    </span>
                    <span className="font-mono text-text-dim">
                      <strong className="text-emerald-500">14</strong> / 18 days
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-border/60 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full w-[77%]" />
                  </div>
                </div>

                {/* Sick */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-text flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-rose-500" />
                      Sick Leave
                    </span>
                    <span className="font-mono text-text-dim">
                      <strong className="text-rose-500">8</strong> / 10 days
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-border/60 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 rounded-full w-[80%]" />
                  </div>
                </div>

                {/* Casual */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-text flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-amber-500" />
                      Casual Leave
                    </span>
                    <span className="font-mono text-text-dim">
                      <strong className="text-amber-500">4</strong> / 6 days
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-border/60 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full w-[66%]" />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-border grid grid-cols-2 gap-2 text-center">
                <div className="p-2.5 rounded-lg bg-card-hover border border-border">
                  <p className="text-[10px] uppercase font-bold text-text-dim">Approved</p>
                  <p className="text-base font-bold text-emerald-500 mt-0.5">{approvedLeavesCount}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-card-hover border border-border">
                  <p className="text-[10px] uppercase font-bold text-text-dim">Pending</p>
                  <p className="text-base font-bold text-amber-500 mt-0.5">{pendingLeavesCount}</p>
                </div>
              </div>
            </div>

            {/* Card 2: Live Request Summary */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Info className="size-4 text-primary" />
                  <h2 className="text-sm font-bold text-text">Request Summary</h2>
                </div>
                <Badge variant="secondary" className="text-[10px] font-semibold">
                  Preview
                </Badge>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-text-dim">Category</span>
                  <Badge variant="outline" className={`font-semibold ${currentOption.tone} border-current/20`}>
                    {currentOption.title}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-text-dim">Duration</span>
                  <span className="font-bold text-text font-mono">
                    {durationDays} {durationDays === 1 ? "Day" : "Days"} ({durationDays * 8}h)
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-text-dim">Dates</span>
                  <span className="font-mono text-text font-semibold">
                    {startDate} &rarr; {endDate}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-text-dim">Session</span>
                  <span className="text-text font-medium">
                    {dayType === "FULL" ? "Full Day" : dayType === "FIRST_HALF" ? "1st Half" : "2nd Half"}
                  </span>
                </div>

                <div className="pt-3 border-t border-border space-y-2">
                  <span className="text-text-dim text-[11px] block font-semibold uppercase tracking-wider">
                    Approval Workflow
                  </span>
                  <div className="flex items-center gap-2 text-text text-xs bg-card-hover p-2.5 rounded-lg border border-border">
                    <div className="size-6 rounded-full bg-primary/20 text-primary grid place-items-center font-bold text-[10px]">
                      1
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">Direct Reporting Manager</p>
                      <p className="text-[10px] text-text-dim truncate">Initial verification</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-text text-xs bg-card-hover p-2.5 rounded-lg border border-border">
                    <div className="size-6 rounded-full bg-emerald-500/20 text-emerald-500 grid place-items-center font-bold text-[10px]">
                      2
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">HR Operations & Payroll</p>
                      <p className="text-[10px] text-text-dim truncate">Final record & quota update</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Policies & Guidelines */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-2xs space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <ShieldCheck className="size-4 text-emerald-500" />
                <h2 className="text-sm font-bold text-text">Leave Policies</h2>
              </div>
              <ul className="text-[11px] text-text-dim space-y-2 leading-relaxed">
                <li className="flex items-start gap-1.5">
                  <span className="text-primary font-bold">•</span>
                  <span><strong>Notice Period:</strong> Apply 2 days in advance for annual leaves.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-primary font-bold">•</span>
                  <span><strong>Stand-in:</strong> Ensure critical ticket handovers are communicated.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-primary font-bold">•</span>
                  <span><strong>Cancellation:</strong> You can cancel pending requests anytime from your Account tab.</span>
                </li>
              </ul>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
