import { useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Briefcase,
  Building2,
  Calendar,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Filter,
  Flame,
  Globe,
  HelpCircle,
  Info,
  Layers,
  Loader2,
  Mail,
  MailCheck,
  MapPin,
  Newspaper,
  Pencil,
  Play,
  Plus,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  Users,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  useApproveAllOutreach,
  useApproveOutreach,
  useCreateIntentAutomation,
  useDeleteIntentAutomation,
  useIntentAutomationLeads,
  useIntentAutomationRuns,
  useIntentAutomations,
  useIntentOutreach,
  useRejectOutreach,
  useRunIntentAutomation,
  useUpdateIntentAutomation,
  useUpdateOutreachDraft,
} from "@/hooks/use-intent-automations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type {
  IntentAutomation,
  IntentAutomationFrequency,
  IntentAutomationInput,
  IntentAutomationSource,
  IntentLeadOutcome,
  IntentOutreach,
} from "@/lib/api/intent-automations";
import type { NewsSignalCategory } from "@/lib/api/hiring-signals";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SOURCE_LABEL: Record<IntentAutomationSource, string> = {
  HIRING: "Intent Hiring",
  NEWS: "Intent News",
  BOTH: "Hiring + News",
};
const NEWS_SIGNALS: Array<{ value: NewsSignalCategory | "ANY"; label: string }> = [
  { value: "ANY", label: "Any signal" },
  { value: "FUNDING", label: "Funding" },
  { value: "EXPANSION", label: "Expansion" },
  { value: "LEADERSHIP", label: "Leadership change" },
  { value: "PRODUCT", label: "Product launch" },
  { value: "PARTNERSHIP", label: "Partnership / M&A" },
];

const POPULAR_ROLES = [
  "Full Stack Developer",
  "DevOps Engineer",
  "Backend Engineer",
  "Frontend Engineer",
  "Data Engineer",
  "Product Manager",
  "Tech Lead",
];

const POPULAR_LOCATIONS = ["India", "United States", "United Kingdom", "Singapore", "Remote", "Global"];

const POPULAR_TOPICS = ["B2B SaaS", "Fintech", "Generative AI", "Healthtech", "Cloud Infrastructure", "Cybersecurity"];

const OFFER_SNIPPETS = [
  {
    label: "Technical Staffing",
    text: "We supply pre-vetted full stack, DevOps, and backend software engineers to growing product companies on contract or permanent basis with 48h turnaround.",
  },
  {
    label: "Executive Search",
    text: "We specialize in placing senior engineering leaders, directors, and principal architects into high-growth software and tech companies.",
  },
  {
    label: "Dedicated Squads",
    text: "We provide dedicated software development squads specializing in TypeScript, Python, Cloud infrastructure, and AI engineering.",
  },
];

const TONE_PRESETS = [
  "friendly and professional",
  "direct and concise",
  "consultative and executive",
  "warm and congratulatory",
];

interface AutomationTemplate {
  title: string;
  badge: string;
  description: string;
  preset: Partial<FormState>;
}

const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    title: "India Tech & Engineering Expansion",
    badge: "Hiring Signal",
    description: "Target companies with active open postings for Full Stack, DevOps, and Backend engineers in India.",
    preset: {
      name: "India Tech & Engineering Hiring",
      source: "HIRING",
      roles: "Full Stack Developer, DevOps Engineer, Backend Engineer, Frontend Engineer",
      location: "India",
      frequency: "DAILY",
      timeOfDay: "09:30",
      dailyCap: "25",
      cooldownDays: "30",
      offerDescription:
        "We provide pre-vetted senior software engineers (full stack, backend, DevOps, React) on flexible contract or full-time placement with 48-hour matching.",
      tone: "friendly and professional",
      autoSend: false,
    },
  },
  {
    title: "SaaS Scaleups Funding & Growth",
    badge: "Hiring + News",
    description: "Discover venture-funded SaaS companies hiring engineering and product leadership.",
    preset: {
      name: "SaaS Scaleups Funding & Leadership",
      source: "BOTH",
      roles: "VP of Engineering, Head of Engineering, Tech Lead, Senior Software Engineer",
      location: "Global",
      newsKeywords: "B2B SaaS, enterprise software, AI platform, cloud infrastructure",
      newsCategory: "FUNDING",
      newsDaysBack: "30",
      frequency: "DAILY",
      timeOfDay: "10:00",
      dailyCap: "20",
      cooldownDays: "45",
      offerDescription:
        "We help venture-backed software companies rapidly scale their engineering squads with specialized senior tech talent without traditional agency search overhead.",
      tone: "consultative and executive",
      autoSend: false,
    },
  },
  {
    title: "Executive & Leadership Changes",
    badge: "News Signal",
    description: "Reach newly appointed C-level and VP leaders as they build their high-performance technical teams.",
    preset: {
      name: "Executive & Leadership Changes",
      source: "NEWS",
      roles: "",
      location: "",
      newsKeywords: "fintech, SaaS, artificial intelligence, enterprise software",
      newsCategory: "LEADERSHIP",
      newsDaysBack: "30",
      frequency: "WEEKDAYS",
      timeOfDay: "09:00",
      dailyCap: "15",
      cooldownDays: "60",
      offerDescription:
        "Congratulations on your recent executive appointment. We partner with newly appointed engineering leadership to build high-performance technical squads and specialized talent pipelines.",
      tone: "warm and congratulatory",
      autoSend: false,
    },
  },
];

const istFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});
const formatIst = (iso: string | null) => (iso ? `${istFormat.format(new Date(iso))} IST` : "—");

