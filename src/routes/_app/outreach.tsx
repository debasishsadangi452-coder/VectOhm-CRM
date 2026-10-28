import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Rocket,
  Search,
  Loader2,
  Building2,
  UserPlus,
  Users,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Mail,
  Plus,
  Pencil,
  ListChecks,
  Activity,
  PlayCircle,
  Radar,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  Download,
  Flame,
  MapPin,
  Globe,
  Building,
  UserCheck,
  Send,
  Share2,
  Briefcase,
  Crown,
  UserCheck2,
  SendHorizonal,
  Trash2,
  Filter,
  ShieldCheck,
  Layers,
  ArrowRight,
  TrendingUp,
  Newspaper,
  Phone,
  PhoneCall,
} from "lucide-react";

import { toast } from "sonner";
import { useDepartmentGuard } from "@/hooks/use-department-guard";
import { useApolloConnection } from "@/hooks/use-apollo";
import {
  useSearchApolloPeople,
  useSearchApolloOrganizations,
  useImportApolloPeople,
  useImportApolloOrganizations,
} from "@/hooks/use-apollo";
import { useEmailTemplates } from "@/hooks/use-email-templates";
import { EmailTemplateFormDialog } from "@/components/email-template-form-dialog";
import { BusinessTemplatesLibraryDialog } from "@/components/business-templates-library-dialog";
import { SequenceFormDialog } from "@/components/sequence-form-dialog";
import { SequenceEnrollDialog } from "@/components/sequence-enroll-dialog";
import { HiringSignalAutomationFormDialog } from "@/components/hiring-signal-automation-form-dialog";
import { useSequences, useSequenceActivity, useRunSequenceEngine } from "@/hooks/use-sequences";
import {
  useHiringSignalAutomations,
  useRunHiringSignalAutomation,
  useEnrichIntentCompanies,
  useEnrichedContacts,
  useEnrollEnrichedContacts,
  useDeleteEnrichedContact,
} from "@/hooks/use-hiring-signals";
import {
  useGrowthSignals,
  useAcceptGrowthSignal,
  useDismissGrowthSignal,
  useNewsLog,
  useScanNewsNow,
  useScanApolloNow,
} from "@/hooks/use-company-growth";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEngagementEvents, useSequenceMetrics } from "@/hooks/use-engagement";
import type { ApolloOrganizationPreview, ApolloPersonPreview } from "@/lib/api/apollo";
import type { EmailTemplate, Sequence } from "@/lib/api/types";
import type { HiringSignalAutomation, IntentEnrichedContact } from "@/lib/api/hiring-signals";
import type { CompanyGrowthSignal, CompanyGrowthSignalType } from "@/lib/api/company-growth";

export const Route = createFileRoute("/_app/outreach")({
  component: OutreachPage,
});

