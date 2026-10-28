import { useState } from "react";
import { ExternalLink, Loader2, RefreshCw, Search, Radar, Clock, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useCrawledArticles, useRunCrawl } from "@/hooks/use-intent-crawler";
import type { CrawledArticle } from "@/lib/api/intent-crawler";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PAGE = 50;
const DAY_MS = 86_400_000;

function ago(iso: string | null): string {
  if (!iso) return "date unknown";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 3_600_000) return `${Math.max(1, Math.round(ms / 60_000))} min ago`;
  if (ms < DAY_MS) return `${Math.round(ms / 3_600_000)} h ago`;
  if (ms < 30 * DAY_MS) return `${Math.round(ms / DAY_MS)} d ago`;
  return new Date(iso).toLocaleDateString();
}

function ArticleRow({ a }: { a: CrawledArticle }) {
  const isNew = Date.now() - new Date(a.createdAt).getTime() < DAY_MS;
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          {isNew && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-500">NEW</span>}
          <a href={a.url} target="_blank" rel="noreferrer" className="text-sm font-semibold hover:underline">
            {a.title}
          </a>
        </div>
        {a.keySnippet && <p className="line-clamp-2 text-xs text-text-dim">{a.keySnippet}</p>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-dim">
          <span>{a.domain}</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" /> {ago(a.publishedAt ?? a.createdAt)}
          </span>
          {a.companyName && (
            <span className="inline-flex items-center gap-1">
              <Building2 className="size-3" /> {a.companyName}
            </span>
          )}
          {a.erpVendors.slice(0, 3).map((v) => (
            <span key={v} className="rounded border border-border/70 px-1.5 py-0.5">
              {v}
            </span>
          ))}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="rounded-full border border-border/70 px-2 py-0.5 text-xs font-bold">{a.intentScore}</span>
        <a href={a.url} target="_blank" rel="noreferrer" aria-label="Open article" className="text-text-dim hover:text-foreground">
          <ExternalLink className="size-3.5" />
        </a>
      </div>
    </li>
  );
}

/** Everything the server-side crawler has collected from open sources, newest first. Refreshes itself. */
export function IntentCrawlerFeed() {
  const [search, setSearch] = useState("");
  const [days, setDays] = useState("30");
  const [source, setSource] = useState("ALL");
  const [page, setPage] = useState(0);

  const { data, isLoading, isFetching, refetch } = useCrawledArticles({
    days: days === "ALL" ? undefined : Number(days),
    source: source === "ALL" ? undefined : source,
    search: search.trim() || undefined,
    take: PAGE,
    skip: page * PAGE,
  });
  const run = useRunCrawl();

  async function crawlNow() {
    try {
      const r = await run.mutateAsync();
      if (r.skipped) toast.info(r.reason ?? "A crawl is already running.");
      else toast.success(`Crawl finished: ${r.results?.reduce((n, x) => n + x.ingested, 0) ?? 0} articles saved or updated.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start the crawl.");
    }
  }

  const last = data?.crawl.lastRun;
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Radar className="size-5" /> Market Radar
          </h2>
          <p className="text-xs text-text-dim">
            ERP buying signals gathered automatically from Google News, Bing News, Hacker News and Stack Exchange. Updates every 6 hours.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" className="gap-1.5" onClick={crawlNow} disabled={run.isPending || data?.crawl.running}>
            {run.isPending || data?.crawl.running ? <Loader2 className="size-3.5 animate-spin" /> : <Radar className="size-3.5" />}
            {data?.crawl.running ? "Crawling…" : "Crawl now"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border/70 bg-card p-3">
          <div className="text-xl font-bold">{data?.stats.all ?? "–"}</div>
          <div className="text-xs text-text-dim">Saved in total</div>
        </div>
        <div className="rounded-xl border border-border/70 bg-card p-3">
          <div className="text-xl font-bold text-emerald-500">{data?.stats.newToday ?? "–"}</div>
          <div className="text-xs text-text-dim">Found in the last 24 hours</div>
        </div>
        <div className="col-span-2 rounded-xl border border-border/70 bg-card p-3 sm:col-span-1">
          <div className="text-sm font-bold">{last ? ago(last.at) : "Not run since restart"}</div>
          <div className="text-xs text-text-dim">Last crawl</div>
        </div>
      </div>

      {last && last.results.some((r) => r.error) && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
          Some sources failed in the last crawl: {last.results.filter((r) => r.error).map((r) => `${r.label} (${r.error})`).join("; ")}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-text-dim" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search title, company or text"
            className="h-9 pl-8 text-xs"
          />
        </div>
        <Select
          value={days}
          onValueChange={(v) => {
            setDays(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="h-9 w-[150px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last 24 hours</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="ALL">All time</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={source}
          onValueChange={(v) => {
            setSource(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="h-9 w-[200px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All sources</SelectItem>
            {(data?.sources ?? []).map((s) => (
              <SelectItem key={s.domain} value={s.domain}>
                {s.domain} ({s.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
        {isLoading ? (
          <div className="grid place-items-center py-12 text-text-dim">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : data && data.articles.length === 0 ? (
          <p className="py-10 text-center text-sm text-text-dim">
            {data.stats.all === 0 ? "Nothing crawled yet. Press “Crawl now” to fetch the first batch." : "No articles match these filters."}
          </p>
        ) : (
          <ul className="divide-y divide-border/70">{data?.articles.map((a) => <ArticleRow key={a.id} a={a} />)}</ul>
        )}
      </div>

      {total > PAGE && (
        <div className="flex items-center justify-between text-xs text-text-dim">
          <span>
            {page * PAGE + 1}–{Math.min((page + 1) * PAGE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={(page + 1) * PAGE >= total} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
