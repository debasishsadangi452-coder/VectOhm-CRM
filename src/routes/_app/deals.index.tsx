import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, KanbanSquare, Loader2, Paperclip, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useDeals } from "@/hooks/use-deals";
import { getInitials } from "@/lib/utils";
import { useDepartmentGuard } from "@/hooks/use-department-guard";
import { TablePagination } from "@/components/table-pagination";
import { usePagination } from "@/hooks/use-pagination";
import { DEAL_STAGES, DEAL_STAGE_LABELS, type Deal, type DealStage } from "@/lib/api/types";

// stage comes in from the pipeline column headers (/deals?stage=QUALIFIED).
// Invalid values fall back to "all" rather than erroring -- this is a filter,
// not an identifier.
interface DealsSearch {
  stage?: DealStage;
}

export const Route = createFileRoute("/_app/deals/")({
  validateSearch: (search: Record<string, unknown>): DealsSearch => {
    const stage = search.stage;
    return typeof stage === "string" && (DEAL_STAGES as string[]).includes(stage)
      ? { stage: stage as DealStage }
      : {};
  },
  component: DealsListPage,
});

const STAGE_TONE: Record<DealStage, string> = {
  NEW_LEAD: "bg-panel-elevated text-text-dim border-border-subtle",
  QUALIFIED: "bg-info/15 text-info border-info/20",
  MEETING_SCHEDULED: "bg-violet/15 text-violet border-violet/20",
  PROPOSAL_SENT: "bg-primary/15 text-primary border-primary/20",
  NEGOTIATION: "bg-warning/15 text-warning border-warning/20",
  WON: "bg-success/15 text-success border-success/20",
  LOST: "bg-destructive/15 text-destructive border-destructive/20",
  ARCHIVED: "bg-panel-elevated text-text-dim border-border-subtle",
};

