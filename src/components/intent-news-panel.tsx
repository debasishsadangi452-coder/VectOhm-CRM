import { useEffect, useMemo, useState } from "react";
import {
  Newspaper,
  Search,
  Loader2,
  MapPin,
  Mail,
  Sparkles,
  Crown,
  ExternalLink,
  Download,
  RotateCcw,
  Copy,
  Check,
  Phone,
  PhoneCall,
} from "lucide-react";
import { toast } from "sonner";
import { useApolloConnection } from "@/hooks/use-apollo";
import {
  useSearchIntentNews,
  useEnrichIntentCompanies,
  useResolveAndSendIntentLead,
} from "@/hooks/use-hiring-signals";
import { useSequences } from "@/hooks/use-sequences";
import { IntentEmailAutomateDialog } from "@/components/intent-email-automate-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { IntentHiringLead, NewsSignalCategory } from "@/lib/api/hiring-signals";

const CATEGORY_OPTIONS: Array<{ value: NewsSignalCategory | "ANY"; label: string }> = [
  { value: "ANY", label: "Any signal" },
  { value: "FUNDING", label: "Funding" },
  { value: "EXPANSION", label: "Expansion" },
  { value: "LEADERSHIP", label: "Leadership change" },
  { value: "PRODUCT", label: "Product launch" },
  { value: "PARTNERSHIP", label: "Partnership / M&A" },
];

const DAY_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "60", label: "Last 60 days" },
  { value: "90", label: "Last 90 days" },
];

const QUICK_PRESETS = [
  { keywords: "ERP", category: "ANY" as const, location: "United States" },
  { keywords: "AI", category: "ANY" as const, location: "United States" },
  { keywords: "SaaS", category: "FUNDING" as const, location: "United States" },
  { keywords: "fintech", category: "EXPANSION" as const, location: "India" },
  { keywords: "healthcare", category: "LEADERSHIP" as const, location: "United States" },
  { keywords: "e-commerce", category: "FUNDING" as const, location: "India" },
];

const STORAGE_KEY = "intent-news:last-search";

function csvCell(value: string | null | undefined) {
  return `"${(value ?? "").replace(/"/g, '""')}"`;
}

