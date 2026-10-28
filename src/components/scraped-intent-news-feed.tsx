import { useState } from "react";
import {
  Sparkles,
  Search,
  ExternalLink,
  Mail,
  Linkedin,
  Phone,
  Copy,
  Check,
  Trash2,
  Filter,
  Flame,
  CheckCircle2,
  Clock,
  Layers,
  Bot,
  Building2,
  UserCheck,
  ShieldAlert,
  RotateCcw,
  Radar,
} from "lucide-react";
import { toast } from "sonner";
import {
  useScrapedIntentArticles,
  useScrapedSummaryStats,
  useUpdateScrapedStatus,
  useDeleteScrapedArticle,
} from "@/hooks/use-intent-news-scraper";
import { startIntentCrawl, type ScrapedIntentArticle } from "@/lib/api/intent-news-scraper";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const SIGNAL_LABELS: Record<string, string> = {
  ERP_AI: "ERP / AI",
  FUNDING: "Funding",
  EXPANSION: "Expansion",
  HIRING: "Hiring surge",
};

export function ScrapedIntentNewsFeed() {
  const canCrawl = useAuthStore((s) => s.user?.role.name === "ADMIN" || s.user?.role.name === "MANAGER");
  const [isCrawling, setIsCrawling] = useState(false);
  const handleCrawlNow = async () => {
    setIsCrawling(true);
    try {
      await startIntentCrawl();
      toast.success("Crawl started. New intent articles will show up here over the next few minutes.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start the crawl");
    } finally {
      setIsCrawling(false);
    }
  };
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedArticle, setSelectedArticle] = useState<ScrapedIntentArticle | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: statsData, refetch: refetchStats } = useScrapedSummaryStats();
  const { data, isLoading, isFetching, refetch } = useScrapedIntentArticles({
    isErpAiPriority: tierFilter === "ERP_AI_VIP" ? true : undefined,
    tier: tierFilter !== "ALL" && tierFilter !== "ERP_AI_VIP" ? tierFilter : undefined,
    status: statusFilter !== "ALL" ? statusFilter : undefined,
    search: search.trim() || undefined,
  });

  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const handleManualRefresh = async () => {
    setIsManualRefreshing(true);
    try {
      await Promise.all([refetch(), refetchStats()]);
      toast.success("Feed updated with latest live articles!");
    } finally {
      setTimeout(() => setIsManualRefreshing(false), 500);
    }
  };

  const updateStatus = useUpdateScrapedStatus();
  const deleteArticle = useDeleteScrapedArticle();

  const articles = data?.articles || [];

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Copied to clipboard!");
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateStatus.mutateAsync({ id, status: newStatus });
      toast.success(`Updated status to ${newStatus}`);
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this scraped article?")) return;
    try {
      await deleteArticle.mutateAsync(id);
      toast.success("Scraped article removed");
    } catch {
      toast.error("Failed to remove article");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Hero Banner & KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: VIP ERP AI */}
        <button
          type="button"
          onClick={() => {
            setTierFilter("ERP_AI_VIP");
            setStatusFilter("ALL");
            setSearch("");
          }}
          className={`relative overflow-hidden text-left rounded-2xl border transition-all p-5 shadow-sm hover:scale-[1.01] active:scale-[0.99] cursor-pointer ${
            tierFilter === "ERP_AI_VIP"
              ? "border-amber-500 bg-amber-500/15 ring-2 ring-amber-500/30"
              : "border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent hover:border-amber-500/70"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
              <Sparkles className="size-4" /> Top Priority
            </span>
            <span className="flex size-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-500">
              <Flame className="size-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-foreground">
              {statsData?.erpAiCount ?? 0}
            </div>
            <p className="mt-1 text-xs text-text-dim">
              VIP ERP AI Signals (SAP, Oracle, D365) • Click to filter
            </p>
          </div>
        </button>

        {/* KPI 2: Total Scraped Articles */}
        <button
          type="button"
          onClick={() => {
            setTierFilter("ALL");
            setStatusFilter("ALL");
            setSearch("");
          }}
          className={`relative overflow-hidden text-left rounded-2xl border transition-all p-5 shadow-sm hover:scale-[1.01] active:scale-[0.99] cursor-pointer ${
            tierFilter === "ALL" && statusFilter === "ALL" && !search
              ? "border-primary bg-primary/10 ring-2 ring-primary/30"
              : "border-border/70 bg-card hover:border-primary/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-text-dim flex items-center gap-1.5">
              <Layers className="size-4 text-primary" /> Total Scraped
            </span>
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="size-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-foreground">
              {statsData?.total ?? 0}
            </div>
            <p className="mt-1 text-xs text-text-dim">
              Total intent news captured • Click to show all
            </p>
          </div>
        </button>

        {/* KPI 3: Enriched Decision Makers */}
        <button
          type="button"
          onClick={() => {
            setTierFilter("ALL");
            setStatusFilter("ENRICHED");
            setSearch("");
          }}
          className={`relative overflow-hidden text-left rounded-2xl border transition-all p-5 shadow-sm hover:scale-[1.01] active:scale-[0.99] cursor-pointer ${
            statusFilter === "ENRICHED"
              ? "border-emerald-500 bg-emerald-500/15 ring-2 ring-emerald-500/30"
              : "border-border/70 bg-card hover:border-emerald-500/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
              <UserCheck className="size-4" /> Apollo Enriched
            </span>
            <span className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="size-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-foreground">
              {statsData?.enrichedCount ?? 0}
            </div>
            <p className="mt-1 text-xs text-text-dim">
              Decision makers (CIO / VP) auto-matched • Click to view
            </p>
          </div>
        </button>

        {/* KPI 4: Extension Listener */}
        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              <Bot className="size-4" /> Browser Copilot
            </span>
            <span className="relative flex size-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex size-3 rounded-full bg-emerald-500"></span>
            </span>
          </div>
          <div className="mt-3">
            <div className="text-base font-bold text-foreground flex items-center gap-2">
              Extension Active
              <span className="inline-flex items-center text-[10px] font-extrabold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                LIVE (3s)
              </span>
            </div>
            <p className="mt-1 text-xs text-text-dim">
              1-click scraping auto-syncs to this feed
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border/70">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-dim" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search company, ERP vendor, or headline..."
              className="pl-9 h-9 text-xs bg-background"
            />
          </div>
          <div className="flex items-center gap-2">
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-[195px] h-9 text-xs">
                <Filter className="size-3.5 mr-1 text-text-dim" />
                <SelectValue placeholder="Filter by Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Tiers ({statsData?.total ?? 0})</SelectItem>
                <SelectItem value="ERP_AI_VIP">⭐ ERP AI VIP ({statsData?.erpAiCount ?? 0})</SelectItem>
                <SelectItem value="ENTERPRISE_HIGH">Enterprise High</SelectItem>
                <SelectItem value="STANDARD_GROWTH">Standard Growth ({statsData?.standardCount ?? 0})</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[155px] h-9 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses ({statsData?.total ?? 0})</SelectItem>
                <SelectItem value="NEW">New</SelectItem>
                <SelectItem value="ENRICHED">Enriched ({statsData?.enrichedCount ?? 0})</SelectItem>
                <SelectItem value="CONTACTED">Contacted</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isFetching || isManualRefreshing}
              className="h-9 px-3 gap-1.5 text-xs font-bold"
              title="Click to sync live data immediately"
            >
              <RotateCcw className={`size-3.5 ${isFetching || isManualRefreshing ? "animate-spin text-primary" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            {canCrawl && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCrawlNow}
                disabled={isCrawling}
                className="h-9 px-3 gap-1.5 text-xs font-bold"
                title="Search news sites for new intent signals now (runs automatically every 3 hours)"
              >
                <Radar className={`size-3.5 ${isCrawling ? "animate-pulse text-primary" : ""}`} />
                <span className="hidden sm:inline">Crawl now</span>
              </Button>
            )}
          </div>
        </div>

        {/* Active Filter Pill Bar */}
        {(tierFilter !== "ALL" || statusFilter !== "ALL" || search.trim()) && (
          <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-text-dim">
            <span>Filtered by:</span>
            {tierFilter !== "ALL" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2.5 py-0.5 text-[11px] font-semibold">
                Tier: {tierFilter === "ERP_AI_VIP" ? "ERP AI VIP" : tierFilter}
                <button
                  type="button"
                  onClick={() => setTierFilter("ALL")}
                  className="hover:text-foreground font-bold ml-1"
                >
                  ×
                </button>
              </span>
            )}
            {statusFilter !== "ALL" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 text-[11px] font-semibold">
                Status: {statusFilter}
                <button
                  type="button"
                  onClick={() => setStatusFilter("ALL")}
                  className="hover:text-foreground font-bold ml-1"
                >
                  ×
                </button>
              </span>
            )}
            {search.trim() && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted text-foreground border border-border px-2.5 py-0.5 text-[11px] font-semibold">
                "{search}"
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="hover:text-foreground font-bold ml-1"
                >
                  ×
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setTierFilter("ALL");
                setStatusFilter("ALL");
                setSearch("");
              }}
              className="text-primary hover:underline font-semibold text-[11px] ml-auto cursor-pointer"
            >
              Reset All Filters (Show All {statsData?.total ?? 0})
            </button>
          </div>
        )}
      </div>

      {/* Feed List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 bg-card rounded-2xl border border-border/70">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-3 text-xs text-text-dim">Loading scraped intent feed...</p>
        </div>
      ) : articles.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 text-center bg-card rounded-2xl border border-border/70">
          <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
            <Sparkles className="size-6" />
          </div>
          <h3 className="text-base font-bold text-foreground">
            {statsData && statsData.total > 0
              ? "No Articles Match Your Active Filter"
              : "No Scraped Intent Articles Found"}
          </h3>
          <p className="mt-1 text-xs text-text-dim max-w-md">
            {statsData && statsData.total > 0
              ? `You have ${statsData.total} scraped article(s) captured, but none match the current filter (Tier: "${tierFilter}", Status: "${statusFilter}"). Click the button below to view all captured news.`
              : "Use the Venus CRM Chrome Extension while browsing TechCrunch, PR Newswire, Bloomberg, or company blogs. 1-click ingest ERP AI signals and they will appear here live!"}
          </p>
          {statsData && statsData.total > 0 && (
            <Button
              variant="default"
              size="sm"
              className="mt-4 gap-1.5 font-bold"
              onClick={() => {
                setTierFilter("ALL");
                setStatusFilter("ALL");
                setSearch("");
              }}
            >
              <RotateCcw className="size-3.5" />
              Reset Filters & Show All {statsData.total} Articles
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {articles.map((article) => {
            const isVip = article.isErpAiPriority || article.tier === "ERP_AI_VIP";
            const dm = article.decisionMaker;

            return (
              <div
                key={article.id}
                className={`relative overflow-hidden rounded-2xl border transition-all hover:shadow-md ${
                  isVip
                    ? "border-amber-500/40 bg-gradient-to-r from-amber-500/[0.04] via-card to-card shadow-sm"
                    : "border-border/70 bg-card"
                }`}
              >
                {/* VIP Strip Accent */}
                {isVip && (
                  <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600" />
                )}

                <div className="p-5 flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                  {/* Left Column: Article & Company Details */}
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {isVip ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-amber-500 border border-amber-500/30">
                          <Flame className="size-3" /> ERP AI VIP
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                          Intent Signal
                        </span>
                      )}

                      {article.signalType && SIGNAL_LABELS[article.signalType] && (
                        <span className="inline-flex items-center rounded-md bg-sky-500/10 px-2 py-0.5 text-[11px] font-bold text-sky-600 dark:text-sky-400">
                          {SIGNAL_LABELS[article.signalType]}
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-500">
                        Score: {article.intentScore}/100
                      </span>

                      <span className="text-xs text-text-dim">
                        Source: <strong>{article.domain}</strong>
                      </span>

                      {article.publishedAt && (
                        <span className="text-[11px] text-text-dim flex items-center gap-1">
                          <Clock className="size-3" />
                          {new Date(article.publishedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="text-base font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1.5">
                        <a href={article.url} target="_blank" rel="noopener noreferrer">
                          {article.title}
                        </a>
                        <ExternalLink className="size-3.5 text-text-dim" />
                      </h4>
                      {article.companyName ? (
                        <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-text-dim">
                          <Building2 className="size-3.5 text-primary" />
                          <span>{article.companyName}</span>
                          {article.companyDomain && (
                            <span className="text-text-dim font-normal">({article.companyDomain})</span>
                          )}
                        </div>
                      ) : (
                        <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-text-dim">
                          <Building2 className="size-3.5 text-text-dim" />
                          <span className="text-text-dim italic">Source: {article.domain}</span>
                        </div>
                      )}
                    </div>

                    {article.keySnippet && (
                      <p className="text-xs text-text-dim leading-relaxed bg-background/50 p-2.5 rounded-lg border border-border/40">
                        "{article.keySnippet}"
                      </p>
                    )}

                    {/* ERP & AI Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {article.erpVendors?.map((erp) => (
                        <span
                          key={erp}
                          className="rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 px-2 py-0.5 text-[11px] font-bold"
                        >
                          ⚡ {erp}
                        </span>
                      ))}

                      {article.aiKeywords?.map((ai) => (
                        <span
                          key={ai}
                          className="rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 px-2 py-0.5 text-[11px] font-bold"
                        >
                          ✨ {ai}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Decision Maker & AI Outreach */}
                  <div className="w-full lg:w-80 flex flex-col gap-3 p-4 rounded-xl bg-background/80 border border-border/60">
                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-text-dim flex items-center gap-1">
                        <UserCheck className="size-3.5 text-primary" /> Decision Maker
                      </span>
                      <Select
                        value={article.status}
                        onValueChange={(val) => handleStatusChange(article.id, val)}
                      >
                        <SelectTrigger className="h-6 text-[10px] px-2 w-[95px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NEW">New</SelectItem>
                          <SelectItem value="ENRICHED">Enriched</SelectItem>
                          <SelectItem value="CONTACTED">Contacted</SelectItem>
                          <SelectItem value="ARCHIVED">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {dm ? (
                      <div className="space-y-2">
                        <div>
                          <div className="text-xs font-bold text-foreground">{dm.name}</div>
                          <div className="text-[11px] font-medium text-primary">{dm.title}</div>
                        </div>

                        <div className="flex flex-col gap-1 text-[11px]">
                          {dm.email && (
                            <div className="flex items-center justify-between text-text-dim">
                              <span className="flex items-center gap-1">
                                <Mail className="size-3 text-emerald-500" /> {dm.email}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-5"
                                onClick={() => handleCopy(dm.email!, `email-${article.id}`)}
                              >
                                {copiedId === `email-${article.id}` ? (
                                  <Check className="size-3 text-emerald-500" />
                                ) : (
                                  <Copy className="size-3" />
                                )}
                              </Button>
                            </div>
                          )}

                          {dm.corporatePhone && (
                            <div className="flex items-center gap-1 text-text-dim">
                              <Phone className="size-3 text-indigo-400" /> {dm.corporatePhone}
                            </div>
                          )}

                          {dm.linkedinUrl && (
                            <a
                              href={dm.linkedinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-500 hover:underline pt-1"
                            >
                              <Linkedin className="size-3" /> View LinkedIn Profile
                            </a>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="py-2 text-center text-xs text-text-dim">
                        <p className="font-semibold text-foreground/80">Searching Apollo...</p>
                        <p className="text-[11px] mt-0.5">Matching CIO / VP Enterprise Applications</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="pt-2 flex items-center gap-2">
                      {article.aiDraftedEmail && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-8 text-xs font-bold"
                          onClick={() => setSelectedArticle(article)}
                        >
                          <Bot className="size-3.5 mr-1 text-primary" /> View Outreach Pitch
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-text-dim hover:text-rose-500"
                        title="Delete article"
                        onClick={() => handleDelete(article.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Outreach Pitch Dialog */}
      <Dialog open={!!selectedArticle} onOpenChange={(open) => !open && setSelectedArticle(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-amber-500" />
              Tailored ERP AI Outreach Pitch
            </DialogTitle>
            <DialogDescription>
              Personalized cold outreach drafted automatically for{" "}
              <strong>{selectedArticle?.companyName || "the enterprise"}</strong>'s modernization milestone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="rounded-xl bg-card border border-border p-4 text-xs font-mono whitespace-pre-wrap leading-relaxed text-foreground select-all">
              {selectedArticle?.aiDraftedEmail}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedArticle(null)}
              >
                Close
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  if (selectedArticle?.aiDraftedEmail) {
                    navigator.clipboard.writeText(selectedArticle.aiDraftedEmail);
                    toast.success("Outreach pitch copied to clipboard!");
                  }
                }}
              >
                <Copy className="size-3.5" /> Copy Pitch
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