function DealsListPage() {
  useDepartmentGuard("Sales");
  const navigate = useNavigate();
  const { stage: stageFilter } = useSearch({ from: "/_app/deals/" });
  const { data: deals, isLoading } = useDeals();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (deals ?? [])
      .filter((d) => (stageFilter ? d.stage === stageFilter : true))
      .filter((d) =>
        term
          ? d.title.toLowerCase().includes(term) ||
            (d.company?.name ?? "").toLowerCase().includes(term) ||
            `${d.owner.firstName} ${d.owner.lastName}`.toLowerCase().includes(term)
          : true,
      );
  }, [deals, stageFilter, query]);

  const totalValue = filtered.reduce((sum, d) => sum + d.value, 0);
  const pager = usePagination(filtered);

  // Counts come from the unfiltered set so the chips still show what's behind
  // each stage while one of them is selected.
  const countByStage = useMemo(() => {
    const counts = {} as Record<DealStage, number>;
    for (const s of DEAL_STAGES) counts[s] = 0;
    for (const d of deals ?? []) counts[d.stage] += 1;
    return counts;
  }, [deals]);

  function setStage(next: DealStage | undefined) {
    navigate({ to: "/deals", search: next ? { stage: next } : {} });
  }

  const headerCell =
    "border-b border-r border-border-subtle px-3 py-2 font-medium whitespace-nowrap";
  const bodyCell = "border-b border-r border-border-subtle px-3 py-2";

  return (
    <div className="mx-auto max-w-[1800px] space-y-4 p-6">
      <Link
        to="/crm"
        className="inline-flex items-center gap-1.5 text-xs text-text-dim transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to pipeline
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">All leads</h1>
          <p className="mt-1 text-sm text-text-dim">
            {filtered.length} {filtered.length === 1 ? "deal" : "deals"} · $
            {totalValue.toLocaleString()} total value
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/crm">
            <KanbanSquare className="size-4" />
            Board view
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setStage(undefined)}
          className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
            !stageFilter
              ? "border-primary/20 bg-primary/15 text-primary"
              : "border-border-subtle bg-canvas/50 text-text-dim hover:text-foreground"
          }`}
        >
          All ({deals?.length ?? 0})
        </button>
        {DEAL_STAGES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStage(s)}
            className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
              stageFilter === s
                ? "border-primary/20 bg-primary/15 text-primary"
                : "border-border-subtle bg-canvas/50 text-text-dim hover:text-foreground"
            }`}
          >
            {DEAL_STAGE_LABELS[s]} ({countByStage[s] ?? 0})
          </button>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-dim" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by deal, company, or owner…"
          className="pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border-subtle">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-left">
            <thead className="bg-panel-elevated">
              <tr className="text-[10px] uppercase tracking-wide text-text-dim">
                <th className={headerCell}>Deal</th>
                <th className={`${headerCell} w-44`}>Company</th>
                <th className={`${headerCell} w-40`}>Contact</th>
                <th className={`${headerCell} w-36`}>Stage</th>
                <th className={`${headerCell} w-28 text-right`}>Value</th>
                <th className={`${headerCell} w-32`}>Owner</th>
                <th className={`${headerCell} w-28`}>Expected close</th>
                <th className="w-24 border-b border-border-subtle px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center">
                    <Loader2 className="mx-auto size-4 animate-spin text-text-dim" />
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-sm text-text-dim">
                    No deals match this filter.
                  </td>
                </tr>
              )}
              {pager.pageItems.map((deal, i) => (
                <DealRow
                  key={deal.id}
                  deal={deal}
                  striped={i % 2 === 1}
                  bodyCell={bodyCell}
                  onOpen={() => navigate({ to: "/deals/$id", params: { id: deal.id } })}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <TablePagination
        total={pager.total}
        page={pager.page}
        pageCount={pager.pageCount}
        pageSize={pager.pageSize}
        firstRow={pager.firstRow}
        lastRow={pager.lastRow}
        onPageChange={pager.setPage}
        onPageSizeChange={pager.setPageSize}
        noun="deals"
      />
    </div>
  );
}

function DealRow({
  deal,
  striped,
  bodyCell,
  onOpen,
}: {
  deal: Deal;
  striped: boolean;
  bodyCell: string;
  onOpen: () => void;
}) {
  return (
    <tr
      onClick={onOpen}
      className={`cursor-pointer transition-colors hover:bg-accent/30 ${striped ? "bg-canvas/40" : ""}`}
    >
      <td className={`${bodyCell} text-sm font-medium`}>{deal.title}</td>
      <td className={`${bodyCell} text-xs text-text-dim`}>{deal.company?.name ?? "—"}</td>
      <td className={`${bodyCell} text-xs text-text-dim`}>
        {deal.contact ? `${deal.contact.firstName} ${deal.contact.lastName}` : "—"}
      </td>
      <td className={bodyCell}>
        <span
          className={`inline-block rounded-full border px-2 py-0.5 text-[10px] ${STAGE_TONE[deal.stage]}`}
        >
          {DEAL_STAGE_LABELS[deal.stage]}
        </span>
      </td>
      <td className={`${bodyCell} text-right font-mono text-xs`}>${deal.value.toLocaleString()}</td>
      <td className={`${bodyCell} text-xs`}>
        <span className="flex items-center gap-1.5">
          <Avatar className="size-5 shrink-0">
            <AvatarFallback className="text-[9px]">
              {getInitials(deal.owner)}
            </AvatarFallback>
          </Avatar>
          <span className="truncate">
            {deal.owner.firstName} {deal.owner.lastName}
          </span>
        </span>
      </td>
      <td className={`${bodyCell} font-mono text-[11px] text-text-dim`}>
        {deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString() : "—"}
      </td>
      <td className="border-b border-border-subtle px-3 py-2">
        <div className="flex items-center gap-1.5">
          {deal.approvalStatus === "PENDING" && (
            <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] text-warning">
              Approval
            </span>
          )}
          {deal.stage === "PROPOSAL_SENT" && (
            <Paperclip className="size-3 text-text-dim" aria-label="Proposal stage" />
          )}
        </div>
      </td>
    </tr>
  );
}
