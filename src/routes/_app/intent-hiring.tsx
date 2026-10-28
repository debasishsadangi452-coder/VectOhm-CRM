import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  Search,
  Loader2,
  Building2,
  Users,
  AlertCircle,
  CheckCircle2,
  Mail,
  Flame,
  MapPin,
  Globe,
  Briefcase,
  Crown,
  UserCheck2,
  SendHorizonal,
  Filter,
  ShieldCheck,
  Layers,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  Download,
  DollarSign,
  Radio,
  Clock,
  Sparkle,
  RotateCcw,
  Newspaper,
  SearchX,
  Phone,
  PhoneCall,
} from "lucide-react";
import { toast } from "sonner";
import { useDepartmentGuard } from "@/hooks/use-department-guard";
import { useApolloConnection } from "@/hooks/use-apollo";
import {
  useSearchIntentHiring,
  useEnrichIntentCompanies,
  useEnrichedContacts,
  useResolveAndSendIntentLead,
} from "@/hooks/use-hiring-signals";
import { useSequences } from "@/hooks/use-sequences";
import { IntentEmailAutomateDialog } from "@/components/intent-email-automate-dialog";
import { IntentNewsPanel } from "@/components/intent-news-panel";
import { ScrapedIntentNewsFeed } from "@/components/scraped-intent-news-feed";
import { IntentCrawlerFeed } from "@/components/intent-crawler-feed";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { type IntentHiringLead } from "@/lib/api/hiring-signals";

export const Route = createFileRoute("/_app/intent-hiring")({
  component: IntentHiringPage,
});

type IntentMode = "hiring" | "scraped" | "radar" | "news";

// Automatic emailing now lives with the rest of the email tools, so nobody has to guess which "automation" is which.
function AutoOutreachNotice() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs">
      <span className="text-text-dim">
        Want emails to go out automatically when companies hire or make news? Set that up under{" "}
        <span className="font-semibold text-foreground">Email Campaigns &rarr; Auto outreach</span>.
      </span>
      <Link to="/bulk-email" search={{ tab: "auto" }} className="font-semibold text-primary hover:underline">
        Open Auto outreach
      </Link>
    </div>
  );
}