export function IntentNewsPanel() {
  const { data: connection } = useApolloConnection();
  const { data: sequences = [] } = useSequences();
  const search = useSearchIntentNews();
  const enrich = useEnrichIntentCompanies();
  const resolveAndSend = useResolveAndSendIntentLead();
  const apolloConnected = !!connection?.connected;

  // Always initialize with blank fields upon reload
  const [keywords, setKeywords] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState<NewsSignalCategory | "ANY">("ANY");
  const [daysBack, setDaysBack] = useState("30");
  const [results, setResults] = useState<IntentHiringLead[]>([]);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Clear any previously saved searches from localStorage so reload is always fresh and blank
  useEffect(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore in environments without localStorage
    }
  }, []);
  const [diag, setDiag] = useState<{ candidatesChecked: number; articlesFound: number } | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [showAutomate, setShowAutomate] = useState(false);
  const [showEnrich, setShowEnrich] = useState(false);
  const [enrichSequenceId, setEnrichSequenceId] = useState("none");
  const [enrichCompany, setEnrichCompany] = useState<string | null>(null);
  const [resolvingLead, setResolvingLead] = useState<IntentHiringLead | undefined>();
  const [resolveSequenceId, setResolveSequenceId] = useState("");

  const selectedCount = useMemo(() => Object.values(selected).filter(Boolean).length, [selected]);
  const allSelected = results.length > 0 && results.every((r) => selected[r.id]);
  const uniqueCompanies = useMemo(
    () => Array.from(new Set(results.map((r) => r.companyName))),
    [results],
  );
  const withContact = results.filter((r) => r.decisionMaker).length;

  async function runSearch(next?: { keywords: string; category: NewsSignalCategory | "ANY"; location: string }) {
    const k = (next?.keywords ?? keywords).trim();
    const loc = (next?.location ?? location).trim();
    const cat = next?.category ?? category;
    if (!k) {
      toast.error("Enter an industry or topic to watch.");
      return;
    }
    setHasSearched(true);
    try {
      const res = await search.mutateAsync({
        keywords: k,
        location: loc || undefined,
        category: cat === "ANY" ? undefined : cat,
        daysBack: Number(daysBack),
        maxResults: 50,
      });
      setDiag({ candidatesChecked: res.candidatesChecked, articlesFound: res.articlesFound });
      setResults(res.leads);
      setSelected({});
      const stamp = new Date().toISOString();
      setSavedAt(stamp);
      if (res.leads.length > 0) {
        toast.success(`Found ${res.leads.length} companies in the news.`);
      } else {
        toast.info(
          res.articlesFound === 0
            ? `Checked ${res.candidatesChecked} companies - Apollo has no news for them in this window.`
            : `Apollo returned ${res.articlesFound} articles but none matched that signal.`,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Intent News search failed.");
    }
  }

  function clearAll() {
    setKeywords("");
    setLocation("");
    setCategory("ANY");
    setDaysBack("30");
    setResults([]);
    setSelected({});
    setHasSearched(false);
    setSavedAt(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  function toggleAll() {
    if (allSelected) setSelected({});
    else setSelected(Object.fromEntries(results.map((r) => [r.id, true])));
  }

  function openEnrich(company: string | null) {
    setEnrichCompany(company);
    setEnrichSequenceId("none");
    setShowEnrich(true);
  }

  async function confirmEnrich() {
    try {
      const res = await enrich.mutateAsync({
        companyNames: enrichCompany ? [enrichCompany] : uniqueCompanies,
        autoEnrollSequenceId: enrichSequenceId !== "none" ? enrichSequenceId : undefined,
      });
      setShowEnrich(false);
      if (res.enrichedCount > 0) {
        toast.success(
          `Enriched ${res.enrichedCount} decision makers.${
            res.autoEnrolledCount > 0 ? ` Enrolled ${res.autoEnrolledCount} into the sequence.` : ""
          }`,
        );
      } else {
        toast.info("No new decision makers could be verified for these companies.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Apollo enrichment failed.");
    }
  }

  async function confirmResolve() {
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
      toast.success(`Found ${res.decisionMaker.name} at ${resolvingLead.companyName}.`);
      setResolvingLead(undefined);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't find a contact for this company.");
    }
  }

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  }

  function exportCsv() {
    if (results.length === 0) return;
    const headers = [
      "Company",
      "Signal",
      "Headline",
      "Article URL",
      "Published",
      "Decision Maker",
      "Title",
      "Email",
      "Phone",
      "Phone Type",
      "LinkedIn",
    ];
    const rows = results.map((l) =>
      [
        l.companyName,
        l.newsCategoryLabel,
        l.jobTitle,
        l.jobUrl,
        l.discoveredAt,
        l.decisionMaker?.name,
        l.decisionMaker?.title,
        l.decisionMaker?.email,
        l.decisionMaker?.phone,
        l.decisionMaker?.phoneType || (l.decisionMaker?.phone ? "mobile" : ""),
        l.decisionMaker?.linkedinUrl,
      ].map(csvCell),
    );
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `intent_news_${keywords.toLowerCase().replace(/\s+/g, "_") || "export"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("CSV export downloaded!");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-sm space-y-5">
        <div className="space-y-1.5 max-w-3xl">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Newspaper className="size-5 text-primary" /> Intent News Intelligence
          </h2>
          <p className="text-xs sm:text-sm text-text-dim leading-relaxed">
            Find companies making news in your target industry — funding rounds, expansion, leadership changes,
            launches and partnerships — straight from Apollo, then reach their founders and decision makers.
          </p>
          {!apolloConnected && (
            <p className="text-xs font-semibold text-amber-600">
              Apollo isn't connected. Connect it in Outreach settings to run news searches.
            </p>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch();
          }}
          className="grid grid-cols-1 md:grid-cols-12 gap-3.5"
        >
          <div className="md:col-span-4 space-y-1.5">
            <Label htmlFor="news-keywords" className="text-xs font-bold">Industry or topic *</Label>
            <div className="relative">
              <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <Input
                id="news-keywords"
                placeholder="e.g. ERP, AI, fintech, SaaS, manufacturing"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                className="pl-10 h-11 rounded-xl"
                required
              />
            </div>
            <p className="text-[10px] text-text-muted">
              Search industry or topic (e.g. &ldquo;ERP&rdquo;, &ldquo;AI&rdquo;). For job roles, use <strong>Intent Hiring</strong>.
            </p>
          </div>
          <div className="md:col-span-3 space-y-1.5">
            <Label htmlFor="news-location" className="text-xs font-bold">Location or country</Label>
            <div className="relative">
              <MapPin className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <Input
                id="news-location"
                placeholder="e.g. India, United States"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="pl-10 h-11 rounded-xl"
              />
            </div>
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-bold">Signal</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as NewsSignalCategory | "ANY")}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-bold">Published</Label>
            <Select value={daysBack} onValueChange={setDaysBack}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DAY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-1 flex items-end gap-2">
            <Button type="submit" disabled={search.isPending || !apolloConnected} className="flex-1 h-11 rounded-xl gap-2 font-bold">
              {search.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              <span className="sr-only md:not-sr-only">Search</span>
            </Button>
            {(keywords || location || results.length > 0) && (
              <Button type="button" variant="outline" onClick={clearAll} title="Clear search" className="h-11 px-3 rounded-xl">
                <RotateCcw className="size-4" />
              </Button>
            )}
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50">
          <span className="text-[11px] font-bold text-text-muted">Try:</span>
          {QUICK_PRESETS.map((p) => (
            <button
              key={`${p.keywords}-${p.category}-${p.location}`}
              type="button"
              onClick={() => {
                setKeywords(p.keywords);
                setCategory(p.category);
                setLocation(p.location);
                void runSearch(p);
              }}
              className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-canvas border border-border/70 hover:border-primary/40 hover:text-primary text-text-dim"
            >
              {p.keywords} · {CATEGORY_OPTIONS.find((o) => o.value === p.category)?.label} · {p.location}
            </button>
          ))}
        </div>
      </div>

      {search.isPending && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 flex items-center gap-3 text-sm">
          <Loader2 className="size-5 animate-spin text-primary" />
          <span className="font-semibold">Searching Apollo news and finding decision makers…</span>
        </div>
      )}

      {results.length > 0 && (
        <div className="rounded-2xl border border-border/80 bg-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border/60">
            <div className="text-sm">
              <span className="font-bold">{results.length}</span> companies ·{" "}
              <span className="font-bold">{withContact}</span> with a decision maker
              {savedAt && (
                <span className="text-text-muted"> · searched {new Date(savedAt).toLocaleString()}</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5 text-xs">
                <Download className="size-3.5" /> Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => openEnrich(null)} className="gap-1.5 text-xs">
                <Crown className="size-3.5 text-amber-500" /> Enrich all
              </Button>
              <Button
                size="sm"
                onClick={() => setShowAutomate(true)}
                disabled={selectedCount === 0}
                className="gap-1.5 text-xs"
              >
                <Mail className="size-3.5" /> Email selected ({selectedCount})
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                  </TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead className="w-[34%]">News signal</TableHead>
                  <TableHead>Decision maker</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((lead) => {
                  const dm = lead.decisionMaker;
                  return (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <Checkbox
                          checked={!!selected[lead.id]}
                          onCheckedChange={() => setSelected((p) => ({ ...p, [lead.id]: !p[lead.id] }))}
                          aria-label={`Select ${lead.companyName}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-sm">{lead.companyName}</div>
                        {lead.companyDomain && (
                          <div className="text-[11px] text-text-dim">{lead.companyDomain}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="inline-block text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/25 mb-1">
                          {lead.newsCategoryLabel}
                        </span>
                        <div className="flex items-start gap-1.5 text-sm font-medium leading-snug">
                          <span>{lead.jobTitle}</span>
                          {lead.jobUrl && (
                            <a href={lead.jobUrl} target="_blank" rel="noreferrer" title="Read article" className="text-primary shrink-0 mt-0.5">
                              <ExternalLink className="size-3.5" />
                            </a>
                          )}
                        </div>
                        <div className="text-[11px] text-text-muted mt-0.5">
                          {new Date(lead.discoveredAt).toLocaleDateString()}
                        </div>
                        {(lead.newsArticles?.length ?? 0) > 0 && (
                          <div className="mt-1.5">
                            <button
                              type="button"
                              onClick={() => setExpanded((p) => ({ ...p, [lead.id]: !p[lead.id] }))}
                              className="text-[11px] font-semibold text-primary hover:underline"
                            >
                              {expanded[lead.id] ? "Hide" : "Show"} {lead.newsArticles!.length} more{" "}
                              {lead.newsArticles!.length === 1 ? "article" : "articles"}
                            </button>
                            {expanded[lead.id] && (
                              <ul className="mt-1.5 space-y-1.5 border-l-2 border-border/70 pl-2.5">
                                {lead.newsArticles!.map((a, i) => (
                                  <li key={`${lead.id}-${i}`} className="text-[11px] leading-snug">
                                    <span className="font-bold text-text-dim">{a.categoryLabel}</span>
                                    {" · "}
                                    {a.url ? (
                                      <a href={a.url} target="_blank" rel="noreferrer" className="text-foreground hover:text-primary hover:underline">
                                        {a.title}
                                      </a>
                                    ) : (
                                      a.title
                                    )}
                                    {a.publishedAt && (
                                      <span className="text-text-muted"> · {new Date(a.publishedAt).toLocaleDateString()}</span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {dm ? (
                          <div className="space-y-0.5">
                            <div className="font-bold text-xs">{dm.name}</div>
                            <p className="text-[11px] text-text-dim truncate max-w-[200px]">{dm.title}</p>
                            <div className="flex flex-col gap-1 pt-0.5">
                              {dm.email && (
                                <button
                                  type="button"
                                  onClick={() => copy(dm.email!, `${lead.id}-email`)}
                                  className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono hover:underline flex items-center gap-1 w-fit"
                                  title="Copy email"
                                >
                                  <Mail className="size-3 shrink-0" />
                                  <span className="truncate max-w-[170px]">{dm.email}</span>
                                  {copiedId === `${lead.id}-email` ? <Check className="size-3 text-emerald-500 shrink-0" /> : <Copy className="size-3 opacity-60 shrink-0" />}
                                </button>
                              )}
                              {dm.phone ? (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => copy(dm.phone!, `${lead.id}-phone`)}
                                    className="text-[11px] text-blue-600 dark:text-blue-400 font-mono hover:underline flex items-center gap-1"
                                    title="Copy official mobile number"
                                  >
                                    <Phone className="size-3 text-blue-500 shrink-0" />
                                    <span>{dm.phone}</span>
                                    {copiedId === `${lead.id}-phone` ? <Check className="size-3 text-emerald-500 shrink-0" /> : <Copy className="size-3 opacity-60 shrink-0" />}
                                  </button>
                                  <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                                    {dm.phoneType === "direct" ? "Direct" : dm.phoneType === "office" ? "Office" : "Mobile"}
                                  </span>
                                  <a
                                    href={`tel:${dm.phone.replace(/[^\d+]/g, "")}`}
                                    className="text-text-muted hover:text-primary transition-colors p-0.5"
                                    title="Call number"
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
                            onClick={() => {
                              setResolveSequenceId("");
                              setResolvingLead(lead);
                            }}
                            className="h-7 text-[11px] font-bold text-indigo-600 px-2 gap-1"
                          >
                            <Sparkles className="size-3 text-amber-500" /> Find contact
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEnrich(lead.companyName)}
                          className="h-7 text-xs font-bold"
                        >
                          Enrich
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelected({ [lead.id]: true });
                            setShowAutomate(true);
                          }}
                          className="h-7 text-xs font-bold text-primary"
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
      )}

      {hasSearched && results.length === 0 && !search.isPending && (
        <div className="rounded-3xl border border-dashed border-border/80 bg-card/50 p-10 text-center text-sm text-text-dim space-y-3">
          <p className="font-semibold text-foreground">No companies with matching news.</p>
          {diag && (
            <span className="block text-xs max-w-lg mx-auto">
              Checked {diag.candidatesChecked} companies, found {diag.articlesFound} articles.
              {diag.articlesFound === 0
                ? ' Try a broader industry topic (e.g. "ERP", "AI", "software"), a longer date range, or remove the location filter.'
                : ' Articles were found, but none matched this specific signal. Try "Any signal" to see all of them.'}
            </span>
          )}
          <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
            {diag && diag.articlesFound > 0 && category !== "ANY" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCategory("ANY");
                  void runSearch({ keywords, location, category: "ANY" });
                }}
                className="h-8 text-xs font-bold"
              >
                View all {diag.articlesFound} articles (Any signal)
              </Button>
            )}
            {keywords.toLowerCase().includes("project manager") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const cleaned = keywords.replace(/project\s+manager/gi, "").trim();
                  setKeywords(cleaned);
                  void runSearch({ keywords: cleaned, location, category });
                }}
                className="h-8 text-xs font-bold"
              >
                Search for &ldquo;{keywords.replace(/project\s+manager/gi, "").trim()}&rdquo; instead
              </Button>
            )}
            {location && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLocation("");
                  void runSearch({ keywords, location: "", category });
                }}
                className="h-8 text-xs text-primary"
              >
                Remove location filter
              </Button>
            )}
          </div>
        </div>
      )}

      <IntentEmailAutomateDialog
        open={showAutomate}
        onOpenChange={setShowAutomate}
        leads={results}
        defaultSelectedLeadIds={Object.keys(selected).filter((id) => selected[id])}
      />

      <Dialog open={showEnrich} onOpenChange={setShowEnrich}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Crown className="size-4 text-amber-500" /> Collect founders & HR leads via Apollo
            </DialogTitle>
            <DialogDescription className="text-xs">
              {enrichCompany ?? `${uniqueCompanies.length} companies from this search`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Optional: auto-enroll into a sequence</Label>
            <Select value={enrichSequenceId} onValueChange={setEnrichSequenceId}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (save only)</SelectItem>
                {sequences.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowEnrich(false)}>Cancel</Button>
            <Button size="sm" onClick={confirmEnrich} disabled={enrich.isPending} className="gap-1.5">
              {enrich.isPending && <Loader2 className="size-3.5 animate-spin" />} Start enrichment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(resolvingLead)} onOpenChange={(o) => !o && setResolvingLead(undefined)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Find contact at {resolvingLead?.companyName}</DialogTitle>
            <DialogDescription className="text-xs">
              Looks up a founder or HR decision maker in Apollo and enrolls them in the sequence you pick.
            </DialogDescription>
          </DialogHeader>
          <Select value={resolveSequenceId} onValueChange={setResolveSequenceId}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Choose a sequence" /></SelectTrigger>
            <SelectContent>
              {sequences.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setResolvingLead(undefined)}>Cancel</Button>
            <Button size="sm" onClick={confirmResolve} disabled={!resolveSequenceId || resolveAndSend.isPending} className="gap-1.5">
              {resolveAndSend.isPending && <Loader2 className="size-3.5 animate-spin" />} Find & enroll
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