export function scheduleLabel(a: {
  frequency: IntentAutomationFrequency;
  timeOfDay: string;
  weekday?: number | string | null;
}) {
  const when = a.timeOfDay;
  if (a.frequency === "DAILY") return `Every day at ${when}`;
  if (a.frequency === "WEEKDAYS") return `Weekdays at ${when}`;
  const dayIndex = typeof a.weekday === "string" ? Number(a.weekday) : (a.weekday ?? 1);
  return `Every ${WEEKDAYS[dayIndex] ?? "Monday"} at ${when}`;
}


export interface FormState {
  name: string;
  source: IntentAutomationSource;
  roles: string;
  location: string;
  newsKeywords: string;
  newsCategory: NewsSignalCategory | "ANY";
  newsDaysBack: string;
  frequency: IntentAutomationFrequency;
  timeOfDay: string;
  weekday: string;
  autoSend: boolean;
  dailyCap: string;
  cooldownDays: string;
  offerDescription: string;
  tone: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  source: "BOTH",
  roles: "",
  location: "",
  newsKeywords: "",
  newsCategory: "ANY",
  newsDaysBack: "30",
  frequency: "DAILY",
  timeOfDay: "09:00",
  weekday: "1",
  autoSend: false,
  dailyCap: "25",
  cooldownDays: "30",
  offerDescription: "",
  tone: "friendly and professional",
};

function toForm(a: IntentAutomation): FormState {
  return {
    name: a.name,
    source: a.source,
    roles: a.roles.join(", "),
    location: a.location ?? "",
    newsKeywords: a.newsKeywords ?? "",
    newsCategory: a.newsCategory ?? "ANY",
    newsDaysBack: String(a.newsDaysBack),
    frequency: a.frequency,
    timeOfDay: a.timeOfDay,
    weekday: String(a.weekday ?? 1),
    autoSend: a.autoSend,
    dailyCap: String(a.dailyCap),
    cooldownDays: String(a.cooldownDays),
    offerDescription: a.offerDescription,
    tone: a.tone,
  };
}

export function formToInput(f: FormState): IntentAutomationInput {
  const roles = f.roles.split(",").map((r) => r.trim()).filter(Boolean);
  return {
    name: f.name.trim(),
    source: f.source,
    roles: f.source === "NEWS" ? [] : roles,
    location: f.location.trim() || undefined,
    newsKeywords: f.source === "HIRING" ? undefined : f.newsKeywords.trim() || undefined,
    newsCategory: f.source === "HIRING" || f.newsCategory === "ANY" ? undefined : f.newsCategory,
    newsDaysBack: Number(f.newsDaysBack),
    frequency: f.frequency,
    timeOfDay: f.timeOfDay,
    weekday: f.frequency === "WEEKLY" ? Number(f.weekday) : undefined,
    autoSend: f.autoSend,
    dailyCap: Number(f.dailyCap),
    cooldownDays: Number(f.cooldownDays),
    offerDescription: f.offerDescription.trim(),
    tone: f.tone.trim() || undefined,
  };
}