function IntentModeSwitch({ mode, onChange }: { mode: IntentMode; onChange: (m: IntentMode) => void }) {
  const tabs: Array<{ id: IntentMode; label: string; icon: typeof Briefcase }> = [
    { id: "hiring", label: "Intent Hiring", icon: Briefcase },
    { id: "scraped", label: "Scraped ERP AI News", icon: Sparkles },
    { id: "radar", label: "Market Radar", icon: Radio },
    { id: "news", label: "Apollo News", icon: Newspaper },
  ];
  return (
    <div role="tablist" aria-label="Intent source" className="inline-flex rounded-xl border border-border/70 bg-card p-1 gap-1">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={mode === id}
          onClick={() => onChange(id)}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${mode === id
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-text-dim hover:text-foreground"
            }`}
        >
          <Icon className="size-3.5" /> {label}
        </button>
      ))}
    </div>
  );
}

function IntentHiringPage() {
  useDepartmentGuard(["Recruitment", "Sales"]);
  // Automations moved to Email Campaigns > Auto outreach; keep old bookmarks and links working.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "automations") {
      window.location.replace("/bulk-email?tab=auto");
    }
  }, []);
  const [mode, setMode] = useState<IntentMode>(() => {
    if (typeof window !== "undefined") {
      const tab = new URLSearchParams(window.location.search).get("tab");
      if (tab === "scraped" || tab === "erp-ai") return "scraped";
      if (tab === "news") return "news";
      if (tab === "radar") return "radar";
    }
    return "hiring";
  });

  const { data: connection, isLoading: connectionLoading } = useApolloConnection();
  const { data: savedContacts = [] } = useEnrichedContacts();
  const { data: sequences = [] } = useSequences();
  const searchIntent = useSearchIntentHiring();
  const enrichMutation = useEnrichIntentCompanies();
  const resolveAndSend = useResolveAndSendIntentLead();

  const apolloConnected = !!connection?.connected;

  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [results, setResults] = useState<IntentHiringLead[]>([]);
  const [searchInfo, setSearchInfo] = useState<{ role: string; location: string; totalFound: number; searchedAt?: string } | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchStep, setSearchStep] = useState(0);
  const [resolvingLead, setResolvingLead] = useState<IntentHiringLead | undefined>(undefined);
  const [resolveSequenceId, setResolveSequenceId] = useState("");

  // Auto-enrich dialog state
  const [showEnrichDialog, setShowEnrichDialog] = useState(false);
  const [selectedSequenceId, setSelectedSequenceId] = useState<string>("");
  const [enrichSpecificCompany, setEnrichSpecificCompany] = useState<string | null>(null);

  // Email automate dialog & table selection state
  const [showAutomateDialog, setShowAutomateDialog] = useState(false);
  const [selectedTableLeadIds, setSelectedTableLeadIds] = useState<Record<string, boolean>>({});

  function handleClearSearch() {
    setRole("");
    setLocation("");
    setResults([]);
    setSearchInfo(null);
    setHasSearched(false);
    setSelectedTableLeadIds({});
  }

  // Computed metrics
  const totalLeads = results.length;
  const uniqueCompanies = useMemo(() => new Set(results.map((r) => r.companyName).filter(Boolean)).size, [results]);
  const enrichedCount = useMemo(() => results.filter((r) => Boolean(r.decisionMaker)).length, [results]);
  const verifiedEmailCount = useMemo(() => results.filter((r) => Boolean(r.decisionMaker?.email)).length, [results]);
  const verifiedPhoneCount = useMemo(() => results.filter((r) => Boolean(r.decisionMaker?.phone)).length, [results]);

  const allTableSelected = useMemo(
    () => results.length > 0 && results.every((r) => selectedTableLeadIds[r.id]),
    [results, selectedTableLeadIds]
  );

  const selectedTableCount = useMemo(
    () => Object.values(selectedTableLeadIds).filter(Boolean).length,
    [selectedTableLeadIds]
  );

  function toggleSelectAllTable() {
    if (allTableSelected) {
      setSelectedTableLeadIds({});
    } else {
      const next: Record<string, boolean> = {};
      for (const r of results) next[r.id] = true;
      setSelectedTableLeadIds(next);
    }
  }

  function toggleTableLead(id: string) {
    setSelectedTableLeadIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  // Quick preset chips
  const quickPresets = [
    { role: "Full Stack Developer", location: "India" },
    { role: "Python Developer", location: "Bhubaneswar" },
    { role: "DevOps Engineer", location: "United States" },
    { role: "React Developer", location: "Remote" },
    { role: "Sales Manager", location: "India" },
    { role: "Product Designer", location: "Remote" },
    { role: "Data Engineer", location: "Remote" },
    { role: "Java Backend Developer", location: "India" },
  ];

  async function handleSearch(searchRole?: string, searchLoc?: string) {
    const targetRole = (searchRole ?? role).trim();
    const targetLoc = (searchLoc ?? location).trim();
    if (!targetRole) {
      toast.error("Please enter a job role to search.");
      return;
    }

    setHasSearched(true);
    setSearchStep(1);

    const stepInterval = setInterval(() => {
      setSearchStep((prev) => (prev < 4 ? prev + 1 : prev));
    }, 1800);

    try {
      const res = await searchIntent.mutateAsync({
        role: targetRole,
        location: targetLoc || undefined,
        maxResults: 25,
      });

      setResults(res.leads);
      setSearchInfo({
        role: res.role,
        location: res.location,
        totalFound: res.totalFound,
        searchedAt: new Date().toISOString(),
      });

      if (res.leads.length > 0) {
        toast.success(`Found ${res.leads.length} live hiring leads!`);
      } else {
        toast.info("Sorry, no live openings found matching those keywords.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Intent Hiring search failed. Check your API connections.");
    } finally {
      clearInterval(stepInterval);
      setSearchStep(0);
    }
  }

  async function handleEnrichAllWithApollo() {
    try {
      const payload = {
        companyNames: enrichSpecificCompany ? [enrichSpecificCompany] : undefined,
        autoEnrollSequenceId: selectedSequenceId || undefined,
      };

      const res = await enrichMutation.mutateAsync(payload);
      setShowEnrichDialog(false);
      setEnrichSpecificCompany(null);

      if (res.enrichedCount > 0) {
        if (res.leads && res.leads.length > 0) {
          setResults((prev) =>
            prev.map((l) => {
              const match = res.leads.find(
                (el) => el.companyName.toLowerCase().trim() === l.companyName.toLowerCase().trim(),
              );
              if (match && !l.decisionMaker) {
                return {
                  ...l,
                  decisionMaker: {
                    apolloId: match.apolloId ?? undefined,
                    name: match.personName,
                    firstName: match.firstName ?? undefined,
                    lastName: match.lastName ?? undefined,
                    title: match.title,
                    email: match.email,
                    phone: match.phone ?? null,
                    phoneType: (match.phoneType as any) ?? (match.phone ? "mobile" : null),
                    linkedinUrl: match.linkedinUrl,
                  },
                };
              }
              return l;
            }),
          );
        }
        toast.success(
          `Successfully enriched ${res.enrichedCount} decision makers (Founders & HR)! ${res.autoEnrolledCount > 0 ? `Auto-enrolled ${res.autoEnrolledCount} into email sequence.` : ""
          }`,
        );
      } else {
        toast.info("No new decision makers could be verified via Apollo for these companies.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Apollo enrichment failed.");
    }
  }

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  }

  function openResolveAndSend(lead: IntentHiringLead) {
    setResolveSequenceId("");
    setResolvingLead(lead);
  }

  async function confirmResolveAndSend() {
    if (!resolvingLead || !resolveSequenceId) return;
    try {
      const res = await resolveAndSend.mutateAsync({
        companyName: resolvingLead.companyName,
        companyDomain: resolvingLead.companyDomain,
        sequenceId: resolveSequenceId,
      });
      setResults((prev) =>
        prev.map((l) => (l.id === resolvingLead.id ? { ...l, decisionMaker: res.decisionMaker } : l)),
      );
      toast.success(`Found ${res.decisionMaker.name} at ${resolvingLead.companyName} — contact resolved.`);
      setResolvingLead(undefined);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't find a contact for this company.");
    }
  }

  function handleExportCsv() {
    if (results.length === 0) return;

    const headers = [
      "Job Title",
      "Company Name",
      "Location",
      "Job URL",
      "Decision Maker Name",
      "Decision Maker Title",
      "Official Email",
      "Official Mobile / Phone",
      "Phone Type",
      "LinkedIn URL",
      "Salary",
      "Discovered At",
    ];

    const rows = results.map((l) => [
      `"${(l.jobTitle || "").replace(/"/g, '""')}"`,
      `"${(l.companyName || "").replace(/"/g, '""')}"`,
      `"${(l.companyLocation || "").replace(/"/g, '""')}"`,
      `"${(l.jobUrl || "").replace(/"/g, '""')}"`,
      `"${(l.decisionMaker?.name || "").replace(/"/g, '""')}"`,
      `"${(l.decisionMaker?.title || "").replace(/"/g, '""')}"`,
      `"${(l.decisionMaker?.email || "").replace(/"/g, '""')}"`,
      `"${(l.decisionMaker?.phone || "").replace(/"/g, '""')}"`,
      `"${(l.decisionMaker?.phoneType || (l.decisionMaker?.phone ? "mobile" : "")).replace(/"/g, '""')}"`,
      `"${(l.decisionMaker?.linkedinUrl || "").replace(/"/g, '""')}"`,
      `"${(l.salary || "").replace(/"/g, '""')}"`,
      `"${(l.discoveredAt || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `intent_hiring_${role.toLowerCase().replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV export downloaded!");
  }

  if (mode === "scraped" || mode === "radar" || mode === "news") {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
        <IntentModeSwitch mode={mode} onChange={setMode} />
        <AutoOutreachNotice />
        {mode === "scraped" ? <ScrapedIntentNewsFeed /> : mode === "radar" ? <IntentCrawlerFeed /> : <IntentNewsPanel />}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      <IntentModeSwitch mode={mode} onChange={setMode} />
      <AutoOutreachNotice />
      {/* ─── Top Hero Header ─── */}
      <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-r from-card via-card/90 to-primary/[0.04] p-6 sm:p-7 shadow-xs backdrop-blur-xl">
        <div className="absolute -right-20 -top-20 size-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 size-72 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="relative flex size-12 sm:size-13 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 via-primary/10 to-indigo-500/20 border border-amber-500/30 text-amber-500 shadow-sm shadow-amber-500/10 shrink-0">
              <Sparkles className="size-6 text-amber-500 animate-pulse" strokeWidth={2} />
              <div className="absolute -top-1 -right-1 size-3 rounded-full bg-emerald-500 ring-4 ring-card" />
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                  Intent Hiring Intelligence
                </h1>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                  <Flame className="size-3 text-amber-500" /> Live Market Scraper
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/25">
                  Recruitment Sprints
                </span>
              </div>
              <p className="text-xs sm:text-sm text-text-dim max-w-2xl leading-relaxed">
                Detect active job openings in real-time across global markets, uncover verified executive & HR decision makers, and accelerate recruitment talent placement.
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

      {/* ─── Search Command Console ─── */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card/95 to-primary/[0.03] p-6 sm:p-8 shadow-sm backdrop-blur-xl">
        <div className="absolute -right-24 -top-24 size-80 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-24 -bottom-24 size-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative space-y-6">
          {/* Top Pill Tags Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/25 shadow-2xs">
                <Flame className="size-3 text-amber-500 animate-pulse" /> Live Market Scraper
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/25 shadow-2xs">
                <Check className="size-3" /> Real-Time Search
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/25 shadow-2xs">
                <Crown className="size-3" /> Apollo Leadership Sync
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-text-dim">
              <Clock className="size-3.5 text-primary" />
              <span>Instant DB Caching Enabled</span>
            </div>
          </div>

          {/* Heading and Intro */}
          <div className="space-y-1.5 max-w-3xl">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
              Intent-Based Hiring & Leadership Intelligence
            </h2>
            <p className="text-xs sm:text-sm text-text-dim leading-relaxed">
              Detect active job openings in real-time and uncover verified executive contacts (Founders, CEOs, Directors, and HR Leaders) for targeted recruitment placements and automated outreach.
            </p>
          </div>

          {/* Dual Search Input Bar Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="grid grid-cols-1 md:grid-cols-12 gap-3.5 pt-2"
          >
            <div className="md:col-span-6 space-y-1.5">
              <Label htmlFor="intent-role" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Briefcase className="size-3.5 text-primary" /> Target Job Role or Skill *
              </Label>
              <div className="relative">
                <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <Input
                  id="intent-role"
                  placeholder="e.g. Full Stack Developer, DevOps Engineer, Python Lead, Sales Director"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="pl-10 bg-canvas/80 border-border/80 focus:border-primary focus:ring-2 focus:ring-primary/20 h-11 text-sm font-medium rounded-xl shadow-2xs"
                  required
                />
              </div>
            </div>

            <div className="md:col-span-4 space-y-1.5">
              <Label htmlFor="intent-location" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <MapPin className="size-3.5 text-amber-500" /> Location or Country
              </Label>
              <div className="relative">
                <MapPin className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <Input
                  id="intent-location"
                  placeholder="e.g. India, United States, Remote, London, Bangalore"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="pl-10 bg-canvas/80 border-border/80 focus:border-primary focus:ring-2 focus:ring-primary/20 h-11 text-sm font-medium rounded-xl shadow-2xs"
                />
              </div>
            </div>

            <div className="md:col-span-2 flex items-end gap-2">
              <Button
                type="submit"
                disabled={searchIntent.isPending}
                className="flex-1 h-11 text-xs font-bold rounded-xl gap-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-primary hover:opacity-95 text-white shadow-md shadow-blue-500/20"
              >
                {searchIntent.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Scraping…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    <span>Scrape Leads</span>
                  </>
                )}
              </Button>
              {(role || location || results.length > 0) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClearSearch}
                  title="Clear search and start fresh"
                  className="h-11 px-3 rounded-xl border-border/80 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors shadow-2xs"
                >
                  <RotateCcw className="size-4" />
                </Button>
              )}
            </div>
          </form>

          {/* Quick Preset Tags */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50">
            <span className="text-[11px] font-bold text-text-muted flex items-center gap-1">
              <Flame className="size-3 text-amber-500" /> Popular Searches:
            </span>
            {quickPresets.map((preset) => (
              <button
                key={`${preset.role}-${preset.location}`}
                type="button"
                onClick={() => {
                  setRole(preset.role);
                  setLocation(preset.location);
                  handleSearch(preset.role, preset.location);
                }}
                className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-canvas border border-border/70 hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-colors cursor-pointer text-text-dim"
              >
                {preset.role} ({preset.location})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Search In-Flight Progress Animation ─── */}
      {searchIntent.isPending && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Loader2 className="size-5 animate-spin text-primary shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-foreground">Scraping Live Web Job Boards & Querying Apollo…</p>
              <p className="text-xs text-text-dim">
                Querying Adzuna, Ashby, Greenhouse, and cross-referencing Apollo for executive emails.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2">
            <div className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${searchStep >= 1 ? "bg-primary/15 border-primary/40 text-primary" : "bg-card border-border text-text-muted"}`}>
              <CheckCircle2 className="size-3.5 shrink-0" /> 1. Scanning Live Job Openings
            </div>
            <div className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${searchStep >= 2 ? "bg-primary/15 border-primary/40 text-primary" : "bg-card border-border text-text-muted"}`}>
              <CheckCircle2 className="size-3.5 shrink-0" /> 2. Extracting Company Profiles
            </div>
            <div className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${searchStep >= 3 ? "bg-primary/15 border-primary/40 text-primary" : "bg-card border-border text-text-muted"}`}>
              <CheckCircle2 className="size-3.5 shrink-0" /> 3. Resolving Apollo Leadership
            </div>
            <div className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${searchStep >= 4 ? "bg-primary/15 border-primary/40 text-primary" : "bg-card border-border text-text-muted"}`}>
              <CheckCircle2 className="size-3.5 shrink-0" /> 4. Finalizing Enriched Results
            </div>
          </div>
        </div>
      )}

      {/* ─── Results & Statistics Section ─── */}
      {results.length > 0 && (
        <div className="space-y-5">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-2xs">
              <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                <Briefcase className="size-3.5 text-primary" /> Active Job Openings
              </p>
              <p className="text-2xl font-black text-foreground mt-1.5">{totalLeads}</p>
              <p className="text-[11px] text-text-dim mt-0.5">Discovered via live web scraping</p>
            </div>

            <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-2xs">
              <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="size-3.5 text-indigo-500" /> Unique Companies
              </p>
              <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1.5">{uniqueCompanies}</p>
              <p className="text-[11px] text-text-dim mt-0.5">Actively hiring for this skill</p>
            </div>

            <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-2xs">
              <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                <Crown className="size-3.5 text-amber-500" /> Decision Makers Found
              </p>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1.5">{enrichedCount}</p>
              <p className="text-[11px] text-text-dim mt-0.5">Founders, CEOs & HR Leads</p>
            </div>

            <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-2xs">
              <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                <Mail className="size-3.5 text-emerald-500" /> Verified Emails
              </p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1.5">{verifiedEmailCount}</p>
              <p className="text-[11px] text-text-dim mt-0.5">Ready for direct placement</p>
            </div>

            <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-2xs">
              <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                <Phone className="size-3.5 text-blue-500" /> Official Mobile Numbers
              </p>
              <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1.5">{verifiedPhoneCount}</p>
              <p className="text-[11px] text-text-dim mt-0.5">Direct & mobile lines</p>
            </div>
          </div>

          {/* Results Action Toolbar & Info Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border/80 rounded-2xl p-4 shadow-2xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">
                  Hiring Leads for "{searchInfo?.role || role}" in "{searchInfo?.location || location || "Global"}"
                </h3>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {results.length} Leads
                </span>
              </div>
              {searchInfo?.searchedAt && (
                <p className="text-[11px] text-text-dim">
                  Fetched & persisted: {new Date(searchInfo.searchedAt).toLocaleString()}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEnrichSpecificCompany(null);
                  setShowEnrichDialog(true);
                }}
                disabled={enrichMutation.isPending}
                className="gap-1.5 text-xs font-bold border-indigo-500/30 text-indigo-600 dark:text-indigo-400 bg-indigo-500/5 hover:bg-indigo-500/15 rounded-xl shadow-2xs"
              >
                <Sparkles className="size-3.5 text-amber-500" />
                <span>Collect Founders & HR (Apollo)</span>
              </Button>

              <Button
                size="sm"
                onClick={() => setShowAutomateDialog(true)}
                disabled={results.length === 0}
                className="gap-1.5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-xs"
              >
                <Mail className="size-3.5" />
                <span>Email these leads</span>
                {selectedTableCount > 0 && (
                  <span className="size-4 rounded-full bg-white/20 text-white text-[10px] font-bold flex items-center justify-center">
                    {selectedTableCount}
                  </span>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                className="gap-1.5 text-xs font-bold rounded-xl shadow-2xs"
              >
                <Download className="size-3.5" />
                <span>Export CSV</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSearch}
                className="gap-1.5 text-xs font-medium rounded-xl text-text-muted hover:text-destructive hover:bg-destructive/10"
              >
                <RotateCcw className="size-3.5" />
                <span>Clear View</span>
              </Button>
            </div>
          </div>

          {/* Leads Table */}
          <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-canvas/60">
                  <TableRow>
                    <TableHead className="w-12 text-center">
                      <Checkbox
                        checked={allTableSelected}
                        onCheckedChange={toggleSelectAllTable}
                        aria-label="Select all leads"
                      />
                    </TableHead>
                    <TableHead className="w-[24%]">Company & Domain</TableHead>
                    <TableHead className="w-[28%]">Target Job Opening & Role</TableHead>
                    <TableHead className="w-[18%]">Location & Salary</TableHead>
                    <TableHead className="w-[22%]">Executive / Decision Maker</TableHead>
                    <TableHead className="w-[8%] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((lead) => {
                    const isSelected = !!selectedTableLeadIds[lead.id];
                    const dm = lead.decisionMaker;

                    return (
                      <TableRow
                        key={lead.id}
                        className={isSelected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-canvas/50"}
                      >
                        <TableCell className="text-center">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleTableLead(lead.id)}
                            aria-label={`Select lead for ${lead.companyName}`}
                          />
                        </TableCell>

                        {/* Company */}
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="size-3.5 text-indigo-500 shrink-0" />
                              <span className="font-bold text-xs text-foreground truncate max-w-[180px]">
                                {lead.companyName}
                              </span>
                            </div>
                            {lead.companyDomain ? (
                              <a
                                href={`https://${lead.companyDomain}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-text-dim hover:text-primary flex items-center gap-1 truncate max-w-[180px]"
                              >
                                <Globe className="size-3 shrink-0" />
                                <span>{lead.companyDomain}</span>
                              </a>
                            ) : (
                              <span className="text-[11px] text-text-muted italic">No domain available</span>
                            )}
                          </div>
                        </TableCell>

                        {/* Job Opening */}
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-start gap-1.5">
                              <span className="font-bold text-xs text-foreground line-clamp-1">
                                {lead.jobTitle}
                              </span>
                              {lead.jobUrl && (
                                <a
                                  href={lead.jobUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-primary hover:text-primary/80 shrink-0 mt-0.5"
                                  title="View job posting"
                                >
                                  <ExternalLink className="size-3" />
                                </a>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-canvas border border-border text-text-dim">
                                Source: {lead.source || "Web"}
                              </span>
                              {lead.discoveredAt && (
                                <span className="text-[10px] text-text-muted">
                                  {new Date(lead.discoveredAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Location & Salary */}
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-xs text-foreground">
                              <MapPin className="size-3 text-amber-500 shrink-0" />
                              <span className="truncate">{lead.companyLocation || "Global"}</span>
                            </div>
                            {lead.salary ? (
                              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                {lead.salary}
                              </span>
                            ) : (
                              <span className="text-[11px] text-text-muted italic">Competitive</span>
                            )}
                          </div>
                        </TableCell>

                        {/* Decision Maker */}
                        <TableCell>
                          {dm ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs text-foreground">{dm.name}</span>
                                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                                  Apollo
                                </span>
                              </div>
                              <p className="text-[11px] text-text-dim truncate max-w-[200px]">{dm.title}</p>
                              <div className="flex flex-col gap-1 pt-0.5">
                                {dm.email && (
                                  <button
                                    onClick={() => handleCopy(dm.email!, `${lead.id}-email`)}
                                    className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono hover:underline flex items-center gap-1 w-fit"
                                    title="Copy email"
                                  >
                                    <Mail className="size-3 shrink-0" />
                                    <span className="truncate max-w-[170px]">{dm.email}</span>
                                    {copiedId === `${lead.id}-email` ? (
                                      <Check className="size-3 text-emerald-500 shrink-0" />
                                    ) : (
                                      <Copy className="size-3 opacity-60 shrink-0" />
                                    )}
                                  </button>
                                )}
                                {dm.phone ? (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <button
                                      onClick={() => handleCopy(dm.phone!, `${lead.id}-phone`)}
                                      className="text-[11px] text-blue-600 dark:text-blue-400 font-mono hover:underline flex items-center gap-1"
                                      title="Copy official mobile number"
                                    >
                                      <Phone className="size-3 text-blue-500 shrink-0" />
                                      <span>{dm.phone}</span>
                                      {copiedId === `${lead.id}-phone` ? (
                                        <Check className="size-3 text-emerald-500 shrink-0" />
                                      ) : (
                                        <Copy className="size-3 opacity-60 shrink-0" />
                                      )}
                                    </button>
                                    <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                                      {dm.phoneType === "direct" ? "Direct" : dm.phoneType === "office" ? "Office" : "Mobile"}
                                    </span>
                                    <a
                                      href={`tel:${dm.phone.replace(/[^\d+]/g, "")}`}
                                      className="text-text-muted hover:text-primary transition-colors p-0.5"
                                      title="Call official number"
                                    >
                                      <PhoneCall className="size-3 shrink-0" />
                                    </a>
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-text-muted italic flex items-center gap-1">
                                    <Phone className="size-2.5 opacity-40 shrink-0" />
                                    <span>Phone unavailable</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openResolveAndSend(lead)}
                              className="h-7 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 px-2 rounded-lg gap-1"
                            >
                              <Sparkles className="size-3 text-amber-500" />
                              <span>Find Contact</span>
                            </Button>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedTableLeadIds({ [lead.id]: true });
                              setShowAutomateDialog(true);
                            }}
                            className="h-7 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg"
                          >
                            Outreach
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* Empty State when no results */}
      {results.length === 0 && !searchIntent.isPending && (
        <div className="rounded-3xl border border-dashed border-border/80 bg-card/50 p-12 text-center space-y-4">
          <div className="size-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            {searchInfo ? <SearchX className="size-7 text-amber-500" /> : <Search className="size-7" />}
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-base font-bold text-foreground">
              {searchInfo ? "Sorry, No Live Openings Found" : "No Live Intent Searches Yet"}
            </h3>
            <p className="text-xs text-text-dim leading-relaxed">
              {searchInfo ? (
                <>
                  No active job openings were found for <strong>"{searchInfo.role}"</strong> in{" "}
                  <strong>"{searchInfo.location || "Global"}"</strong>. Only verified, real postings are displayed. Try adjusting your role title or searching a broader location.
                </>
              ) : (
                <>
                  Enter a job role and location in the console above and click <strong>Scrape Leads</strong> to scan real-time vacancy boards and uncover verified hiring managers.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {/* ─── Auto-Enrich Modal Dialog ─── */}
      <Dialog open={showEnrichDialog} onOpenChange={setShowEnrichDialog}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Sparkles className="size-4 text-amber-500" />
              Collect Founders & HR Leads via Apollo
            </DialogTitle>
            <DialogDescription className="text-xs text-text-dim">
              Query Apollo's database for executive leadership (Founders, CEOs, Directors, HR Heads) of companies in this search.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="p-3 rounded-xl bg-canvas border border-border space-y-1 text-xs">
              <p className="font-bold text-foreground">Target Companies to Enrich:</p>
              <p className="text-text-dim">
                {enrichSpecificCompany ? enrichSpecificCompany : `${uniqueCompanies} unique hiring companies from current search`}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Optional: Auto-Enroll Into Sequence</Label>
              <Select value={selectedSequenceId} onValueChange={setSelectedSequenceId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="None (Save to Decision Makers only)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Save only)</SelectItem>
                  {sequences.map((seq) => (
                    <SelectItem key={seq.id} value={seq.id}>
                      {seq.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowEnrichDialog(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleEnrichAllWithApollo}
              disabled={enrichMutation.isPending}
              className="gap-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {enrichMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Enriching…
                </>
              ) : (
                <>
                  <Crown className="size-3.5 text-amber-300" />
                  Start Enrichment
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Single Lead Resolve Contact Dialog ─── */}
      <Dialog open={Boolean(resolvingLead)} onOpenChange={(open) => !open && setResolvingLead(undefined)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Sparkles className="size-4 text-amber-500" />
              Find Decision Maker at {resolvingLead?.companyName}
            </DialogTitle>
            <DialogDescription className="text-xs text-text-dim">
              Resolves verified founder or HR contact via Apollo and links it to this hiring lead.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Target Email Sequence</Label>
              <Select value={resolveSequenceId} onValueChange={setResolveSequenceId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select sequence…" />
                </SelectTrigger>
                <SelectContent>
                  {sequences.map((seq) => (
                    <SelectItem key={seq.id} value={seq.id}>
                      {seq.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setResolvingLead(undefined)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={confirmResolveAndSend}
              disabled={!resolveSequenceId || resolveAndSend.isPending}
              className="gap-1.5 text-xs font-bold bg-primary text-primary-foreground"
            >
              {resolveAndSend.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Resolving…
                </>
              ) : (
                "Find & Connect"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Automated Email Outreach Dialog ─── */}
      <IntentEmailAutomateDialog
        open={showAutomateDialog}
        onOpenChange={setShowAutomateDialog}
        leads={results}
        defaultSelectedLeadIds={
          selectedTableCount > 0
            ? Object.keys(selectedTableLeadIds).filter((id) => selectedTableLeadIds[id])
            : undefined
        }
        targetRole={searchInfo?.role || role}
        targetLocation={searchInfo?.location || location}
      />
    </div>
  );
}