function commaList(value: string): string[] | undefined {
  const items = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function ensureExternalUrl(url?: string | null): string {
  if (!url) return "#";
  const trimmed = url.trim();
  if (!trimmed) return "#";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function ApolloConnectionNotice() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/5 px-4 py-4 text-sm">
      <AlertCircle className="size-5 text-warning shrink-0" />
      <div>
        <p className="font-semibold">Apollo isn't connected yet.</p>
        <p className="text-text-dim mt-0.5">
          Ask an Admin to connect it under Settings → Apollo.io Connection.
        </p>
      </div>
    </div>
  );
}
function OutreachPage() {
  useDepartmentGuard("Sales");
  const { data: connection, isLoading: connectionLoading } = useApolloConnection();
  const { data: savedContacts = [] } = useEnrichedContacts();
  const { data: sequences = [] } = useSequences();
  const apolloConnected = !!connection?.connected;
  const [activeTab, setActiveTab] = useState("decision-makers");

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* ─── Top Hero Header ─── */}
      <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-r from-card via-card/90 to-primary/[0.04] p-6 sm:p-7 shadow-xs backdrop-blur-xl">
        <div className="absolute -right-20 -top-20 size-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 size-72 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="relative flex size-12 sm:size-13 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-indigo-500/20 border border-primary/30 text-primary shadow-sm shadow-primary/10 shrink-0">
              <Rocket className="size-6 text-primary animate-pulse" strokeWidth={2} />
              <div className="absolute -top-1 -right-1 size-3 rounded-full bg-emerald-500 ring-4 ring-card" />
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                  Sales Outreach & Intelligence
                </h1>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/25">
                  <Sparkles className="size-3 text-amber-500" /> Executive CRM Sync
                </span>
              </div>
              <p className="text-xs sm:text-sm text-text-dim max-w-2xl leading-relaxed">
                Apollo executive decision-maker enrichment, sequence drip campaigns, growth signals & autonomous outreach.
              </p>
            </div>
          </div>

          {/* Header Quick Status Chips */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-border/50">
            <div className="inline-flex items-center gap-2 rounded-xl bg-canvas/80 border border-border/70 px-3.5 py-2 text-xs font-semibold shadow-2xs">
              <div className={`size-2 rounded-full ${apolloConnected ? "bg-emerald-500 animate-ping" : "bg-amber-500"}`} />
              <span className="text-text-dim">Apollo:</span>
              <span className={apolloConnected ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-amber-500 font-bold"}>
                {connectionLoading ? "Checking…" : apolloConnected ? "Connected" : "Disconnected"}
              </span>
            </div>

            <div className="inline-flex items-center gap-2 rounded-xl bg-canvas/80 border border-border/70 px-3.5 py-2 text-xs font-semibold shadow-2xs">
              <Users className="size-3.5 text-indigo-500" />
              <span className="text-text-dim">Saved Decision Makers:</span>
              <span className="text-foreground font-extrabold">{savedContacts.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Navigation Tabs Bar (Scrollable & Wrapped Responsively) ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="p-1.5 rounded-2xl bg-card/80 border border-border/80 shadow-xs backdrop-blur-md">
          <TabsList className="flex items-center gap-1.5 overflow-x-auto scrollbar-none w-full justify-start h-auto bg-transparent p-0">
            <TabsTrigger
              value="decision-makers"
              className="group px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 shrink-0 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=active]:shadow-indigo-500/30"
            >
              <Users className="size-3.5 text-indigo-500 group-data-[state=active]:text-indigo-200 shrink-0" />
              <span>Decision Makers</span>
              {savedContacts.length > 0 && (
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-800 dark:text-indigo-200 border border-indigo-500/30 group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white group-data-[state=active]:border-white/40">
                  {savedContacts.length}
                </span>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="growth-signals"
              className="group px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 shrink-0 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=active]:shadow-emerald-500/30"
            >
              <TrendingUp className="size-3.5 text-emerald-500 group-data-[state=active]:text-emerald-200 shrink-0" />
              <span>Growth Signals</span>
              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border border-emerald-500/30 group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white group-data-[state=active]:border-white/40">
                NEWS & METRICS
              </span>
            </TabsTrigger>

            <TabsTrigger
              value="hiring-signals"
              className="group px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Radar className="size-3.5 shrink-0" />
              <span>Hiring Signals</span>
            </TabsTrigger>

            <TabsTrigger
              value="templates"
              className="group px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Mail className="size-3.5 shrink-0" />
              <span>Templates</span>
            </TabsTrigger>

            <TabsTrigger
              value="sequences"
              className="group px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <ListChecks className="size-3.5 shrink-0" />
              <span>Sequences</span>
              {sequences.length > 0 && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white group-data-[state=active]:border-white/40">
                  {sequences.length}
                </span>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="activity"
              className="group px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Activity className="size-3.5 shrink-0" />
              <span>Activity</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="decision-makers" className="mt-0 focus-visible:outline-none">
          <DecisionMakersTab />
        </TabsContent>

        <TabsContent value="people" className="mt-0 focus-visible:outline-none">
          {connectionLoading ? (
            <div className="flex items-center gap-2 text-sm text-text-dim py-8">
              <Loader2 className="size-4 animate-spin" /> Checking Apollo connection…
            </div>
          ) : apolloConnected ? (
            <FindPeopleTab />
          ) : (
            <ApolloConnectionNotice />
          )}
        </TabsContent>
        <TabsContent value="companies" className="mt-0 focus-visible:outline-none">
          {connectionLoading ? (
            <div className="flex items-center gap-2 text-sm text-text-dim py-8">
              <Loader2 className="size-4 animate-spin" /> Checking Apollo connection…
            </div>
          ) : apolloConnected ? (
            <FindCompaniesTab />
          ) : (
            <ApolloConnectionNotice />
          )}
        </TabsContent>
        <TabsContent value="templates" className="mt-0 focus-visible:outline-none">
          <TemplatesTab />
        </TabsContent>
        <TabsContent value="sequences" className="mt-0 focus-visible:outline-none">
          <SequencesTab />
        </TabsContent>
        <TabsContent value="hiring-signals" className="mt-0 focus-visible:outline-none">
          <HiringSignalsTab />
        </TabsContent>
        <TabsContent value="growth-signals" className="mt-0 focus-visible:outline-none">
          <GrowthSignalsTab />
        </TabsContent>
        <TabsContent value="activity" className="mt-0 focus-visible:outline-none">
          <ActivityTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Dedicated Decision Makers Panel (Founders & HR) ─────────────────────────

function DecisionMakersTab() {
  const { data: contacts = [], isLoading } = useEnrichedContacts();
  const { data: sequences = [] } = useSequences();
  const enrollMutation = useEnrollEnrichedContacts();
  const deleteMutation = useDeleteEnrichedContact();
  const enrichMutation = useEnrichIntentCompanies();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState<"ALL" | "FOUNDER_EXEC" | "HR_TALENT" | "WITH_EMAIL" | "ENROLLED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Enroll dialog state
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [targetSequenceId, setTargetSequenceId] = useState<string>("");
  const [enrollTargetIds, setEnrollTargetIds] = useState<string[]>([]);

  // Statistics
  const foundersCount = useMemo(() => contacts.filter((c) => c.departmentCategory === "FOUNDER_EXEC").length, [contacts]);
  const hrCount = useMemo(() => contacts.filter((c) => c.departmentCategory === "HR_TALENT").length, [contacts]);
  const withEmailCount = useMemo(() => contacts.filter((c) => Boolean(c.email)).length, [contacts]);
  const enrolledCount = useMemo(() => contacts.filter((c) => c.sequenceEnrolled).length, [contacts]);

  // Filtered contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      // Category filter
      if (filterCategory === "FOUNDER_EXEC" && c.departmentCategory !== "FOUNDER_EXEC") return false;
      if (filterCategory === "HR_TALENT" && c.departmentCategory !== "HR_TALENT") return false;
      if (filterCategory === "WITH_EMAIL" && !c.email) return false;
      if (filterCategory === "ENROLLED" && !c.sequenceEnrolled) return false;

      // Text query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = c.personName.toLowerCase().includes(q);
        const matchTitle = c.title.toLowerCase().includes(q);
        const matchComp = c.companyName.toLowerCase().includes(q);
        const matchEmail = (c.email || "").toLowerCase().includes(q);
        if (!matchName && !matchTitle && !matchComp && !matchEmail) return false;
      }

      return true;
    });
  }, [contacts, filterCategory, searchQuery]);

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(filteredContacts.map((c) => c.id));
    } else {
      setSelectedIds([]);
    }
  }

  function handleToggleOne(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleBatchEnroll() {
    if (!targetSequenceId) {
      toast.error("Please select a target sequence.");
      return;
    }
    const ids = enrollTargetIds.length > 0 ? enrollTargetIds : selectedIds;
    if (ids.length === 0) {
      toast.error("No contacts selected for enrollment.");
      return;
    }

    try {
      const res = await enrollMutation.mutateAsync({
        leadIds: ids,
        sequenceId: targetSequenceId,
      });

      setShowEnrollDialog(false);
      setSelectedIds([]);
      setEnrollTargetIds([]);
      toast.success(`Enrolled ${res.successCount} contacts into sequence.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enrollment failed.");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id);
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      toast.success("Decision maker removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete.");
    }
  }

  function handleExportCsv() {
    if (filteredContacts.length === 0) return;

    const headers = [
      "Name",
      "Title",
      "Category",
      "Company Name",
      "Domain",
      "Email",
      "Official Mobile / Phone",
      "LinkedIn URL",
      "Source Job Role",
      "Sequence Enrolled",
      "Sequence Name",
      "Enrolled At",
    ];

    const rows = filteredContacts.map((c) => [
      `"${(c.personName || "").replace(/"/g, '""')}"`,
      `"${(c.title || "").replace(/"/g, '""')}"`,
      `"${c.departmentCategory}"`,
      `"${(c.companyName || "").replace(/"/g, '""')}"`,
      `"${(c.companyDomain || "").replace(/"/g, '""')}"`,
      `"${(c.email || "").replace(/"/g, '""')}"`,
      `"${(c.phone || "").replace(/"/g, '""')}"`,
      `"${(c.linkedinUrl || "").replace(/"/g, '""')}"`,
      `"${(c.sourceJobTitle || "").replace(/"/g, '""')}"`,
      `"${c.sequenceEnrolled ? "Yes" : "No"}"`,
      `"${(c.sequenceName || "").replace(/"/g, '""')}"`,
      `"${(c.enrolledAt || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `apollo_decision_makers_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Decision makers CSV exported!");
  }

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="rounded-2xl border border-indigo-500/25 bg-gradient-to-r from-indigo-500/10 via-background to-purple-500/10 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                <Crown className="size-3" /> Apollo Verified Decision Makers
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <ShieldCheck className="size-3" /> Verified Corporate Emails
              </span>
            </div>
            <h2 className="text-lg font-bold tracking-tight">Executive Leadership & HR Decision Makers</h2>
            <p className="text-xs text-text-dim leading-relaxed">
              Founders, CEOs, Directors, and HR Heads resolved from companies actively hiring in the market. Ready for direct cold outreach or automated email sequences.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => {
                enrichMutation.mutateAsync({}).then((res) => {
                  if (res.enrichedCount > 0) toast.success(`Enriched ${res.enrichedCount} decision makers!`);
                  else toast.info("No new companies to enrich from latest search.");
                });
              }}
              disabled={enrichMutation.isPending}
              className="gap-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
            >
              {enrichMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Enriching…
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5 text-amber-300" />
                  Auto-Enrich Latest Search
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Stats Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5 pt-4 border-t border-border-subtle/50">
          <div className="bg-card/70 border border-border-subtle rounded-xl p-3">
            <p className="text-[11px] font-semibold text-text-muted flex items-center gap-1">
              <Users className="size-3 text-primary" /> Total Decision Makers
            </p>
            <p className="text-xl font-extrabold text-foreground mt-1">{contacts.length}</p>
          </div>

          <div className="bg-card/70 border border-border-subtle rounded-xl p-3">
            <p className="text-[11px] font-semibold text-text-muted flex items-center gap-1">
              <Crown className="size-3 text-purple-500" /> Founders & C-Level
            </p>
            <p className="text-xl font-extrabold text-purple-600 dark:text-purple-400 mt-1">{foundersCount}</p>
          </div>

          <div className="bg-card/70 border border-border-subtle rounded-xl p-3">
            <p className="text-[11px] font-semibold text-text-muted flex items-center gap-1">
              <UserCheck2 className="size-3 text-sky-500" /> HR & Talent Leads
            </p>
            <p className="text-xl font-extrabold text-sky-600 dark:text-sky-400 mt-1">{hrCount}</p>
          </div>

          <div className="bg-card/70 border border-border-subtle rounded-xl p-3">
            <p className="text-[11px] font-semibold text-text-muted flex items-center gap-1">
              <Mail className="size-3 text-emerald-500" /> Verified Emails
            </p>
            <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{withEmailCount}</p>
          </div>

          <div className="bg-card/70 border border-border-subtle rounded-xl p-3 col-span-2 sm:col-span-1">
            <p className="text-[11px] font-semibold text-text-muted flex items-center gap-1">
              <SendHorizonal className="size-3 text-indigo-500" /> Enrolled in Sequences
            </p>
            <p className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">{enrolledCount}</p>
          </div>
        </div>
      </div>

      {/* Filter & Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border-subtle rounded-xl p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input
              placeholder="Search name, title, company, email…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-xs bg-canvas/50"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setFilterCategory("ALL")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
                filterCategory === "ALL"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-canvas text-text-dim hover:text-foreground border-border-subtle"
              }`}
            >
              All ({contacts.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterCategory("FOUNDER_EXEC")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
                filterCategory === "FOUNDER_EXEC"
                  ? "bg-purple-600 text-white border-purple-600"
                  : "bg-canvas text-text-dim hover:text-foreground border-border-subtle"
              }`}
            >
              👑 Founders ({foundersCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterCategory("HR_TALENT")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
                filterCategory === "HR_TALENT"
                  ? "bg-sky-600 text-white border-sky-600"
                  : "bg-canvas text-text-dim hover:text-foreground border-border-subtle"
              }`}
            >
              👥 HR / Talent ({hrCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterCategory("WITH_EMAIL")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
                filterCategory === "WITH_EMAIL"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-canvas text-text-dim hover:text-foreground border-border-subtle"
              }`}
            >
              ✉️ With Email ({withEmailCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterCategory("ENROLLED")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
                filterCategory === "ENROLLED"
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-canvas text-text-dim hover:text-foreground border-border-subtle"
              }`}
            >
              🚀 In Sequence ({enrolledCount})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Button
              size="sm"
              onClick={() => {
                setEnrollTargetIds(selectedIds);
                setShowEnrollDialog(true);
              }}
              className="gap-1.5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
            >
              <SendHorizonal className="size-3.5" />
              Enroll Selected ({selectedIds.length})
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={filteredContacts.length === 0}
            className="gap-1.5 text-xs font-semibold"
          >
            <Download className="size-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Decision Makers Table */}
      {isLoading ? (
        <div className="text-center py-16 bg-card border border-border-subtle rounded-2xl space-y-3">
          <Loader2 className="size-8 animate-spin mx-auto text-primary" />
          <p className="text-xs text-text-dim font-medium">Loading verified decision makers…</p>
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="text-center py-16 bg-card/40 border border-border-subtle rounded-2xl space-y-3">
          <Users className="size-10 mx-auto text-text-muted/50" />
          <h4 className="text-sm font-bold text-foreground">No decision makers found in this view</h4>
          <p className="text-xs text-text-dim max-w-md mx-auto">
            {contacts.length === 0
              ? "No decision makers saved yet. Use Apollo People/Company search or Auto-Enrich to resolve executive contacts."
              : "Try switching your category filters or adjusting the search query."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border-subtle bg-card overflow-hidden shadow-xs">
          <Table>
            <TableHeader>
              <TableRow className="bg-canvas/50">
                <TableHead className="w-10 text-center">
                  <Checkbox
                    checked={selectedIds.length > 0 && selectedIds.length === filteredContacts.length}
                    onCheckedChange={(c) => handleSelectAll(Boolean(c))}
                  />
                </TableHead>
                <TableHead className="w-[30%]">Executive / Decision Maker</TableHead>
                <TableHead className="w-[25%]">Hiring Company & Signal</TableHead>
                <TableHead className="w-[20%]">Verified Email & Profile</TableHead>
                <TableHead className="w-[15%]">Email Automation Status</TableHead>
                <TableHead className="w-[10%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.map((lead) => (
                <TableRow
                  key={lead.id}
                  className={`hover:bg-primary/5 transition-colors ${
                    selectedIds.includes(lead.id) ? "bg-primary/5" : ""
                  }`}
                >
                  {/* Select Checkbox */}
                  <TableCell className="text-center align-middle py-3.5">
                    <Checkbox
                      checked={selectedIds.includes(lead.id)}
                      onCheckedChange={() => handleToggleOne(lead.id)}
                    />
                  </TableCell>

                  {/* Decision Maker Name & Category */}
                  <TableCell className="align-top py-3.5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div
                          className={`size-7 rounded-full text-xs font-bold grid place-items-center shrink-0 ${
                            lead.departmentCategory === "FOUNDER_EXEC"
                              ? "bg-purple-500/20 text-purple-600 dark:text-purple-400"
                              : "bg-sky-500/20 text-sky-600 dark:text-sky-400"
                          }`}
                        >
                          {lead.personName
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            {lead.personName}
                            {lead.departmentCategory === "FOUNDER_EXEC" && (
                              <span title="Founder / Executive">
                                <Crown className="size-3 text-purple-500" />
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-text-muted font-medium line-clamp-1">{lead.title}</p>
                        </div>
                      </div>

                      <div className="pt-0.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                            lead.departmentCategory === "FOUNDER_EXEC"
                              ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                              : "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
                          }`}
                        >
                          {lead.departmentCategory === "FOUNDER_EXEC" ? "👑 Founder / C-Level" : "👥 HR / Talent Lead"}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  {/* Company & Source Job */}
                  <TableCell className="align-top py-3.5">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-foreground">{lead.companyName}</p>
                      {lead.companyDomain && (
                        <p className="text-[11px] text-text-dim flex items-center gap-1">
                          <Globe className="size-3 text-text-muted" />
                          <span className="truncate max-w-[170px]">{lead.companyDomain}</span>
                        </p>
                      )}
                      {lead.sourceJobTitle && (
                        <div className="pt-0.5">
                          <a
                            href={lead.sourceJobUrl || undefined}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] font-medium text-primary hover:underline inline-flex items-center gap-1 max-w-[180px] truncate"
                          >
                            <Flame className="size-2.5 text-amber-500 shrink-0" />
                            {lead.sourceJobTitle}
                          </a>
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* Verified Email, Phone & LinkedIn */}
                  <TableCell className="align-top py-3.5">
                    <div className="space-y-1.5">
                      {lead.email && (
                        <div className="inline-flex items-center gap-1.5 bg-canvas border border-border-subtle px-2 py-0.5 rounded-md">
                          <Mail className="size-3 text-emerald-500 shrink-0" />
                          <span className="text-xs font-mono font-medium text-foreground truncate max-w-[160px]">
                            {lead.email}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(lead.email!, lead.id)}
                            title="Copy Email"
                            className="text-text-muted hover:text-foreground transition-colors p-0.5"
                          >
                            {copiedId === lead.id ? (
                              <Check className="size-3 text-emerald-500" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </button>
                        </div>
                      )}

                      {lead.phone && (
                        <div className="inline-flex items-center gap-1.5 bg-blue-500/5 border border-blue-500/20 px-2 py-0.5 rounded-md">
                          <Phone className="size-3 text-blue-500 shrink-0" />
                          <span className="text-xs font-mono font-medium text-blue-700 dark:text-blue-300 truncate max-w-[150px]">
                            {lead.phone}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(lead.phone!, `${lead.id}-phone`)}
                            title="Copy Phone"
                            className="text-text-muted hover:text-foreground transition-colors p-0.5"
                          >
                            {copiedId === `${lead.id}-phone` ? (
                              <Check className="size-3 text-emerald-500" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </button>
                          <a
                            href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}
                            className="text-text-muted hover:text-primary transition-colors p-0.5"
                            title="Call official number"
                          >
                            <PhoneCall className="size-2.5 shrink-0" />
                          </a>
                        </div>
                      )}

                      {lead.linkedinUrl && (
                        <div>
                          <a
                            href={ensureExternalUrl(lead.linkedinUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-blue-500 hover:underline inline-flex items-center gap-0.5"
                          >
                            LinkedIn Profile <ExternalLink className="size-2.5" />
                          </a>
                        </div>
                      )}

                      {!lead.email && !lead.phone && (
                        <div className="text-text-muted text-[11px] italic py-1">Contact not exposed on Apollo</div>
                      )}
                    </div>
                  </TableCell>

                  {/* Email Automation Status */}
                  <TableCell className="align-top py-3.5">
                    {lead.sequenceEnrolled ? (
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="size-3 text-emerald-500" /> In Sequence
                        </span>
                        {lead.sequenceName && (
                          <p className="text-[10px] text-text-dim font-medium truncate max-w-[140px]">
                            {lead.sequenceName}
                          </p>
                        )}
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!lead.email}
                        onClick={() => {
                          setEnrollTargetIds([lead.id]);
                          setShowEnrollDialog(true);
                        }}
                        className="h-7 text-[11px] font-semibold gap-1"
                      >
                        <SendHorizonal className="size-2.5" /> Enroll
                      </Button>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="align-top py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {lead.email && (
                        <a
                          href={`mailto:${lead.email}?subject=${encodeURIComponent(
                            lead.sourceJobTitle ? `Re: ${lead.sourceJobTitle} at ${lead.companyName}` : `Partnership inquiry with ${lead.companyName}`
                          )}`}
                          title="Direct Mail"
                          className="p-1.5 rounded-lg text-text-muted hover:text-foreground hover:bg-canvas transition-colors"
                        >
                          <Send className="size-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(lead.id)}
                        title="Delete Lead"
                        className="p-1.5 rounded-lg text-text-muted hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Sequence Enrollment Modal */}
      <Dialog open={showEnrollDialog} onOpenChange={setShowEnrollDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <SendHorizonal className="size-5 text-primary" />
              Enroll Decision Makers into Email Sequence
            </DialogTitle>
            <DialogDescription className="text-xs text-text-dim">
              Choose an active Email Sequence to queue the selected verified contacts ({enrollTargetIds.length > 0 ? enrollTargetIds.length : selectedIds.length} leads).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Select Sequence *</Label>
              <select
                value={targetSequenceId}
                onChange={(e) => setTargetSequenceId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-card text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-none"
              >
                <option value="">-- Choose a Sequence --</option>
                {sequences.map((seq) => (
                  <option key={seq.id} value={seq.id}>
                    🚀 {seq.name} ({seq.steps?.length || 0} steps)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
            <Button variant="outline" size="sm" onClick={() => setShowEnrollDialog(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleBatchEnroll}
              disabled={enrollMutation.isPending || !targetSequenceId}
              className="gap-2 font-bold bg-primary hover:bg-primary/90"
            >
              {enrollMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Enrolling…
                </>
              ) : (
                <>
                  <SendHorizonal className="size-3.5" /> Start Sequence Enrollment
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Find People ────────────────────────────────────────────────────────────

function FindPeopleTab() {

  const searchPeople = useSearchApolloPeople();
  const importPeople = useImportApolloPeople();

  const [titles, setTitles] = useState("");
  const [keywords, setKeywords] = useState("");
  const [locations, setLocations] = useState("");
  const [results, setResults] = useState<ApolloPersonPreview[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]),
    [selected],
  );

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    setSelected({});
    const found = await searchPeople.mutateAsync({
      personTitles: commaList(titles),
      keywords: keywords.trim() || undefined,
      locations: commaList(locations),
      perPage: 25,
    });
    setResults(found);
  }

  async function handleImport() {
    setNotice(null);
    const imported = await importPeople.mutateAsync(selectedIds);
    setNotice(`Imported ${imported.length} contact${imported.length !== 1 ? "s" : ""} into the CRM.`);
    setResults((prev) => prev.filter((p) => !selectedIds.includes(p.apolloId)));
    setSelected({});
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSearch}
        className="bg-panel border border-border rounded-xl p-4 grid sm:grid-cols-3 gap-3 items-end"
      >
        <div className="space-y-1.5">
          <Label htmlFor="op-titles">Job titles</Label>
          <Input
            id="op-titles"
            value={titles}
            onChange={(e) => setTitles(e.target.value)}
            placeholder="Founder, CEO, VP Sales"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="op-locations">Locations</Label>
          <Input
            id="op-locations"
            value={locations}
            onChange={(e) => setLocations(e.target.value)}
            placeholder="India, United States"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="op-keywords">Keywords</Label>
          <Input
            id="op-keywords"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="e.g. SaaS"
          />
        </div>
        <div className="sm:col-span-3">
          <Button type="submit" disabled={searchPeople.isPending} className="gap-1.5">
            {searchPeople.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            Search Apollo
          </Button>
        </div>
      </form>

      {notice && (
        <div className="flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="size-4" /> {notice}
        </div>
      )}

      {results.length > 0 && (
        <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
            <span className="text-sm font-semibold">{results.length} results</span>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={selectedIds.length === 0 || importPeople.isPending}
              className="gap-1.5"
            >
              {importPeople.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <UserPlus className="size-3.5" />
              )}
              Import Selected ({selectedIds.length})
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Name</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Company</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((p) => (
                <TableRow key={p.apolloId}>
                  <TableCell>
                    <Checkbox
                      checked={!!selected[p.apolloId]}
                      onCheckedChange={(checked) =>
                        setSelected((prev) => ({ ...prev, [p.apolloId]: !!checked }))
                      }
                    />
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.firstName} {p.lastNamePreview ?? ""}
                  </TableCell>
                  <TableCell className="text-sm text-text-dim">{p.title ?? "—"}</TableCell>
                  <TableCell className="text-sm text-text-dim">{p.organizationName ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="px-4 py-2.5 text-[10px] text-text-dim border-t border-border-subtle">
            Names/emails are revealed only when you import a contact — searching doesn't use Apollo credits.
          </p>
        </div>
      )}

      {!searchPeople.isPending && searchPeople.isSuccess && results.length === 0 && (
        <p className="text-sm text-text-dim py-8 text-center">No results for that search.</p>
      )}
    </div>
  );
}

// ─── Find Companies ─────────────────────────────────────────────────────────

function FindCompaniesTab() {
  const searchOrgs = useSearchApolloOrganizations();
  const importOrgs = useImportApolloOrganizations();

  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [locations, setLocations] = useState("");
  const [results, setResults] = useState<ApolloOrganizationPreview[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const selectedDomains = useMemo(
    () => Object.keys(selected).filter((domain) => selected[domain]),
    [selected],
  );

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    setSelected({});
    const found = await searchOrgs.mutateAsync({
      name: name.trim() || undefined,
      keywords: keywords.trim() || undefined,
      locations: commaList(locations),
      perPage: 25,
    });
    setResults(found);
  }

  async function handleImport() {
    setNotice(null);
    const imported = await importOrgs.mutateAsync(selectedDomains);
    setNotice(`Imported ${imported.length} compan${imported.length !== 1 ? "ies" : "y"} into the CRM.`);
    setResults((prev) => prev.filter((o) => !o.domain || !selectedDomains.includes(o.domain)));
    setSelected({});
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSearch}
        className="bg-panel border border-border rounded-xl p-4 grid sm:grid-cols-3 gap-3 items-end"
      >
        <div className="space-y-1.5">
          <Label htmlFor="oc-name">Company name</Label>
          <Input id="oc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Apollo" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="oc-locations">Locations</Label>
          <Input
            id="oc-locations"
            value={locations}
            onChange={(e) => setLocations(e.target.value)}
            placeholder="India, United States"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="oc-keywords">Keywords</Label>
          <Input
            id="oc-keywords"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="e.g. healthcare"
          />
        </div>
        <div className="sm:col-span-3">
          <Button type="submit" disabled={searchOrgs.isPending} className="gap-1.5">
            {searchOrgs.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            Search Apollo
          </Button>
        </div>
      </form>

      {notice && (
        <div className="flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="size-4" /> {notice}
        </div>
      )}

      {results.length > 0 && (
        <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
            <span className="text-sm font-semibold">{results.length} results</span>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={selectedDomains.length === 0 || importOrgs.isPending}
              className="gap-1.5"
            >
              {importOrgs.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <UserPlus className="size-3.5" />
              )}
              Import Selected ({selectedDomains.length})
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Name</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Employees</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((o) => (
                <TableRow key={o.apolloId ?? o.domain ?? o.name}>
                  <TableCell>
                    <Checkbox
                      checked={!!o.domain && !!selected[o.domain]}
                      disabled={!o.domain}
                      onCheckedChange={(checked) =>
                        o.domain && setSelected((prev) => ({ ...prev, [o.domain!]: !!checked }))
                      }
                    />
                  </TableCell>
                  <TableCell className="text-sm">{o.name}</TableCell>
                  <TableCell className="text-sm text-text-dim">{o.domain ?? "—"}</TableCell>
                  <TableCell className="text-sm text-text-dim">{o.industry ?? "—"}</TableCell>
                  <TableCell className="text-sm text-text-dim">{o.employeeCount ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!searchOrgs.isPending && searchOrgs.isSuccess && results.length === 0 && (
        <p className="text-sm text-text-dim py-8 text-center">No results for that search.</p>
      )}
    </div>
  );
}

// ─── Templates ──────────────────────────────────────────────────────────────

function TemplatesTab() {
  const { data: templates = [], isLoading } = useEmailTemplates();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | undefined>(undefined);

  function openCreate() {
    setEditingTemplate(undefined);
    setDialogOpen(true);
  }

  function openEdit(template: EmailTemplate) {
    setEditingTemplate(template);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border/70 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-black tracking-tight text-foreground">
              Sales Email Templates & Cadence Snippets
            </h3>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {templates.length} Total
            </span>
          </div>
          <p className="text-xs text-text-dim mt-1">
            Reusable business emails with dynamic merge tags (<code>{"{{firstName}}"}</code>, <code>{"{{companyName}}"}</code>, <code>{"{{title}}"}</code>).
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setLibraryOpen(true)}
            className="gap-1.5 text-xs font-bold border-indigo-500/30 text-indigo-600 dark:text-indigo-400 bg-indigo-500/5 hover:bg-indigo-500/15 rounded-xl shadow-2xs"
          >
            <Sparkles className="size-3.5 text-amber-500" />
            English Template Library
          </Button>
          <Button
            size="sm"
            onClick={openCreate}
            className="gap-1.5 text-xs font-bold bg-primary text-white hover:bg-primary/90 rounded-xl shadow-xs"
          >
            <Plus className="size-3.5" />
            New Template
          </Button>
        </div>
      </div>

      <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Created by</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-text-dim py-8">
                  <Loader2 className="size-4 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && templates?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-text-dim py-8 space-y-2">
                  <p>No templates yet.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setLibraryOpen(true)}
                    className="gap-1.5 text-xs font-bold text-primary"
                  >
                    <Sparkles className="size-3 text-amber-500" />
                    Load English Business Templates
                  </Button>
                </TableCell>
              </TableRow>
            )}
            {templates?.map((t) => (
              <TableRow key={t.id} className="cursor-pointer hover:bg-primary/5 transition-colors" onClick={() => openEdit(t)}>
                <TableCell className="font-semibold text-sm text-foreground">{t.name}</TableCell>
                <TableCell className="text-sm text-text-dim truncate max-w-xs">{t.subject}</TableCell>
                <TableCell className="text-sm text-text-dim">
                  {t.creator.firstName} {t.creator.lastName}
                </TableCell>
                <TableCell className="text-sm text-text-dim">
                  {new Date(t.updatedAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Pencil className="size-3.5 text-text-dim" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <EmailTemplateFormDialog open={dialogOpen} onOpenChange={setDialogOpen} template={editingTemplate} />
      <BusinessTemplatesLibraryDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        existingTemplates={templates}
      />
    </div>
  );
}

// ─── Sequences ──────────────────────────────────────────────────────────────

const SEQUENCE_STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-canvas/50 text-text-dim border-border-subtle",
  ACTIVE: "bg-success/15 text-success border-success/20",
  PAUSED: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  ARCHIVED: "bg-muted text-text-dim border-border-subtle",
};

function SequencesTab() {
  const { data: sequences, isLoading } = useSequences();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role.name === "ADMIN";
  const runEngine = useRunSequenceEngine();

  const [formOpen, setFormOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [editingSequence, setEditingSequence] = useState<Sequence | undefined>(undefined);
  const [enrollingSequence, setEnrollingSequence] = useState<Sequence | undefined>(undefined);
  const [engineNotice, setEngineNotice] = useState<string | null>(null);

  function openCreate() {
    setEditingSequence(undefined);
    setFormOpen(true);
  }

  function openEdit(seq: Sequence) {
    setEditingSequence(seq);
    setFormOpen(true);
  }

  function openEnroll(seq: Sequence) {
    setEnrollingSequence(seq);
    setEnrollOpen(true);
  }

  async function handleRunEngine() {
    setEngineNotice(null);
    const res = await runEngine.mutateAsync();
    setEngineNotice(`Processed ${res.processed} due enrollment${res.processed !== 1 ? "s" : ""}.`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-text-dim">
          Multi-step drip campaigns. Only ACTIVE sequences send scheduled emails.
        </p>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleRunEngine}
              disabled={runEngine.isPending}
              className="gap-1.5"
              title="Manually process due sends now, instead of waiting for the next scheduled run"
            >
              {runEngine.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <PlayCircle className="size-3.5" />
              )}
              Run engine now
            </Button>
          )}
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="size-3.5" />
            New Sequence
          </Button>
        </div>
      </div>
      {engineNotice && <p className="text-xs text-success">{engineNotice}</p>}

      <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Steps</TableHead>
              <TableHead>Enrolled</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-text-dim py-8">
                  <Loader2 className="size-4 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && sequences?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-text-dim py-8">
                  No sequences yet. Click "New Sequence" to build one.
                </TableCell>
              </TableRow>
            )}
            {sequences?.map((seq) => (
              <TableRow key={seq.id}>
                <TableCell className="font-medium text-sm">{seq.name}</TableCell>
                <TableCell>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${SEQUENCE_STATUS_STYLES[seq.status]}`}
                  >
                    {seq.status}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-text-dim">{seq.steps.length}</TableCell>
                <TableCell className="text-sm text-text-dim">{seq._count.enrollments}</TableCell>
                <TableCell className="text-right space-x-3">
                  <button
                    type="button"
                    onClick={() => openEnroll(seq)}
                    className="text-xs text-primary hover:underline"
                  >
                    Enroll
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(seq)}
                    className="text-xs text-text-dim hover:text-foreground"
                  >
                    Edit
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <SequenceFormDialog open={formOpen} onOpenChange={setFormOpen} sequence={editingSequence} />
      <SequenceEnrollDialog open={enrollOpen} onOpenChange={setEnrollOpen} sequence={enrollingSequence} />
    </div>
  );
}

// ─── Hiring Signals ─────────────────────────────────────────────────────────

function HiringSignalsTab() {
  const { data: automations = [], isLoading } = useHiringSignalAutomations();
  const runAutomation = useRunHiringSignalAutomation();

  const [formOpen, setFormOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<HiringSignalAutomation | undefined>(undefined);
  const [runNotice, setRunNotice] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  // Computed metrics
  const activeCount = useMemo(() => automations.filter((a) => a.isActive).length, [automations]);
  const totalSignals = useMemo(() => automations.reduce((acc, a) => acc + (a._count?.signals || 0), 0), [automations]);
  const linkedSequencesCount = useMemo(() => new Set(automations.map((a) => a.sequence?.id).filter(Boolean)).size, [automations]);

  function openCreate() {
    setEditingAutomation(undefined);
    setFormOpen(true);
  }

  function openEdit(automation: HiringSignalAutomation) {
    setEditingAutomation(automation);
    setFormOpen(true);
  }

  async function handleRunNow(automation: HiringSignalAutomation) {
    setRunNotice(null);
    setRunningId(automation.id);
    try {
      const res = await runAutomation.mutateAsync(automation.id);
      setRunNotice(
        `${automation.name}: checked ${res.candidatesChecked} candidate compan${res.candidatesChecked === 1 ? "y" : "ies"}, found ${res.signalsFound} new hiring signal${res.signalsFound !== 1 ? "s" : ""}.`,
      );
      toast.success(`Hiring signal scan complete for ${automation.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to run automation scan.");
    } finally {
      setRunningId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* ─── Hero Command Banner ─── */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card/95 to-primary/[0.03] p-6 sm:p-7 shadow-sm backdrop-blur-xl">
        <div className="absolute -right-24 -top-24 size-80 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-24 -bottom-24 size-80 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        <div className="relative space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/25 shadow-2xs">
                <Radar className="size-3 text-amber-500 animate-pulse" /> Multi-ATS Radar
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/25 shadow-2xs">
                <Check className="size-3" /> 6-Hour Background Sync
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-500 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/25 shadow-2xs">
                <Sparkles className="size-3" /> Auto Sequence Enroller
              </span>
            </div>

            <Button
              size="sm"
              onClick={openCreate}
              className="gap-2 font-bold text-xs bg-gradient-to-r from-primary via-primary to-indigo-600 hover:opacity-95 text-white rounded-xl shadow-md shadow-primary/25 h-10 px-5 transition-all self-start sm:self-auto"
            >
              <Plus className="size-4" />
              New Automation
            </Button>
          </div>

          <div className="space-y-1.5 max-w-3xl">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
              Autonomous Hiring Signals & Sequence Outreach
            </h2>
            <p className="text-xs sm:text-sm text-text-dim leading-relaxed">
              Continuously scans Greenhouse, Ashby, Lever, and Adzuna for new job openings. When companies hire for your target roles, the engine resolves verified executive decision-makers via Apollo and auto-enrolls them into your drip sequence.
            </p>
          </div>

          {runNotice && (
            <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5" />
              {runNotice}
            </div>
          )}
        </div>
      </div>

      {/* ─── KPI Metric Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Active Automations</span>
            <div className="size-8 rounded-xl bg-emerald-500/10 text-emerald-500 grid place-items-center">
              <Radar className="size-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">{activeCount}</p>
          <p className="text-[11px] text-text-dim mt-0.5">Crawling feeds every 6h</p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Total Automations</span>
            <div className="size-8 rounded-xl bg-primary/10 text-primary grid place-items-center">
              <ListChecks className="size-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-foreground mt-2">{automations.length}</p>
          <p className="text-[11px] text-text-dim mt-0.5">Configured scan pipelines</p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Signals Captured</span>
            <div className="size-8 rounded-xl bg-indigo-500/10 text-indigo-500 grid place-items-center">
              <Flame className="size-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-2">{totalSignals}</p>
          <p className="text-[11px] text-text-dim mt-0.5">Hiring companies detected</p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Linked Sequences</span>
            <div className="size-8 rounded-xl bg-amber-500/10 text-amber-500 grid place-items-center">
              <Mail className="size-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">{linkedSequencesCount}</p>
          <p className="text-[11px] text-text-dim mt-0.5">Automated drip funnels</p>
        </div>
      </div>

      {/* ─── How it Works Banner (When empty or as a visual guide) ─── */}
      {!isLoading && automations.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border/80 bg-card/60 p-8 sm:p-10 text-center space-y-6">
          <div className="size-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary mx-auto grid place-items-center shadow-inner">
            <Radar className="size-7" />
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-lg font-black text-foreground">No Automated Pipelines Configured Yet</h3>
            <p className="text-xs text-text-dim leading-relaxed">
              Create an automation to automatically discover companies actively hiring in your target niche and enroll their decision-makers into cold sequences.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto text-left pt-2">
            <div className="p-4 rounded-2xl bg-canvas/80 border border-border/70 space-y-2">
              <div className="size-8 rounded-xl bg-amber-500/10 text-amber-500 font-black text-xs grid place-items-center">
                1
              </div>
              <h4 className="text-xs font-bold text-foreground">Multi-ATS Job Crawling</h4>
              <p className="text-[11px] text-text-dim leading-relaxed">
                Scans Greenhouse, Lever, Ashby, and Adzuna for companies posting matching roles.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-canvas/80 border border-border/70 space-y-2">
              <div className="size-8 rounded-xl bg-indigo-500/10 text-indigo-500 font-black text-xs grid place-items-center">
                2
              </div>
              <h4 className="text-xs font-bold text-foreground">Apollo Executive Resolution</h4>
              <p className="text-[11px] text-text-dim leading-relaxed">
                Extracts up to 2 verified Founders, CEOs, or HR heads with corporate email addresses.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-canvas/80 border border-border/70 space-y-2">
              <div className="size-8 rounded-xl bg-emerald-500/10 text-emerald-500 font-black text-xs grid place-items-center">
                3
              </div>
              <h4 className="text-xs font-bold text-foreground">Automated Cadence Enrollment</h4>
              <p className="text-[11px] text-text-dim leading-relaxed">
                Queues discovered decision-makers directly into your email drip sequence.
              </p>
            </div>
          </div>

          <Button
            onClick={openCreate}
            className="gap-2 font-bold text-xs bg-gradient-to-r from-primary via-primary to-indigo-600 hover:opacity-95 text-white rounded-xl shadow-md shadow-primary/25 h-11 px-6"
          >
            <Plus className="size-4" />
            Create Your First Automation
          </Button>
        </div>
      )}

      {/* ─── Automations Table ─── */}
      {(isLoading || automations.length > 0) && (
        <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs">
          <Table>
            <TableHeader>
              <TableRow className="bg-canvas/50">
                <TableHead className="w-[30%]">Automation Name</TableHead>
                <TableHead className="w-[15%]">Status</TableHead>
                <TableHead className="w-[20%]">Enrolled Sequence</TableHead>
                <TableHead className="w-[15%]">Signals Found</TableHead>
                <TableHead className="w-[10%]">Last Scan</TableHead>
                <TableHead className="w-[10%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-text-dim py-12">
                    <Loader2 className="size-5 animate-spin mx-auto text-primary" />
                    <p className="text-xs text-text-dim mt-2">Loading automations…</p>
                  </TableCell>
                </TableRow>
              ) : (
                automations.map((automation) => (
                  <TableRow key={automation.id} className="hover:bg-primary/5 transition-colors">
                    <TableCell className="font-bold text-sm text-foreground py-4">
                      <div className="space-y-0.5">
                        <span>{automation.name}</span>
                        <p className="text-[11px] font-normal text-text-dim">
                          Every 6 hours • Greenhouse, Ashby, Lever, Adzuna
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded-full border font-bold ${
                          automation.isActive
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "border-border/70 bg-canvas/60 text-text-dim"
                        }`}
                      >
                        <span className={`size-1.5 rounded-full ${automation.isActive ? "bg-emerald-500 animate-pulse" : "bg-text-muted"}`} />
                        {automation.isActive ? "ACTIVE" : "PAUSED"}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-foreground">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-canvas border border-border-subtle">
                        <Mail className="size-3 text-primary" />
                        {automation.sequence?.name || "No Sequence"}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs font-bold text-primary">
                      <span className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                        {automation._count?.signals || 0} signals
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-text-dim">
                      {automation.lastRunAt ? new Date(automation.lastRunAt).toLocaleDateString() : "Never"}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRunNow(automation)}
                        disabled={runningId === automation.id}
                        className="h-8 text-xs font-bold gap-1 rounded-lg"
                      >
                        {runningId === automation.id ? (
                          <>
                            <Loader2 className="size-3 animate-spin text-primary" />
                            Scanning…
                          </>
                        ) : (
                          <>
                            <PlayCircle className="size-3 text-primary" />
                            Run Now
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(automation)}
                        className="h-8 text-xs font-bold text-text-dim hover:text-foreground rounded-lg"
                      >
                        <Pencil className="size-3" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <HiringSignalAutomationFormDialog open={formOpen} onOpenChange={setFormOpen} automation={editingAutomation} />
    </div>
  );
}

// ─── Growth Signals ─────────────────────────────────────────────────────────
//
// Reviewable "this company looks like it's expanding" feed -- hiring
// velocity (from HiringSignal data) and Claude-classified funding/deal/
// expansion news, side by side. Nothing gets emailed automatically: a
// sales rep has to explicitly Accept (choosing a sequence) or Dismiss each
// one. See server/src/modules/company-growth.

const GROWTH_SIGNAL_LABELS: Record<CompanyGrowthSignalType, string> = {
  HIRING_VELOCITY: "Hiring velocity",
  NEWS_EXPANSION: "Expansion",
  NEWS_FUNDING: "Funding",
  NEWS_DEAL: "Deal signed",
  APOLLO_HIRING: "Apollo: hiring",
  APOLLO_HEADCOUNT_GROWTH: "Apollo: headcount growth",
};

const GROWTH_SIGNAL_BADGE_CLASSES: Record<CompanyGrowthSignalType, string> = {
  HIRING_VELOCITY: "border-primary/30 bg-primary/10 text-primary",
  NEWS_EXPANSION: "border-success/30 bg-success/10 text-success",
  NEWS_FUNDING: "border-amber-500/30 bg-amber-500/10 text-amber-600",
  NEWS_DEAL: "border-violet-500/30 bg-violet-500/10 text-violet-600",
  APOLLO_HIRING: "border-blue-500/30 bg-blue-500/10 text-blue-600",
  APOLLO_HEADCOUNT_GROWTH: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
};

const GROWTH_SIGNAL_ICONS: Record<CompanyGrowthSignalType, typeof Radar> = {
  HIRING_VELOCITY: Radar,
  NEWS_EXPANSION: Newspaper,
  NEWS_FUNDING: Newspaper,
  NEWS_DEAL: Newspaper,
  APOLLO_HIRING: Building2,
  APOLLO_HEADCOUNT_GROWTH: TrendingUp,
};

function GrowthSignalBadge({ type }: { type: CompanyGrowthSignalType }) {
  const Icon = GROWTH_SIGNAL_ICONS[type];
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${GROWTH_SIGNAL_BADGE_CLASSES[type]}`}
    >
      <Icon className="size-3" />
      {GROWTH_SIGNAL_LABELS[type]}
    </span>
  );
}

function GrowthSignalsTab() {
  const [statusFilter, setStatusFilter] = useState<"PENDING" | "ACCEPTED" | "DISMISSED">("PENDING");
  const { data: signals = [], isLoading } = useGrowthSignals({ status: statusFilter });
  const acceptSignal = useAcceptGrowthSignal();
  const dismissSignal = useDismissGrowthSignal();
  const { data: sequences = [] } = useSequences();
  const { data: newsLog, isLoading: newsLogLoading } = useNewsLog();
  const scanNews = useScanNewsNow();
  const scanApollo = useScanApolloNow();
  const [showNewsLog, setShowNewsLog] = useState(false);

  const [accepting, setAccepting] = useState<CompanyGrowthSignal | undefined>(undefined);
  const [sequenceId, setSequenceId] = useState("");

  // Computed metrics
  const pendingCount = useMemo(() => signals.filter((s) => s.status === "PENDING").length, [signals]);
  const hiringCount = useMemo(() => signals.filter((s) => s.type === "HIRING_VELOCITY" || s.type === "APOLLO_HIRING").length, [signals]);
  const headcountCount = useMemo(() => signals.filter((s) => s.type === "APOLLO_HEADCOUNT_GROWTH").length, [signals]);
  const newsCount = useMemo(() => signals.filter((s) => s.type.startsWith("NEWS_")).length, [signals]);

  async function handleScanNews() {
    try {
      const res = await scanNews.mutateAsync();
      setShowNewsLog(true);
      if (res.articlesFetched === 0) {
        toast.info(
          res.companiesScanned === 0
            ? "No companies to scan yet — Growth Signals tracks companies you already have a hiring signal or Apollo import for."
            : `Scanned ${res.companiesScanned} companies, no new articles found. Check back tomorrow or try a broader time window.`,
        );
      } else {
        toast.success(
          `Scanned ${res.companiesScanned} companies, fetched ${res.articlesFetched} new article${res.articlesFetched === 1 ? "" : "s"}, found ${res.signalsFound} signal${res.signalsFound === 1 ? "" : "s"}.`,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "News scan failed.");
    }
  }

  async function handleScanApollo() {
    try {
      const res = await scanApollo.mutateAsync();
      if (res.automationsScanned === 0) {
        toast.info("No active Hiring Signal automations yet — Apollo signals reuse an automation's target titles/locations. Set one up on the Hiring Signals tab first.");
      } else if (res.companiesChecked === 0) {
        toast.info(`Checked ${res.automationsScanned} automation(s), Apollo returned no matching companies for their target titles/locations.`);
      } else {
        toast.success(
          `Checked ${res.companiesChecked} companies across ${res.automationsScanned} automation(s), found ${res.signalsFound} new signal${res.signalsFound === 1 ? "" : "s"}.`,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Apollo scan failed.");
    }
  }

  function openAccept(signal: CompanyGrowthSignal) {
    setSequenceId("");
    setAccepting(signal);
  }

  async function confirmAccept() {
    if (!accepting || !sequenceId) return;
    try {
      await acceptSignal.mutateAsync({ id: accepting.id, sequenceId });
      toast.success(`Enrolled a contact at ${accepting.company.name} — email sequence started.`);
      setAccepting(undefined);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't accept this signal.");
    }
  }

  async function handleDismiss(signal: CompanyGrowthSignal) {
    try {
      await dismissSignal.mutateAsync(signal.id);
      toast.success("Signal dismissed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't dismiss this signal.");
    }
  }

  return (
    <div className="space-y-6">
      {/* ─── Hero Command Banner ─── */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card/95 to-primary/[0.03] p-6 sm:p-7 shadow-sm backdrop-blur-xl">
        <div className="absolute -right-24 -top-24 size-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-24 -bottom-24 size-80 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

        <div className="relative space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/25 shadow-2xs">
                <TrendingUp className="size-3 text-emerald-500 animate-pulse" /> Growth & Expansion Feed
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/25 shadow-2xs">
                <Building2 className="size-3" /> Apollo Headcount Signals
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-violet-500 bg-violet-500/10 px-3 py-1 rounded-full border border-violet-500/25 shadow-2xs">
                <Newspaper className="size-3" /> NewsAPI + Claude Classifier
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleScanApollo}
                disabled={scanApollo.isPending}
                className="gap-1.5 text-xs font-bold rounded-xl h-10 px-3.5 border-border/80"
              >
                <Building2 className="size-3.5 text-primary" />
                {scanApollo.isPending ? "Scanning Apollo…" : "Scan Apollo"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleScanNews}
                disabled={scanNews.isPending}
                className="gap-1.5 text-xs font-bold rounded-xl h-10 px-3.5 border-border/80"
              >
                <PlayCircle className="size-3.5 text-emerald-500" />
                {scanNews.isPending ? "Scanning News…" : "Scan News"}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5 max-w-3xl">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
              Company Growth & Expansion Signals
            </h2>
            <p className="text-xs sm:text-sm text-text-dim leading-relaxed">
              Detect companies with high hiring velocity, Apollo headcount spikes, and Claude-analyzed funding and expansion events. Review signals with 1-click sequence enrollment.
            </p>
          </div>

          {/* Filter Bar */}
          <div className="pt-2">
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <TabsList className="bg-canvas/80 border border-border/70 p-1 rounded-xl">
                <TabsTrigger value="PENDING" className="text-xs font-bold rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Pending Review ({pendingCount})
                </TabsTrigger>
                <TabsTrigger value="ACCEPTED" className="text-xs font-bold rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Accepted & Enrolled
                </TabsTrigger>
                <TabsTrigger value="DISMISSED" className="text-xs font-bold rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Dismissed
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {/* ─── KPI Metric Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Pending Signals</span>
            <div className="size-8 rounded-xl bg-amber-500/10 text-amber-500 grid place-items-center">
              <Flame className="size-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">{pendingCount}</p>
          <p className="text-[11px] text-text-dim mt-0.5">Awaiting sales rep review</p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Hiring Velocity</span>
            <div className="size-8 rounded-xl bg-primary/10 text-primary grid place-items-center">
              <Radar className="size-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-primary mt-2">{hiringCount}</p>
          <p className="text-[11px] text-text-dim mt-0.5">Rapid vacancy spikes</p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Headcount Growth</span>
            <div className="size-8 rounded-xl bg-emerald-500/10 text-emerald-500 grid place-items-center">
              <TrendingUp className="size-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">{headcountCount}</p>
          <p className="text-[11px] text-text-dim mt-0.5">Apollo employee expansion</p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">News & Deals</span>
            <div className="size-8 rounded-xl bg-violet-500/10 text-violet-500 grid place-items-center">
              <Newspaper className="size-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-violet-600 dark:text-violet-400 mt-2">{newsCount}</p>
          <p className="text-[11px] text-text-dim mt-0.5">Funding / M&A / Expansion</p>
        </div>
      </div>

      {/* ─── Signals Feed Table ─── */}
      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-canvas/50">
              <TableHead className="w-[25%]">Target Company</TableHead>
              <TableHead className="w-[20%]">Signal Type</TableHead>
              <TableHead className="w-[35%]">Intelligence Summary</TableHead>
              <TableHead className="w-[10%]">Detected</TableHead>
              {statusFilter === "PENDING" && <TableHead className="w-[10%] text-right">Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-text-dim py-12">
                  <Loader2 className="size-5 animate-spin mx-auto text-primary" />
                  <p className="text-xs text-text-dim mt-2">Loading signals…</p>
                </TableCell>
              </TableRow>
            ) : signals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-text-dim py-12 space-y-2">
                  <TrendingUp className="size-8 mx-auto text-text-muted/50" />
                  <p className="text-sm font-bold text-foreground">
                    {statusFilter === "PENDING"
                      ? "No pending growth signals found"
                      : `No ${statusFilter.toLowerCase()} signals`}
                  </p>
                  <p className="text-xs text-text-dim max-w-sm mx-auto">
                    Click "Scan Apollo" or "Scan News" above to check tracked companies for fresh hiring velocity and funding events.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              signals.map((signal) => (
                <TableRow key={signal.id} className="hover:bg-primary/5 transition-colors">
                  <TableCell className="font-bold text-sm text-foreground py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="size-8 rounded-xl bg-primary/10 text-primary font-black text-xs grid place-items-center shrink-0">
                        {signal.company.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-bold text-foreground">{signal.company.name}</span>
                        {signal.company.domain && (
                          <p className="text-[11px] text-text-dim">{signal.company.domain}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <GrowthSignalBadge type={signal.type} />
                  </TableCell>
                  <TableCell className="text-xs text-text-dim leading-relaxed">
                    <p className="line-clamp-2">{signal.summary}</p>
                    {signal.sourceUrl && (
                      <a
                        href={signal.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline mt-1"
                      >
                        Read Source Article <ExternalLink className="size-2.5" />
                      </a>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-text-dim whitespace-nowrap">
                    {new Date(signal.detectedAt).toLocaleDateString()}
                  </TableCell>
                  {statusFilter === "PENDING" && (
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        onClick={() => openAccept(signal)}
                        className="h-8 text-xs font-bold bg-primary hover:bg-primary/90 text-white rounded-lg shadow-2xs"
                      >
                        Accept & Enroll
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDismiss(signal)}
                        disabled={dismissSignal.isPending}
                        className="h-8 text-xs font-bold text-text-dim hover:text-foreground rounded-lg"
                      >
                        Dismiss
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ─── Recent News Log Accordion ─── */}
      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs">
        <button
          type="button"
          onClick={() => setShowNewsLog((v) => !v)}
          className="w-full px-5 py-4 flex items-center justify-between gap-2 text-left hover:bg-canvas/50 transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Newspaper className="size-4 text-primary" />
            Recent News Articles Scanned
            <span className="text-xs font-normal text-text-dim">
              ({newsLog?.length ?? 0} article{newsLog?.length === 1 ? "" : "s"} cached)
            </span>
          </span>
          <span className="text-xs font-bold text-primary">{showNewsLog ? "Hide Log ▲" : "Show Log ▼"}</span>
        </button>
        {showNewsLog && (
          <div className="border-t border-border-subtle p-4 space-y-3">
            <p className="text-xs text-text-dim">
              Every article NewsAPI returned for tracked companies. Classified with Claude AI for hiring velocity, deals, and funding signals.
            </p>
            <Table>
              <TableHeader>
                <TableRow className="bg-canvas/50">
                  <TableHead>Company</TableHead>
                  <TableHead>Article Headline</TableHead>
                  <TableHead>Fetched At</TableHead>
                  <TableHead>Classification Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {newsLogLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-text-dim py-6">
                      <Loader2 className="size-4 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : (newsLog?.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-text-dim py-6">
                      No news articles fetched yet. Click "Scan news now" above.
                    </TableCell>
                  </TableRow>
                ) : (
                  newsLog?.map((item) => (
                    <TableRow key={item.id} className="text-xs">
                      <TableCell className="font-bold">{item.company.name}</TableCell>
                      <TableCell className="max-w-md">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline line-clamp-1 inline-flex items-center gap-1"
                        >
                          {item.title} <ExternalLink className="size-2.5 shrink-0" />
                        </a>
                      </TableCell>
                      <TableCell className="text-text-dim whitespace-nowrap">
                        {new Date(item.fetchedAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            item.relevant
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                              : "bg-canvas text-text-dim border-border-subtle"
                          }`}
                        >
                          {!item.classified
                            ? "Awaiting classification"
                            : item.relevant
                              ? "Signal Detected"
                              : "No Match"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Accept Growth Signal Modal */}
      <Dialog open={!!accepting} onOpenChange={(open) => !open && setAccepting(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept Signal & Enroll — {accepting?.company.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-text-dim leading-relaxed">
              Accepting this signal finds a verified decision-maker at {accepting?.company.name} and enrolls them into the chosen sequence automatically.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Choose Sequence Cadence</Label>
              <select
                value={sequenceId}
                onChange={(e) => setSequenceId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-border bg-card text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-none"
              >
                <option value="">Select an outreach sequence…</option>
                {sequences.map((seq) => (
                  <option key={seq.id} value={seq.id}>
                    🚀 {seq.name} ({seq.steps?.length || 0} steps)
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
              <Button variant="outline" size="sm" onClick={() => setAccepting(undefined)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={confirmAccept}
                disabled={!sequenceId || acceptSignal.isPending}
                className="font-bold bg-primary hover:bg-primary/90"
              >
                {acceptSignal.isPending ? "Enrolling…" : "Confirm & Start Sequence"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Activity ───────────────────────────────────────────────────────────────

function ActivityTab() {
  const { data: activity, isLoading } = useSequenceActivity();
  const [selectedSendId, setSelectedSendId] = useState<string | undefined>();
  const [selectedContactName, setSelectedContactName] = useState<string | undefined>();

  return (
    <>
      <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contact</TableHead>
              <TableHead>Sequence</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-text-dim py-8">
                  <Loader2 className="size-4 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && activity?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-text-dim py-8">
                  No sends yet.
                </TableCell>
              </TableRow>
            )}
            {activity?.map((send) => (
              <TableRow
                key={send.id}
                onClick={() => {
                  setSelectedSendId(send.id);
                  setSelectedContactName(`${send.enrollment.contact.firstName} ${send.enrollment.contact.lastName}`);
                }}
                className="cursor-pointer hover:bg-accent/40 transition-colors"
              >
                <TableCell className="text-sm font-medium">
                  {send.enrollment.contact.firstName} {send.enrollment.contact.lastName}
                </TableCell>
                <TableCell className="text-sm text-text-dim">{send.enrollment.sequence.name}</TableCell>
                <TableCell className="text-sm text-text-dim">
                  {send.step?.template.name ?? <span className="italic">deleted step</span>}
                </TableCell>
                <TableCell>
                  {send.status === "SENT" ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-success">
                      <CheckCircle2 className="size-3" /> Sent
                    </span>
                  ) : send.status === "PENDING" ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-text-dim">
                      <Loader2 className="size-3 animate-spin" /> Sending
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 text-[11px] text-destructive"
                      title={send.errorMessage ?? undefined}
                    >
                      <XCircle className="size-3" /> Failed
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-text-dim">
                  {new Date(send.sentAt).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <SequenceRecipientJourneyDialog
        sendId={selectedSendId}
        contactName={selectedContactName}
        onOpenChange={(open) => !open && setSelectedSendId(undefined)}
      />
    </>
  );
}

function SequenceRecipientJourneyDialog({
  sendId,
  contactName,
  onOpenChange,
}: {
  sendId: string | undefined;
  contactName: string | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: events, isLoading } = useEngagementEvents({ recipientId: sendId }, !!sendId);

  return (
    <Dialog open={!!sendId} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            Sequence Journey: {contactName}
          </DialogTitle>
        </DialogHeader>
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-text-dim py-8 justify-center">
            <Loader2 className="size-4 animate-spin" /> Loading journey timeline…
          </div>
        )}
        {!isLoading && (!events || events.length === 0) && (
          <p className="text-xs text-text-dim py-6 text-center">
            No tracked engagement events yet for this send.
          </p>
        )}
        {events && events.length > 0 && (
          <ScrollArea className="max-h-80 pr-2">
            <div className="space-y-3 relative pl-4 border-l border-border-subtle my-2">
              {events.map((evt) => (
                <div key={evt.id} className="relative text-xs">
                  <span className="absolute -left-[21px] top-0.5 size-2.5 rounded-full bg-primary ring-4 ring-canvas" />
                  <p className="font-medium text-xs text-text">{evt.type.replace(/_/g, " ")}</p>
                  <p className="text-[10px] text-text-dim mt-0.5">
                    {new Date(evt.occurredAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