function errMsg(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

interface AutomationEditorPageProps {
  editing: IntentAutomation | "new";
  form: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  saving: boolean;
  onCancel: () => void;
  onSubmit: () => Promise<void>;
}

function AutomationEditorPage({
  editing,
  form,
  set,
  setForm,
  saving,
  onCancel,
  onSubmit,
}: AutomationEditorPageProps) {
  const needsRoles = form.source !== "NEWS";
  const needsNews = form.source !== "HIRING";

  const currentRoles = form.roles
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);

  function addRole(r: string) {
    if (currentRoles.includes(r)) return;
    if (currentRoles.length >= 5) {
      toast.error("Maximum 5 job roles allowed.");
      return;
    }
    const updated = [...currentRoles, r].join(", ");
    set("roles", updated);
  }

  function removeRole(r: string) {
    const updated = currentRoles.filter((item) => item !== r).join(", ");
    set("roles", updated);
  }

  function addTopic(topic: string) {
    const existing = form.newsKeywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (existing.includes(topic)) return;
    const updated = [...existing, topic].join(", ");
    set("newsKeywords", updated);
  }

  function applyTemplate(tpl: AutomationTemplate) {
    setForm((prev) => ({
      ...prev,
      ...tpl.preset,
    }));
    toast.success(`Loaded "${tpl.title}" blueprint`);
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ─── Top Header & Sticky Navigation ─── */}
      <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-7 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="gap-1.5 h-8 px-2.5 text-text-dim hover:text-foreground -ml-1"
              >
                <ArrowLeft className="size-4" /> Back to automations
              </Button>
              <span className="text-border">/</span>
              <span className="text-xs font-bold text-primary px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                {editing === "new" ? "New Automation" : "Edit Automation"}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
              {editing === "new" ? (
                <>
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                    <Sparkles className="size-5" />
                  </div>
                  Configure Scheduled Automation
                </>
              ) : (
                <>
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                    <Pencil className="size-5" />
                  </div>
                  Edit Automation: {form.name || "Untitled"}
                </>
              )}
            </h1>
            <p className="text-xs sm:text-sm text-text-dim max-w-2xl leading-relaxed">
              Automates talent search, Apollo decision-maker extraction, and AI-personalized outreach drafting from your mailbox.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
            <Button variant="outline" onClick={onCancel} disabled={saving} className="font-semibold">
              Cancel
            </Button>
            <Button onClick={onSubmit} disabled={saving} className="gap-2 font-bold shadow-sm">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              {editing === "new" ? "Create Automation" : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Starter Presets Banner ─── */}
      <div className="rounded-2xl border border-primary/25 bg-primary/[0.03] p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Zap className="size-3.5" />
            </div>
            <span className="text-xs sm:text-sm font-bold text-foreground">Quick-Start Blueprints</span>
            <span className="text-[11px] text-text-dim hidden md:inline">
              (1-click pre-fill with proven recruitment search & copy setups)
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {AUTOMATION_TEMPLATES.map((tpl) => (
            <button
              key={tpl.title}
              type="button"
              onClick={() => applyTemplate(tpl)}
              className="text-left rounded-xl border border-border/80 bg-card p-4 hover:border-primary/50 hover:bg-card/90 transition-all group flex flex-col justify-between shadow-2xs"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {tpl.title}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
                    {tpl.badge}
                  </span>
                </div>
                <p className="text-[11px] text-text-dim leading-snug line-clamp-2">{tpl.description}</p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-border/50 text-[11px] font-semibold text-primary flex items-center justify-between">
                <span>Load blueprint</span>
                <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Two-Column Main Layout ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Main Form */}
        <div className="lg:col-span-8 space-y-6">
          {/* Card 1: Identity & Signal Source */}
          <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-border/60">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Layers className="size-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">1. Automation Identity & Signal Source</h2>
                <p className="text-[11px] text-text-dim">Define what triggers leads and where to search</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ia-name" className="text-xs font-bold flex items-center gap-1">
                  Automation Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ia-name"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. India Tech & Engineering Expansion"
                  className="h-10 text-sm font-medium"
                />
              </div>

              {/* Source Visual Card Selection */}
              <div className="space-y-2">
                <Label className="text-xs font-bold">Signal Source</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      id: "BOTH" as const,
                      label: "Hiring + News",
                      badge: "Recommended",
                      icon: Zap,
                      desc: "Combines active job openings with company news triggers for highest intent.",
                    },
                    {
                      id: "HIRING" as const,
                      label: "Intent Hiring",
                      badge: "Jobs Only",
                      icon: Briefcase,
                      desc: "Detects companies actively posting open positions matching your roles.",
                    },
                    {
                      id: "NEWS" as const,
                      label: "Intent News",
                      badge: "Triggers Only",
                      icon: Newspaper,
                      desc: "Monitors business events: funding rounds, expansion, and executive shifts.",
                    },
                  ].map((s) => {
                    const isSelected = form.source === s.id;
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => set("source", s.id)}
                        className={`text-left rounded-xl p-3.5 border transition-all flex flex-col justify-between ${
                          isSelected
                            ? "border-primary bg-primary/[0.07] ring-2 ring-primary/20 shadow-xs"
                            : "border-border/80 bg-card hover:border-border hover:bg-muted/30"
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div
                              className={`flex size-7 items-center justify-center rounded-lg ${
                                isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-text-dim"
                              }`}
                            >
                              <Icon className="size-3.5" />
                            </div>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isSelected
                                  ? "bg-primary/20 text-primary"
                                  : "bg-muted text-text-dim border border-border/60"
                              }`}
                            >
                              {s.badge}
                            </span>
                          </div>
                          <div className="font-bold text-xs text-foreground">{s.label}</div>
                          <p className="text-[11px] text-text-dim leading-snug">{s.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Location */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ia-location" className="text-xs font-bold">
                    Target Geographic Location
                  </Label>
                  <span className="text-[11px] text-text-dim">Leave blank for global</span>
                </div>
                <div className="relative">
                  <MapPin className="size-4 text-text-dim absolute left-3 top-3 pointer-events-none" />
                  <Input
                    id="ia-location"
                    value={form.location}
                    onChange={(e) => set("location", e.target.value)}
                    placeholder="e.g. India, United States, Europe, or Global"
                    className="pl-9 h-10 text-sm"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-text-dim">Quick select:</span>
                  {POPULAR_LOCATIONS.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => set("location", loc === "Global" ? "" : loc)}
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-md border transition-colors ${
                        (loc === "Global" && !form.location) || form.location === loc
                          ? "bg-primary/10 border-primary/30 text-primary font-bold"
                          : "border-border/60 hover:bg-muted text-text-dim hover:text-foreground"
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Criteria & Decision-Maker Targeting */}
          <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-border/60">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Target className="size-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">2. Search Criteria & Lead Targeting</h2>
                <p className="text-[11px] text-text-dim">Filter matching job titles and news categories</p>
              </div>
            </div>

            <div className="space-y-5">
              {needsRoles && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="ia-roles" className="text-xs font-bold flex items-center gap-1">
                      Job roles to look for <span className="text-destructive">*</span>
                      <span className="text-[11px] font-normal text-text-dim">(comma-separated, max 5)</span>
                    </Label>
                    <span className="text-[11px] font-bold text-primary">
                      {currentRoles.length} / 5 roles defined
                    </span>
                  </div>

                  <Input
                    id="ia-roles"
                    value={form.roles}
                    onChange={(e) => set("roles", e.target.value)}
                    placeholder="Full Stack Developer, DevOps Engineer, Backend Engineer"
                    className="h-10 text-sm"
                  />

                  {currentRoles.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {currentRoles.map((role) => (
                        <span
                          key={role}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md bg-secondary text-foreground border border-border"
                        >
                          <Briefcase className="size-3 text-primary" /> {role}
                          <button
                            type="button"
                            onClick={() => removeRole(role)}
                            className="ml-1 text-text-dim hover:text-destructive"
                            title="Remove role"
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-text-dim">Add popular roles:</span>
                    {POPULAR_ROLES.map((r) => {
                      const hasIt = currentRoles.includes(r);
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => addRole(r)}
                          disabled={hasIt}
                          className={`text-[11px] font-medium px-2 py-0.5 rounded-md border transition-colors ${
                            hasIt
                              ? "opacity-50 cursor-not-allowed bg-muted text-text-dim border-border/40"
                              : "border-border/60 hover:border-primary/40 hover:bg-primary/5 text-text-dim hover:text-primary"
                          }`}
                        >
                          + {r}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {needsNews && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="ia-keywords" className="text-xs font-bold flex items-center gap-1">
                      News Industry / Topics <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="ia-keywords"
                      value={form.newsKeywords}
                      onChange={(e) => set("newsKeywords", e.target.value)}
                      placeholder="e.g. B2B SaaS, fintech, artificial intelligence"
                      className="h-10 text-sm"
                    />
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] text-text-dim">Suggestions:</span>
                      {POPULAR_TOPICS.map((topic) => (
                        <button
                          key={topic}
                          type="button"
                          onClick={() => addTopic(topic)}
                          className="text-[11px] font-medium px-2 py-0.5 rounded-md border border-border/60 hover:bg-muted text-text-dim hover:text-foreground"
                        >
                          + {topic}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">News Signal Category</Label>
                      <Select
                        value={form.newsCategory}
                        onValueChange={(v) => set("newsCategory", v as NewsSignalCategory | "ANY")}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {NEWS_SIGNALS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">Recency Lookback Window</Label>
                      <Select value={form.newsDaysBack} onValueChange={(v) => set("newsDaysBack", v)}>
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">Last 7 days (Freshest)</SelectItem>
                          <SelectItem value="14">Last 14 days</SelectItem>
                          <SelectItem value="30">Last 30 days (Recommended)</SelectItem>
                          <SelectItem value="60">Last 60 days</SelectItem>
                          <SelectItem value="90">Last 90 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Schedule & Cadence */}
          <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-border/60">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CalendarClock className="size-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">3. Schedule & Dispatch Cadence</h2>
                <p className="text-[11px] text-text-dim">Control execution timing and deliverability volume caps</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Run Frequency</Label>
                <Select
                  value={form.frequency}
                  onValueChange={(v) => set("frequency", v as IntentAutomationFrequency)}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAILY">Every day (7 days/week)</SelectItem>
                    <SelectItem value="WEEKDAYS">Weekdays only (Mon - Fri)</SelectItem>
                    <SelectItem value="WEEKLY">Once a week</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ia-time" className="text-xs font-bold flex items-center justify-between">
                  <span>Execution Time (IST)</span>
                  <span className="text-[10px] text-primary font-bold">Indian Standard Time</span>
                </Label>
                <div className="relative">
                  <Clock className="size-4 text-text-dim absolute left-3 top-3 pointer-events-none" />
                  <Input
                    id="ia-time"
                    type="time"
                    value={form.timeOfDay}
                    onChange={(e) => set("timeOfDay", e.target.value)}
                    className="pl-9 h-10"
                  />
                </div>
              </div>

              {form.frequency === "WEEKLY" && (
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-bold">Day of Week</Label>
                  <Select value={form.weekday} onValueChange={(v) => set("weekday", v)}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((d, i) => (
                        <SelectItem key={d} value={String(i)}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="ia-cap" className="text-xs font-bold flex items-center justify-between">
                  <span>Max emails per day</span>
                  <span className="text-[10px] text-text-dim">1 - 100</span>
                </Label>
                <Input
                  id="ia-cap"
                  type="number"
                  min={1}
                  max={100}
                  value={form.dailyCap}
                  onChange={(e) => set("dailyCap", e.target.value)}
                  className="h-10"
                />
                <p className="text-[11px] text-text-dim">Recommended: 20-30 to protect sender reputation</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ia-cooldown" className="text-xs font-bold flex items-center justify-between">
                  <span>Contact Cooldown (Days)</span>
                  <span className="text-[10px] text-text-dim">1 - 365</span>
                </Label>
                <Input
                  id="ia-cooldown"
                  type="number"
                  min={1}
                  max={365}
                  value={form.cooldownDays}
                  onChange={(e) => set("cooldownDays", e.target.value)}
                  className="h-10"
                />
                <p className="text-[11px] text-text-dim">Don't re-contact the same lead or company</p>
              </div>
            </div>
          </div>

          {/* Card 4: AI Copywriter & Value Proposition */}
          <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-border/60">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Wand2 className="size-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">4. AI Copywriter & Value Proposition</h2>
                <p className="text-[11px] text-text-dim">
                  The AI uses your offer to tailor cold emails to each prospect's specific situation
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ia-offer" className="text-xs font-bold flex items-center gap-1">
                    What we offer (Value Proposition) <span className="text-destructive">*</span>
                  </Label>
                  <span
                    className={`text-[11px] font-bold ${
                      form.offerDescription.trim().length >= 20 ? "text-emerald-600" : "text-amber-500"
                    }`}
                  >
                    {form.offerDescription.trim().length} chars (min 20)
                  </span>
                </div>

                <Textarea
                  id="ia-offer"
                  rows={4}
                  value={form.offerDescription}
                  onChange={(e) => set("offerDescription", e.target.value)}
                  placeholder="e.g. We supply pre-vetted full stack and DevOps engineers to growing product companies, on contract or permanent basis with 48h matching."
                  className="leading-relaxed text-sm"
                />

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-text-dim">Insert template:</span>
                  {OFFER_SNIPPETS.map((snip) => (
                    <button
                      key={snip.label}
                      type="button"
                      onClick={() => set("offerDescription", snip.text)}
                      className="text-[11px] font-medium px-2 py-0.5 rounded-md border border-border/60 hover:bg-muted text-text-dim hover:text-foreground"
                    >
                      {snip.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ia-tone" className="text-xs font-bold">
                  Tone of Voice
                </Label>
                <Input
                  id="ia-tone"
                  value={form.tone}
                  onChange={(e) => set("tone", e.target.value)}
                  placeholder="e.g. friendly and professional"
                  className="h-10 text-sm"
                />
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[11px] text-text-dim">Preset tones:</span>
                  {TONE_PRESETS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => set("tone", t)}
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-md border transition-colors ${
                        form.tone === t
                          ? "bg-primary/10 border-primary/30 text-primary font-bold"
                          : "border-border/60 hover:bg-muted text-text-dim hover:text-foreground"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sending Mode Toggle Card */}
              <div
                className={`rounded-2xl border p-4.5 transition-all flex items-start gap-4 ${
                  form.autoSend
                    ? "border-amber-500/40 bg-amber-500/[0.04]"
                    : "border-emerald-500/30 bg-emerald-500/[0.04]"
                }`}
              >
                <Switch
                  checked={form.autoSend}
                  onCheckedChange={(v) => set("autoSend", v)}
                  id="ia-auto"
                  aria-label="Send automatically"
                  className="mt-0.5 shrink-0"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="ia-auto" className="text-sm font-bold text-foreground cursor-pointer">
                      Send automatically without review
                    </Label>
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                        form.autoSend
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                      }`}
                    >
                      {form.autoSend ? "Autopilot Mode" : "Review Queue (Safe)"}
                    </span>
                  </div>
                  <p className="text-xs text-text-dim leading-relaxed">
                    {form.autoSend
                      ? "Emails are dispatched immediately through your connected mailbox as soon as leads are detected. Ensure your value proposition is thoroughly tested."
                      : "AI drafts each cold email and places it in Pending Approvals for you to inspect and approve with 1 click before sending."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Sticky Blueprint Inspector & Actions */}
        <div className="lg:col-span-4 space-y-5 lg:sticky lg:top-6 self-start">
          {/* Blueprint Card */}
          <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <span className="text-xs font-bold text-foreground flex items-center gap-2">
                <Sparkles className="size-4 text-primary" /> Automation Blueprint
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                Ready
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="text-[11px] text-text-dim uppercase font-bold tracking-wider mb-0.5">Title</div>
                <div className="font-bold text-sm text-foreground line-clamp-1">
                  {form.name || "Untitled Automation"}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="text-[11px] text-text-dim uppercase font-bold tracking-wider mb-0.5">Source</div>
                  <div className="font-semibold text-foreground flex items-center gap-1">
                    <Zap className="size-3 text-primary" /> {SOURCE_LABEL[form.source]}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-text-dim uppercase font-bold tracking-wider mb-0.5">Location</div>
                  <div className="font-semibold text-foreground flex items-center gap-1">
                    <Globe className="size-3 text-primary" /> {form.location || "Global"}
                  </div>
                </div>
              </div>

              <div className="pt-1">
                <div className="text-[11px] text-text-dim uppercase font-bold tracking-wider mb-0.5">Schedule</div>
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <CalendarClock className="size-3.5 text-primary" />
                  {scheduleLabel(form)}
                </div>
              </div>

              {needsRoles && currentRoles.length > 0 && (
                <div className="pt-1">
                  <div className="text-[11px] text-text-dim uppercase font-bold tracking-wider mb-1">
                    Target Roles ({currentRoles.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {currentRoles.slice(0, 3).map((r) => (
                      <span key={r} className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-muted text-text-dim">
                        {r}
                      </span>
                    ))}
                    {currentRoles.length > 3 && (
                      <span className="text-[10px] text-text-dim self-center">
                        +{currentRoles.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="text-[11px] text-text-dim uppercase font-bold tracking-wider mb-0.5">Daily Cap</div>
                  <div className="font-semibold text-foreground">{form.dailyCap} emails/day</div>
                </div>
                <div>
                  <div className="text-[11px] text-text-dim uppercase font-bold tracking-wider mb-0.5">Cooldown</div>
                  <div className="font-semibold text-foreground">{form.cooldownDays} days</div>
                </div>
              </div>

              <div className="pt-1">
                <div className="text-[11px] text-text-dim uppercase font-bold tracking-wider mb-0.5">Dispatch Mode</div>
                <div className="font-semibold">
                  {form.autoSend ? (
                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Send className="size-3" /> Autopilot (Immediate)
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="size-3.5" /> 1-Click Approval Queue
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Safety & Deliverability Card */}
          <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <ShieldCheck className="size-4 text-emerald-600" /> Deliverability & Safety Safeguards
            </div>
            <ul className="space-y-2 text-[11px] text-text-dim">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>Verified Apollo corporate business emails only</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>Automatic unsubscribe suppression list exclusion</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>{form.cooldownDays}-day deduplication across all campaigns</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>Throttled delivery to protect domain email reputation</span>
              </li>
            </ul>
          </div>

          {/* Primary Action Buttons */}
          <div className="space-y-2.5 pt-1">
            <Button
              size="lg"
              onClick={onSubmit}
              disabled={saving}
              className="w-full gap-2 font-bold shadow-sm h-11 text-sm"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              {editing === "new" ? "Create Automation" : "Save Changes"}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={onCancel}
              disabled={saving}
              className="w-full h-11 text-sm"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function IntentAutomationsPanel() {
  const {
    data: automations = [],
    isLoading,
    error: automationsError,
    refetch: refetchAutomations,
  } = useIntentAutomations();
  const { data: pending = [] } = useIntentOutreach({ status: "PENDING_APPROVAL" });
  const { data: recent = [] } = useIntentOutreach();
  const create = useCreateIntentAutomation();
  const update = useUpdateIntentAutomation();
  const remove = useDeleteIntentAutomation();
  const run = useRunIntentAutomation();
  const approve = useApproveOutreach();
  const reject = useRejectOutreach();
  const approveAll = useApproveAllOutreach();
  const saveDraft = useUpdateOutreachDraft();

  const [editing, setEditing] = useState<IntentAutomation | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [draftEdit, setDraftEdit] = useState<IntentOutreach | null>(null);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [runningId, setRunningId] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  function openNew() {
    setForm(EMPTY_FORM);
    setEditing("new");
  }
  function openEdit(a: IntentAutomation) {
    setForm(toForm(a));
    setEditing(a);
  }

  async function submit() {
    if (!form.name.trim()) {
      toast.error("Please enter a name for this automation.");
      return;
    }
    if (form.source !== "NEWS") {
      const roles = form.roles
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean);
      if (roles.length === 0) {
        toast.error("Please enter at least one job role to target.");
        return;
      }
    }
    if (form.source !== "HIRING" && !form.newsKeywords.trim()) {
      toast.error("Please enter news industry or topic keywords.");
      return;
    }
    if (!form.offerDescription.trim() || form.offerDescription.trim().length < 20) {
      toast.error("Please describe what you offer (at least 20 characters) so the AI can write relevant emails.");
      return;
    }

    const input = formToInput(form);
    try {
      if (editing === "new") {
        await create.mutateAsync(input);
        toast.success("Automation created.");
      } else if (editing) {
        await update.mutateAsync({ id: editing.id, input });
        toast.success("Automation updated.");
      }
      setEditing(null);
    } catch (err) {
      toast.error(errMsg(err, "Could not save the automation."));
    }
  }

  async function runNow(a: IntentAutomation) {
    setRunningId(a.id);
    try {
      const res = await run.mutateAsync(a.id);
      if (res.status === "FAILED") toast.error(res.error ?? "The run failed.");
      else
        toast.success(
          `${res.leadsFound} leads found - ${res.sent} sent, ${res.queued} waiting for approval, ${res.skipped} skipped.`,
        );
    } catch (err) {
      toast.error(errMsg(err, "Could not run the automation."));
    } finally {
      setRunningId(null);
    }
  }

  async function toggleActive(a: IntentAutomation, isActive: boolean) {
    try {
      await update.mutateAsync({ id: a.id, input: { isActive } });
    } catch (err) {
      toast.error(errMsg(err, "Could not change the automation."));
    }
  }

  async function del(a: IntentAutomation) {
    if (!window.confirm(`Delete "${a.name}" and its history?`)) return;
    try {
      await remove.mutateAsync(a.id);
      toast.success("Automation deleted.");
    } catch (err) {
      toast.error(errMsg(err, "Could not delete the automation."));
    }
  }

  async function approveOne(row: IntentOutreach) {
    try {
      const res = await approve.mutateAsync(row.id);
      if (res.status === "SENT") toast.success(`Sent to ${row.contactEmail}.`);
      else toast.error(res.error ?? "Sending failed.");
    } catch (err) {
      toast.error(errMsg(err, "Could not send."));
    }
  }

  async function approveBatch(automationId: string, count: number) {
    if (!window.confirm(`Send all ${count} waiting emails now?`)) return;
    try {
      const res = await approveAll.mutateAsync(automationId);
      toast.success(`${res.sent} sent${res.failed ? `, ${res.failed} failed` : ""}.`);
    } catch (err) {
      toast.error(errMsg(err, "Could not send."));
    }
  }

  async function rejectOne(row: IntentOutreach) {
    try {
      await reject.mutateAsync(row.id);
    } catch (err) {
      toast.error(errMsg(err, "Could not reject."));
    }
  }

  function openDraft(row: IntentOutreach) {
    setDraftEdit(row);
    setDraftSubject(row.subject);
    setDraftBody(row.body);
  }

  async function saveDraftEdit() {
    if (!draftEdit) return;
    try {
      await saveDraft.mutateAsync({ id: draftEdit.id, input: { subject: draftSubject, body: draftBody } });
      setDraftEdit(null);
      toast.success("Draft saved.");
    } catch (err) {
      toast.error(errMsg(err, "Could not save the draft."));
    }
  }

  const saving = create.isPending || update.isPending;
  const pendingByAutomation = pending.reduce<Record<string, IntentOutreach[]>>((acc, row) => {
    (acc[row.automationId] ??= []).push(row);
    return acc;
  }, {});

  // When editing or creating an automation, render the dedicated full-page panel instead of a popup dialog
  if (editing !== null) {
    return (
      <AutomationEditorPage
        editing={editing}
        form={form}
        set={set}
        setForm={setForm}
        saving={saving}
        onCancel={() => setEditing(null)}
        onSubmit={submit}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-3xl">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
            <Bot className="size-5 text-primary" /> Scheduled Automations
          </h2>
          <p className="text-xs sm:text-sm text-text-dim leading-relaxed">
            Run Intent Hiring and Intent News searches on a schedule. For each decision maker found, the AI writes a
            personal email and either sends it from your mailbox or holds it here for your approval. People who
            unsubscribed, or were contacted recently, are skipped automatically.
          </p>
        </div>
        <Button onClick={openNew} className="gap-2 font-bold shrink-0">
          <Plus className="size-4" /> New automation
        </Button>
      </div>

      {isLoading && <Loader2 className="size-5 animate-spin text-primary" />}

      {automationsError && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive flex items-center justify-between gap-3">
          <span>Failed to load automations: {(automationsError as Error)?.message || "Connection error"}</span>
          <Button variant="outline" size="sm" onClick={() => void refetchAutomations()} className="gap-1 text-xs">
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !automationsError && automations.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border/80 bg-card/50 p-10 text-center text-sm text-text-dim">
          No automations yet. Create one to search and draft emails on its own.
        </div>
      )}

      {automations.map((a) => {
        const isRunning = runningId === a.id;
        const isExpanded = expanded === a.id;
        const waiting = pendingByAutomation[a.id] ?? [];
        return (
          <div key={a.id} className="rounded-2xl border border-border/80 bg-card overflow-hidden">
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-base truncate">{a.name}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {SOURCE_LABEL[a.source]}
                  </span>
                  <span className="text-xs text-text-dim">· {scheduleLabel(a)}</span>
                  <span className="text-xs text-text-dim">· max {a.dailyCap}/day</span>
                  {a.autoSend ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                      Auto-send
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                      Needs approval
                    </span>
                  )}
                  {waiting.length > 0 && (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                      {waiting.length} waiting
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-dim">
                  Next run: {formatIst(a.nextRunAt)}
                  {a.lastRunAt && <> · Last run: {formatIst(a.lastRunAt)}</>}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={a.isActive}
                  onCheckedChange={(c) => toggleActive(a, c)}
                  aria-label={`${a.name} active`}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => runNow(a)}
                  disabled={isRunning || !a.isActive}
                  className="gap-1 text-xs"
                >
                  {isRunning ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                  Run now
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openEdit(a)} title="Edit automation">
                  <Pencil className="size-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => del(a)} title="Delete automation">
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setExpanded((cur) => (cur === a.id ? null : a.id))}
                  aria-expanded={isExpanded}
                  title={isExpanded ? "Collapse" : "Expand"}
                >
                  <ChevronDown className={`size-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </Button>
              </div>
            </div>

            {isExpanded && <AutomationDetails automation={a} />}
          </div>
        );
      })}

      {pending.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Mail className="size-4 text-primary" /> Waiting for your approval ({pending.length})
            </h3>
          </div>

          {Object.entries(pendingByAutomation).map(([automationId, rows]) => (
            <div key={automationId} className="rounded-2xl border border-border/80 bg-card overflow-hidden">
              <div className="p-3 bg-muted/40 border-b border-border/60 flex items-center justify-between text-xs">
                <span className="font-bold">{rows[0]?.automation?.name ?? "Automation"}</span>
                {rows.length > 1 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => approveBatch(automationId, rows.length)}
                  >
                    Approve all ({rows.length})
                  </Button>
                )}
              </div>
              <ul className="divide-y divide-border/40 text-xs">
                {rows.map((row) => (
                  <li key={row.id} className="p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-bold">{row.contactName}</span> ({row.contactTitle}) ·{" "}
                        <span className="font-semibold">{row.companyName}</span> ·{" "}
                        <span className="text-text-dim">{row.contactEmail}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openDraft(row)}>
                          Edit draft
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => rejectOne(row)}
                        >
                          Reject
                        </Button>
                        <Button size="sm" className="h-7 text-xs" onClick={() => approveOne(row)}>
                          Approve & send
                        </Button>
                      </div>
                    </div>
                    <div className="text-[11px] text-text-dim">
                      Trigger: {row.signalType === "HIRING" ? "Hiring" : "News"} — {row.signalTitle}
                    </div>
                    <div className="rounded-lg bg-muted/30 border border-border/40 p-3 text-xs space-y-1">
                      <div className="font-semibold">{row.subject}</div>
                      <div className="whitespace-pre-wrap text-text-dim">{row.body}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {recent.some((r) => r.status !== "PENDING_APPROVAL") && (
        <div className="rounded-2xl border border-border/80 bg-card overflow-hidden">
          <div className="p-4 border-b border-border/60">
            <h3 className="font-bold text-sm">Recent activity</h3>
          </div>
          <ul className="divide-y divide-border/40">
            {recent
              .filter((r) => r.status !== "PENDING_APPROVAL")
              .slice(0, 30)
              .map((r) => (
                <li key={r.id} className="px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="font-semibold">{r.contactName}</span> · {r.companyName} · {r.contactEmail}
                    <span className="text-text-dim"> — {r.subject}</span>
                    {r.error && <span className="text-destructive"> ({r.error})</span>}
                  </span>
                  <span className="flex items-center gap-2 text-text-dim shrink-0">
                    {r.automation.name}
                    <span
                      className={`font-extrabold uppercase text-[10px] px-2 py-0.5 rounded-full border ${
                        r.status === "SENT"
                          ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                          : r.status === "FAILED"
                            ? "bg-destructive/10 text-destructive border-destructive/30"
                            : "bg-muted text-text-dim border-border"
                      }`}
                    >
                      {r.status.toLowerCase()}
                    </span>
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* Draft review dialog (only for pending outreach approval) */}
      <Dialog open={draftEdit !== null} onOpenChange={(o) => !o && setDraftEdit(null)}>
        <DialogContent className="max-w-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit email to {draftEdit?.contactName}</DialogTitle>
            <DialogDescription className="text-xs">{draftEdit?.contactEmail}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="draft-subject" className="text-xs font-bold">Subject</Label>
              <Input id="draft-subject" value={draftSubject} onChange={(e) => setDraftSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="draft-body" className="text-xs font-bold">Body</Label>
              <Textarea id="draft-body" rows={10} value={draftBody} onChange={(e) => setDraftBody(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDraftEdit(null)}>Cancel</Button>
            <Button onClick={saveDraftEdit} disabled={saveDraft.isPending}>Save draft</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const SKIP_REASON_LABEL: Record<string, string> = {
  NO_EMAIL: "No email found",
  DUPLICATE_IN_RUN: "Duplicate in this run",
  SUPPRESSED: "Unsubscribed",
  RECENTLY_CONTACTED: "Contacted recently",
  DAILY_CAP_REACHED: "Daily limit reached",
  DRAFT_FAILED: "AI draft failed",
  SEND_FAILED: "Send failed",
  AI_NOT_CONFIGURED: "AI not configured",
};

function csvCell(value: string | null | undefined) {
  return `"${(value ?? "").replace(/"/g, '""')}"`;
}

function AutomationLeads({
  automation,
  runId,
  onClearRun,
}: {
  automation: IntentAutomation;
  runId: string | null;
  onClearRun: () => void;
}) {
  const [outcome, setOutcome] = useState<IntentLeadOutcome | "ALL">("ALL");
  const { data: leads = [], isLoading } = useIntentAutomationLeads(automation.id, {
    runId: runId ?? undefined,
    outcome: outcome === "ALL" ? undefined : outcome,
  });

  function exportCsv() {
    const headers = [
      "Company",
      "Domain",
      "Location",
      "Signal",
      "Headline / job",
      "Link",
      "Date",
      "Contact",
      "Title",
      "Email",
      "LinkedIn",
      "Outcome",
      "Reason",
      "Found at",
    ];
    const rows = leads.map((l) =>
      [
        l.companyName,
        l.companyDomain,
        l.companyLocation,
        l.signalType,
        l.signalTitle,
        l.signalUrl,
        l.signalDate,
        l.contactName,
        l.contactTitle,
        l.contactEmail,
        l.contactLinkedin,
        l.outcome,
        l.skipReason ? (SKIP_REASON_LABEL[l.skipReason] ?? l.skipReason) : "",
        l.createdAt,
      ].map(csvCell),
    );
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `intent_leads_${automation.name.toLowerCase().replace(/\s+/g, "_")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
        <div className="font-bold">
          Saved leads{" "}
          {runId && (
            <button
              type="button"
              onClick={onClearRun}
              className="ml-2 font-normal text-primary hover:underline"
            >
              (one run - show all)
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={outcome} onValueChange={(v) => setOutcome(v as IntentLeadOutcome | "ALL")}>
            <SelectTrigger className="h-7 w-[130px] text-[11px]" aria-label="Filter leads">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All leads</SelectItem>
              <SelectItem value="SENT">Sent</SelectItem>
              <SelectItem value="QUEUED">Waiting approval</SelectItem>
              <SelectItem value="SKIPPED">Skipped</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-[11px]"
            onClick={exportCsv}
            disabled={leads.length === 0}
          >
            <Download className="size-3" /> Export CSV
          </Button>
        </div>
      </div>
      {isLoading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : leads.length === 0 ? (
        <p className="text-text-dim">No leads saved yet - they appear after the first run.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/60 bg-card">
          <table className="w-full text-[11px]">
            <thead className="bg-muted/40 text-left text-text-dim">
              <tr>
                <th className="px-2 py-1.5">Company</th>
                <th className="px-2 py-1.5">Signal</th>
                <th className="px-2 py-1.5">Decision maker</th>
                <th className="px-2 py-1.5">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {leads.map((l) => (
                <tr key={l.id} className="align-top">
                  <td className="px-2 py-1.5">
                    <div className="font-semibold text-foreground">{l.companyName}</div>
                    <div className="text-text-dim">{l.companyDomain ?? l.companyLocation ?? ""}</div>
                  </td>
                  <td className="px-2 py-1.5 max-w-[320px]">
                    <span className="font-bold text-text-dim">
                      {l.signalType === "HIRING" ? "Hiring" : "News"}
                    </span>
                    {" · "}
                    {l.signalUrl ? (
                      <a
                        href={l.signalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-primary hover:underline"
                      >
                        {l.signalTitle}
                      </a>
                    ) : (
                      l.signalTitle
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {l.contactName ? (
                      <>
                        <div className="font-semibold text-foreground">{l.contactName}</div>
                        <div className="text-text-dim">{l.contactTitle}</div>
                        <div className="font-mono text-text-dim">{l.contactEmail ?? "no email"}</div>
                      </>
                    ) : (
                      <span className="text-text-muted">none found</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <span className="font-extrabold uppercase text-[10px]">{l.outcome.toLowerCase()}</span>
                    {l.skipReason && (
                      <div className="text-text-dim">{SKIP_REASON_LABEL[l.skipReason] ?? l.skipReason}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AutomationDetails({ automation }: { automation: IntentAutomation }) {
  const { data: runs = [], isLoading } = useIntentAutomationRuns(automation.id);
  const [runId, setRunId] = useState<string | null>(null);
  return (
    <div className="border-t border-border/60 bg-muted/20 p-4 space-y-3 text-xs">
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-text-dim">
        {automation.roles.length > 0 && (
          <div>
            <strong className="text-foreground">Roles:</strong> {automation.roles.join(", ")}
          </div>
        )}
        {automation.newsKeywords && (
          <div>
            <strong className="text-foreground">News:</strong> {automation.newsKeywords}
            {automation.newsCategory ? ` · ${automation.newsCategory.toLowerCase()}` : ""} · last{" "}
            {automation.newsDaysBack} days
          </div>
        )}
        {automation.location && (
          <div>
            <strong className="text-foreground">Location:</strong> {automation.location}
          </div>
        )}
        <div>
          <strong className="text-foreground">No repeat contact for:</strong> {automation.cooldownDays} days
        </div>
        <div className="sm:col-span-2">
          <strong className="text-foreground">Offer:</strong> {automation.offerDescription}
        </div>
      </div>
      <div>
        <div className="font-bold mb-1">Run history</div>
        {isLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : runs.length === 0 ? (
          <p className="text-text-dim">No runs yet.</p>
        ) : (
          <ul className="space-y-1">
            {runs.map((r) => (
              <li key={r.id} className="flex flex-wrap gap-x-3 text-text-dim">
                <button
                  type="button"
                  onClick={() => setRunId(r.id)}
                  title="Show only this run's leads"
                  className="text-foreground font-semibold hover:text-primary hover:underline"
                >
                  {formatIst(r.startedAt)}
                </button>
                <span>{r.trigger === "MANUAL" ? "manual" : "scheduled"}</span>
                <span className={r.status === "FAILED" ? "text-destructive font-semibold" : ""}>
                  {r.status.toLowerCase()}
                </span>
                <span>
                  {r.leadsFound} found · {r.sent} sent · {r.queued} queued · {r.skipped} skipped · {r.failed} failed
                </span>
                {r.error && <span className="text-destructive">{r.error}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <AutomationLeads automation={automation} runId={runId} onClearRun={() => setRunId(null)} />
    </div>
  );
}
