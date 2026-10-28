import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useFollowUps, useDismissFollowUp } from "@/hooks/use-bulk-email";
import { useSequenceFollowUps, useDismissSequenceFollowUp } from "@/hooks/use-sequences";
import { useDealFollowUps, useUpdateDeal } from "@/hooks/use-deals";
import {
  ArrowUpRight,
  CheckCircle2,
  Circle,
  MessageCircle,
  X,
  TrendingUp,
  DollarSign,
  Briefcase,
  CheckSquare,
  Sparkles,
  Zap,
  Target,
  Search,
  Activity,
  Layers,
  Award,
  ShieldCheck,
  ChevronRight,
  Flame,
  Clock,
  Send,
  PieChart,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { useSalesStats } from "@/hooks/use-dashboard";
import { DEAL_STAGE_LABELS } from "@/lib/api/types";
import { useAuthStore } from "@/stores/auth-store";
import { useSprints } from "@/hooks/use-sprints";
import { useTasks } from "@/hooks/use-tasks";
import { useChannels, useMessages, useSendMessage } from "@/hooks/use-chat";
import { useRecruitmentAnalyticsSummary } from "@/hooks/use-recruitment";
import { CANDIDATE_STAGES, CANDIDATE_STAGE_LABELS } from "@/lib/api/recruitment";
import { useKeywords, useAudits, useBacklinks } from "@/hooks/use-seo";
import { useAppSettings } from "@/hooks/use-app-settings";
import { hasAreaAccess } from "@/lib/modules";
import { BreakTimeToggle } from "@/components/break-time-toggle";
import { AiTokenMonitorWidget } from "@/components/ai-token-monitor-widget";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
});

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function Dashboard() {
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role.name === "ADMIN";
  const isManager = currentUser?.role.name === "MANAGER";
  const normDept = (currentUser?.department?.name || "").toLowerCase().trim();

  // Admin-picked modules override the department: a custom list decides which dashboards load.
  const custom = !!currentUser?.modulesCustomized;
  const isSalesUser = custom ? hasAreaAccess(currentUser, "Sales") : isAdmin || normDept.includes("sales");
  const isDevUser = custom
    ? hasAreaAccess(currentUser, "Development")
    : isAdmin || normDept.includes("dev") || normDept.includes("engineering");
  const canViewAiMetrics = isAdmin || isManager || isDevUser;
  const isRecruitmentUser = custom ? hasAreaAccess(currentUser, "Recruitment") : isAdmin || normDept.includes("recruit");
  const isSeoUser = custom
    ? hasAreaAccess(currentUser, "Digital Marketing")
    : isAdmin || normDept.includes("market") || normDept.includes("seo");
  const isHrUser = isAdmin || normDept === "hr" || normDept.includes("human resource");

  const showSales = isSalesUser;
  const showDev = isDevUser;
  const showRecruitment = isRecruitmentUser;
  const showSeo = isSeoUser;

  const seoDepartmentId = isAdmin ? undefined : currentUser?.department?.id;

  const { data: appSettings } = useAppSettings();
  const { data: salesStats } = useSalesStats(showSales);
  const { data: sprints } = useSprints(undefined, showDev);
  const { data: tasks } = useTasks({});
  const { data: channels } = useChannels();
  const { data: recruitmentSummary } = useRecruitmentAnalyticsSummary(showRecruitment);
  const { data: keywords } = useKeywords(seoDepartmentId, showSeo);
  const { data: audits } = useAudits(seoDepartmentId, showSeo);
  const { data: backlinks } = useBacklinks(seoDepartmentId, showSeo);

  const generalChannel = channels?.find((c) => c.name === "general") || channels?.[0];
  const { data: chatMessages } = useMessages(generalChannel?.id);

  const activeSprint = useMemo(() => {
    return sprints?.find((s) => s.status === "ACTIVE") || null;
  }, [sprints]);

  const sprintTasks = useMemo(() => {
    return tasks?.filter((t) => t.sprintId === activeSprint?.id) || [];
  }, [tasks, activeSprint]);

  const completedTasks = useMemo(() => {
    return sprintTasks.filter((t) => t.status === "DONE");
  }, [sprintTasks]);

  const sprintProgressPct = useMemo(() => {
    if (sprintTasks.length === 0) return 0;
    return Math.round((completedTasks.length / sprintTasks.length) * 100);
  }, [sprintTasks, completedTasks]);

  const remainingDays = useMemo(() => {
    if (!activeSprint) return null;
    const diff = new Date(activeSprint.endDate).getTime() - Date.now();
    return Math.max(0, Math.round(diff / (24 * 3600 * 1000)));
  }, [activeSprint]);

  const wonThisMonth = salesStats?.wonThisMonth;
  const winRateLabel =
    salesStats?.winRateThisMonth != null
      ? `${Math.round(salesStats.winRateThisMonth)}% win rate`
      : "0% win rate";

  const revenueByMonth = salesStats?.revenueByMonth ?? [];
  const maxMonthValue = Math.max(1, ...revenueByMonth.map((m) => m.value));
  const lastTwoMonths = revenueByMonth.slice(-2);
  const monthOverMonthDelta =
    lastTwoMonths.length === 2 && lastTwoMonths[0].value > 0
      ? Math.round(
          ((lastTwoMonths[1].value - lastTwoMonths[0].value) / lastTwoMonths[0].value) * 100,
        )
      : null;

  const avgKeywordRank = useMemo(() => {
    const ranked = keywords?.filter((k) => k.currentRank != null) ?? [];
    if (ranked.length === 0) return null;
    return Math.round(ranked.reduce((sum, k) => sum + (k.currentRank ?? 0), 0) / ranked.length);
  }, [keywords]);

  const latestAudit = useMemo(() => {
    if (!audits || audits.length === 0) return null;
    return [...audits].sort((a, b) => new Date(b.runAt).getTime() - new Date(a.runAt).getTime())[0];
  }, [audits]);

  const verifiedBacklinkCount = backlinks?.filter((b) => b.status === "VERIFIED").length ?? 0;

  const maxStageCount = useMemo(() => {
    if (!recruitmentSummary) return 1;
    return Math.max(1, ...CANDIDATE_STAGES.map((s) => recruitmentSummary.stageCounts[s]));
  }, [recruitmentSummary]);

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Executive Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-blue-50/40 to-orange-50/30 p-6 md:p-8 border border-slate-200/90 shadow-xs">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 size-80 rounded-full bg-gradient-to-br from-blue-400/10 to-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-48 -mb-20 size-64 rounded-full bg-gradient-to-tr from-orange-400/15 to-amber-300/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/90 border border-blue-200 shadow-2xs">
              <Sparkles className="size-3.5 text-blue-600" />
              <span className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
                Executive Command Dashboard
              </span>
              <span className="size-1 rounded-full bg-blue-400" />
              <span className="text-[11px] font-mono text-slate-500">Live Analytics</span>
            </div>

            <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900">
              {getGreeting()}, {currentUser?.firstName || "Executive"}
            </h1>

            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              {appSettings?.heroTagline || "Real-time key performance indicators and interactive team communication."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <BreakTimeToggle />

            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="relative flex size-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500" />
              </span>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-slate-900 leading-tight">Live Hub Active</span>
                <span className="text-[10px] font-mono text-slate-500 leading-tight">WebSocket Connected</span>
              </div>
            </div>

            {isSalesUser && (
              <Link
                to="/crm"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/25 hover:shadow-lg transition-all"
              >
                <span>View CRM Pipeline</span>
                <ArrowRight className="size-3.5" />
              </Link>
            )}
            {!isSalesUser && isDevUser && (
              <Link
                to="/projects"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/25 hover:shadow-lg transition-all"
              >
                <span>View Projects</span>
                <ArrowRight className="size-3.5" />
              </Link>
            )}
            {!isSalesUser && !isDevUser && isRecruitmentUser && (
              <Link
                to="/recruitment"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/25 hover:shadow-lg transition-all"
              >
                <span>View Recruitment</span>
                <ArrowRight className="size-3.5" />
              </Link>
            )}
            {!isSalesUser && !isDevUser && !isRecruitmentUser && isHrUser && (
              <Link
                to="/hr"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/25 hover:shadow-lg transition-all"
              >
                <span>HRMS Portal</span>
                <ArrowRight className="size-3.5" />
              </Link>
            )}
            {!isSalesUser && !isDevUser && !isRecruitmentUser && !isHrUser && isSeoUser && (
              <Link
                to="/seo"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/25 hover:shadow-lg transition-all"
              >
                <span>Digital Marketing Hub</span>
                <ArrowRight className="size-3.5" />
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* MAIN TOP DASHBOARD SECTION */}
      <div className="grid grid-cols-12 gap-5 md:gap-6 items-start">
        {/* LEFT SIDE: General Chat Box & Featured Analytics Panels */}
        <div className="col-span-12 lg:col-span-7 space-y-6">
          {/* General Chat Bar */}
          <Card className="p-0 overflow-hidden flex flex-col justify-between">
            <DashboardChatBar
              channelId={generalChannel?.id}
              channelName={generalChannel?.name ?? "general"}
              messages={chatMessages}
            />
          </Card>

          {/* Featured Revenue & Stage Distribution Chart */}
          {showSales && (
            <Card>
              <CardHeader
                icon={PieChart}
                title="KPI Revenue & Stage Distribution"
                subtitle="Proportional breakdown of sales revenue across pipeline stages"
                action={
                  monthOverMonthDelta !== null ? (
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full ${
                        monthOverMonthDelta >= 0
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-red-50 text-red-700 border border-red-200"
                      }`}
                    >
                      <ArrowUpRight
                        className={`size-3.5 ${monthOverMonthDelta < 0 ? "rotate-90" : ""}`}
                      />
                      {monthOverMonthDelta >= 0 ? "+" : ""}
                      {monthOverMonthDelta}% Growth
                    </span>
                  ) : undefined
                }
              />
              <KpiPieChart
                totalValue={salesStats?.totalActiveValue ?? (wonThisMonth ? wonThisMonth.value : 0)}
                winRateLabel={winRateLabel}
                stageBreakdown={salesStats?.stageBreakdown}
              />
            </Card>
          )}
        </div>

        {/* RIGHT SIDE: Department KPI Cards */}
        <div className="col-span-12 lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {showDev && (
            <>
              <KpiCard
                icon={CheckSquare}
                label="Open Sprint Tasks"
                value={String(sprintTasks.filter((t) => t.status !== "DONE").length).padStart(2, "0")}
                delta={`${completedTasks.length} tasks completed`}
                accent="blue"
                sparkline={[40, 50, 45, 60, 70, 65]}
              />
              <KpiCard
                icon={Zap}
                label="Active Sprint"
                value={activeSprint ? `'${activeSprint.name}'` : "No Sprint"}
                delta={remainingDays != null ? `${remainingDays} days left` : "Inactive"}
                accent="orange"
                sparkline={[10, 25, 45, 60, 75, 90]}
              />
            </>
          )}

          {showRecruitment && (
            <>
              <KpiCard
                icon={Briefcase}
                label="Open Positions"
                value={recruitmentSummary ? String(recruitmentSummary.openPositions) : "0"}
                delta={`${recruitmentSummary?.totalCandidates ?? 0} candidates`}
                accent="blue"
                sparkline={[25, 35, 50, 65, 55, 80]}
              />
              <KpiCard
                icon={Award}
                label="Hires This Month"
                value={recruitmentSummary ? String(recruitmentSummary.hiresThisMonth) : "0"}
                delta={
                  recruitmentSummary?.offerAcceptanceRate != null
                    ? `${recruitmentSummary.offerAcceptanceRate}% offer accept`
                    : "0%"
                }
                accent="red"
                sparkline={[15, 30, 45, 50, 70, 85]}
              />
            </>
          )}

          {showSales && (
            <>
              <KpiCard
                icon={DollarSign}
                label="Monthly Revenue"
                value={wonThisMonth ? `$${wonThisMonth.value.toLocaleString()}` : "$0"}
                delta={
                  wonThisMonth
                    ? `+${wonThisMonth.count} closed deal${wonThisMonth.count === 1 ? "" : "s"}`
                    : "0 deals"
                }
                accent="blue"
                sparkline={[30, 45, 60, 50, 75, 90]}
              />
              <KpiCard
                icon={Award}
                label="Deals Won"
                value={wonThisMonth ? String(wonThisMonth.count) : "0"}
                delta={winRateLabel}
                positive={salesStats?.winRateThisMonth != null && salesStats.winRateThisMonth >= 50}
                accent="orange"
                sparkline={[20, 35, 40, 65, 80, 85]}
              />
            </>
          )}

          {showSeo && (
            <>
              <KpiCard
                icon={Search}
                label="Tracked Keywords"
                value={keywords ? String(keywords.length) : "0"}
                delta={avgKeywordRank ? `Avg Rank #${avgKeywordRank}` : "No rank data"}
                accent="orange"
                sparkline={[50, 60, 55, 70, 80, 95]}
              />
              <KpiCard
                icon={ShieldCheck}
                label="Latest Audit Score"
                value={latestAudit ? `${latestAudit.score}/100` : "N/A"}
                delta={
                  latestAudit ? new Date(latestAudit.runAt).toLocaleDateString() : "No audits yet"
                }
                positive={!!latestAudit && latestAudit.score >= 80}
                accent="blue"
                sparkline={[60, 70, 75, 85, 90, 88]}
              />
            </>
          )}
        </div>
      </div>

      {/* Main Grid: Dev Sprints, High Value Deals, Follow-ups, SEO */}
      <div className="grid grid-cols-12 gap-5 md:gap-6">
        {/* Active Sprint Management Panel */}
        {showDev && (
          <Card className="col-span-12 lg:col-span-8">
            <CardHeader
              icon={Layers}
              title={activeSprint ? `Active Sprint: ${activeSprint.name}` : "Sprint Overview"}
              subtitle={
                activeSprint
                  ? `${remainingDays ?? 0} days remaining · ${sprintProgressPct}% sprint completed`
                  : "No active sprint currently"
              }
              badge={
                activeSprint ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold">
                    <Activity className="size-3.5 text-blue-600" />
                    Sprint Active
                  </span>
                ) : undefined
              }
            />

            {activeSprint ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-50 via-blue-50/30 to-orange-50/20 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-700 uppercase tracking-wider">Sprint Task Progress</span>
                    <span className="text-blue-600 font-mono text-sm">{sprintProgressPct}%</span>
                  </div>
                  <div className="h-3 w-full bg-slate-200/80 rounded-full overflow-hidden p-0.5 border border-slate-300/60">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-orange-500 rounded-full transition-all duration-700"
                      style={{ width: `${sprintProgressPct}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  {sprintTasks.slice(0, 4).map((t, idx) => {
                    const statusBadge: Record<string, { bg: string; label: string }> = {
                      TODO: { bg: "bg-slate-100 text-slate-700 border-slate-200", label: "Todo" },
                      IN_PROGRESS: { bg: "bg-blue-50 text-blue-700 border-blue-200", label: "In Progress" },
                      REVIEW: { bg: "bg-orange-50 text-orange-700 border-orange-200", label: "Review" },
                      DONE: { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Done" },
                    };
                    const badge = statusBadge[t.status] ?? statusBadge.TODO;
                    return (
                      <div
                        key={t.id}
                        className="flex items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 hover:border-blue-300 transition-all"
                      >
                        {t.status === "DONE" ? (
                          <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                        ) : (
                          <Circle className="size-4 text-slate-400 shrink-0" />
                        )}
                        <span className="text-xs font-mono font-bold text-blue-600">
                          DEV-{String(idx + 1).padStart(3, "0")}
                        </span>
                        <span className="text-sm font-semibold text-slate-900 flex-1 truncate">
                          {t.title}
                        </span>
                        <span className={`text-xs px-3 py-1 rounded-full font-bold border ${badge.bg}`}>
                          {badge.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-6 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200">
                <p className="text-sm text-slate-500">No active sprint running.</p>
              </div>
            )}
          </Card>
        )}

        {/* High Value Sales Deals */}
        {showSales && (
          <Card className="col-span-12 md:col-span-6 lg:col-span-4">
            <CardHeader icon={Flame} title="High Value Deals" subtitle="Top opportunities in pipeline" />
            <div className="space-y-3 pt-1">
              {(salesStats?.topOpenDeals ?? []).map((d) => (
                <div
                  key={d.id}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col gap-1 hover:border-blue-300 hover:bg-white transition-all shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 truncate">{d.title}</span>
                    <span className="text-xs font-extrabold font-mono text-blue-600">
                      ${d.value.toLocaleString()}
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    {DEAL_STAGE_LABELS[d.stage]}
                  </span>
                </div>
              ))}
              {salesStats && salesStats.topOpenDeals.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-6">No active high-value deals.</p>
              )}
            </div>
          </Card>
        )}

        {/* Follow-Up Reminders */}
        {showSales && <FollowUpsCard />}

        {/* Live SEO Analytics Snapshot */}
        {showSeo && (
          <Card className="col-span-12 lg:col-span-7">
            <CardHeader
              icon={Target}
              title="KPI SEO Performance & Rank Snapshot"
              subtitle="Live search keywords, website audit score, and backlink verification"
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <MiniStatCard label="Tracked Keywords" value={keywords ? String(keywords.length) : "0"} />
              <MiniStatCard
                label="Avg Keyword Rank"
                value={avgKeywordRank != null ? `#${avgKeywordRank}` : "N/A"}
              />
              <MiniStatCard label="Verified Backlinks" value={String(verifiedBacklinkCount)} />
              <MiniStatCard
                label="Latest Audit Score"
                value={latestAudit ? `${latestAudit.score}/100` : "N/A"}
                positive={!!latestAudit && latestAudit.score >= 80}
              />
            </div>
          </Card>
        )}
      </div>

      {/* Executive AI Token & Cost Monitor (Admin & Manager Only) */}
      {canViewAiMetrics && (
        <section className="pt-2">
          <AiTokenMonitorWidget />
        </section>
      )}
    </div>
  );
}

{/* Interactive Vector KPI Pie / Donut Chart Component */}
function KpiPieChart({
  totalValue,
  winRateLabel,
  stageBreakdown,
}: {
  totalValue: number;
  winRateLabel: string;
  stageBreakdown?: Array<{
    label: string;
    value: number;
    share: number;
    color: string;
    bg: string;
  }>;
}) {
  const slices = stageBreakdown && stageBreakdown.length > 0
    ? stageBreakdown
    : [
        { label: "Closed Won Deals", share: 0, color: "#2563EB", bg: "bg-blue-600", value: 0 },
        { label: "Proposal & Negotiation", share: 0, color: "#F97316", bg: "bg-orange-500", value: 0 },
        { label: "Qualified Pipeline", share: 0, color: "#10B981", bg: "bg-emerald-500", value: 0 },
        { label: "Initial Lead Intake", share: 0, color: "#EF4444", bg: "bg-red-500", value: 0 },
      ];

  const r = 40;
  const C = 2 * Math.PI * r;
  let cumulativeOffset = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-4 bg-gradient-to-br from-slate-50/60 via-white to-blue-50/30 rounded-2xl border border-slate-200/80">
      <div className="relative size-48 shrink-0 flex items-center justify-center">
        <svg className="size-full transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="transparent"
            stroke="#E2E8F0"
            strokeWidth="14"
          />
          {totalValue > 0 &&
            slices.map((slice, i) => {
              if (slice.share <= 0) return null;
              const dashArray = `${(slice.share / 100) * C} ${C}`;
              const dashOffset = -((cumulativeOffset / 100) * C);
              cumulativeOffset += slice.share;

              return (
                <circle
                  key={i}
                  cx="50"
                  cy="50"
                  r={r}
                  fill="transparent"
                  stroke={slice.color}
                  strokeWidth="14"
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                  className="transition-all duration-700 hover:opacity-90 hover:stroke-width-[16]"
                />
              );
            })}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Pipeline Value
          </span>
          <span className="text-lg font-extrabold text-slate-900 font-mono leading-tight">
            ${totalValue > 0 ? totalValue.toLocaleString() : "0"}
          </span>
          <span className="text-[10px] font-bold text-blue-600 mt-0.5">
            {winRateLabel}
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-2.5 w-full">
        {slices.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200/80 hover:border-blue-300 hover:shadow-2xs transition-all"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={`size-3 rounded-full ${item.bg} shrink-0`} />
              <span className="text-xs font-bold text-slate-800 truncate">{item.label}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-mono font-extrabold text-slate-900">
                ${item.value > 0 ? item.value.toLocaleString() : "0"}
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono">
                {item.share}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

{/* Dedicated Interactive Dashboard Chat Bar Component */}
function DashboardChatBar({
  channelId,
  channelName,
  messages,
}: {
  channelId?: string;
  channelName: string;
  messages?: any[];
}) {
  const [content, setContent] = useState("");
  const sendMessage = useSendMessage();

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!content.trim() || !channelId || sendMessage.isPending) return;

    sendMessage.mutate(
      { channelId, content: content.trim() },
      {
        onSuccess: () => {
          setContent("");
        },
      }
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/70">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
            <MessageCircle className="size-4" />
          </div>
          <div>
            <span className="text-sm font-bold text-slate-900 block leading-tight">
              #{channelName}
            </span>
            <span className="text-[10px] text-slate-500">Live Team Discussion</span>
          </div>
        </div>
        <Link
          to="/chat"
          className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
        >
          <span>Full Chat</span>
          <ChevronRight className="size-3.5" />
        </Link>
      </div>

      <div className="p-5 space-y-3.5 flex-1 max-h-[280px] overflow-y-auto">
        {(!messages || messages.length === 0) && (
          <p className="text-xs text-slate-500 text-center py-8">
            No recent messages in #{channelName}. Start the conversation below!
          </p>
        )}
        {(messages ?? []).slice(-4).map((m, i) => {
          const name = m.sender ? `${m.sender.firstName} ${m.sender.lastName}` : "Unknown";
          const initials = name
            .split(" ")
            .map((n: string) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          const time = new Date(m.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          const badgeGradients = [
            "from-blue-600 to-indigo-600 text-white",
            "from-orange-500 to-amber-500 text-white",
            "from-emerald-600 to-teal-600 text-white",
            "from-purple-600 to-indigo-600 text-white",
          ];
          const grad = badgeGradients[i % badgeGradients.length];
          return (
            <div key={m.id} className="flex gap-3 items-start">
              <div
                className={`size-8 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-[10px] font-bold shadow-2xs shrink-0`}
              >
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">{name}</span>
                  <span className="text-[10px] font-mono text-slate-400">{time}</span>
                </div>
                <p className="text-xs text-slate-700 mt-1 leading-relaxed bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80">
                  {m.content}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSend} className="p-3 border-t border-slate-200/80 bg-slate-50/60 flex items-center gap-2">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={`Message #${channelName}…`}
          className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
        />
        <button
          type="submit"
          disabled={!content.trim() || !channelId || sendMessage.isPending}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0"
        >
          {sendMessage.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Send className="size-3.5" />
          )}
          <span>Send</span>
        </button>
      </form>
    </div>
  );
}

function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`bg-white border border-slate-200/90 rounded-3xl p-5 md:p-6 shadow-2xs hover:shadow-xs transition-all ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({
  icon: Icon,
  title,
  subtitle,
  badge,
  action,
}: {
  icon?: any;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="size-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 mt-0.5 shadow-2xs">
            <Icon className="size-4.5" />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold tracking-tight text-slate-900">{title}</h2>
            {badge}
          </div>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  delta,
  positive,
  accent = "blue",
  sparkline = [],
}: {
  icon: any;
  label: string;
  value: string;
  delta: string;
  positive?: boolean;
  accent?: "blue" | "orange" | "red";
  sparkline?: number[];
}) {
  const accentStyles = {
    blue: {
      borderTop: "border-t-4 border-t-blue-600",
      bgIcon: "bg-blue-50 border-blue-100 text-blue-600",
      textDelta: "text-blue-700",
      bar: "bg-blue-600",
    },
    orange: {
      borderTop: "border-t-4 border-t-orange-500",
      bgIcon: "bg-orange-50 border-orange-100 text-orange-600",
      textDelta: "text-orange-700",
      bar: "bg-orange-500",
    },
    red: {
      borderTop: "border-t-4 border-t-red-500",
      bgIcon: "bg-red-50 border-red-100 text-red-600",
      textDelta: "text-red-700",
      bar: "bg-red-500",
    },
  }[accent];

  const maxVal = Math.max(1, ...sparkline);

  return (
    <div className={`col-span-12 sm:col-span-6 lg:col-span-3 bg-white border border-slate-200/90 ${accentStyles.borderTop} rounded-3xl p-5 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all group relative overflow-hidden`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</p>
        <div className={`size-9 rounded-2xl ${accentStyles.bgIcon} border flex items-center justify-center shadow-2xs`}>
          <Icon className="size-4.5" />
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-2">
        <span className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 tabular-nums">
          {value}
        </span>
        <span
          className={`text-xs font-mono font-bold ${
            positive ? "text-emerald-600" : accentStyles.textDelta
          }`}
        >
          {delta}
        </span>
      </div>

      {sparkline.length > 0 && (
        <div className="mt-3 flex items-end gap-1 h-4">
          {sparkline.map((v, i) => (
            <div
              key={i}
              className={`flex-1 rounded-full opacity-35 group-hover:opacity-80 transition-all ${accentStyles.bar}`}
              style={{ height: `${(v / maxVal) * 100}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MiniStatCard({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">{label}</p>
      <p
        className={`text-base font-extrabold tabular-nums mt-1 ${
          positive ? "text-emerald-600" : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function TrophyBadge(props: any) {
  return <Award {...props} />;
}

function UsersGroupIcon(props: any) {
  return <Briefcase {...props} />;
}

interface FollowUpItem {
  id: string;
  rawId: string;
  channel: "bulk" | "sequence" | "deal";
  name: string;
  channelLabel: string;
  subLabel: string;
  sentAt: string | null;
  link: string;
}

function useAllFollowUps() {
  const { data: bulk, isLoading: bulkLoading } = useFollowUps();
  const { data: sequence, isLoading: sequenceLoading } = useSequenceFollowUps();
  const { data: deals, isLoading: dealsLoading } = useDealFollowUps();

  const items = useMemo<FollowUpItem[]>(() => {
    const bulkItems: FollowUpItem[] = (bulk ?? []).map((f) => ({
      id: `bulk-${f.id}`,
      rawId: f.id,
      channel: "bulk",
      name: f.contact ? `${f.contact.firstName} ${f.contact.lastName}` : f.email,
      channelLabel: "Bulk Email",
      subLabel: f.campaign?.name ?? "Campaign",
      sentAt: f.sentAt,
      link: "/crm",
    }));
    const sequenceItems: FollowUpItem[] = (sequence ?? []).map((s) => ({
      id: `seq-${s.id}`,
      rawId: s.id,
      channel: "sequence",
      name: `${s.enrollment.contact.firstName} ${s.enrollment.contact.lastName}`,
      channelLabel: "Sequence",
      subLabel: s.enrollment.sequence.name,
      sentAt: s.sentAt,
      link: "/crm",
    }));
    const dealItems: FollowUpItem[] = (deals ?? []).map((d) => ({
      id: `deal-${d.id}`,
      rawId: d.id,
      channel: "deal",
      name: d.title,
      channelLabel: "Deal",
      subLabel: d.owner ? `${d.owner.firstName} ${d.owner.lastName}` : DEAL_STAGE_LABELS[d.stage],
      sentAt: d.followUpAt,
      link: `/deals/${d.id}`,
    }));
    return [...bulkItems, ...sequenceItems, ...dealItems].sort((a, b) => {
      if (!a.sentAt) return 1;
      if (!b.sentAt) return -1;
      return new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime();
    });
  }, [bulk, sequence, deals]);

  return { items, isLoading: bulkLoading || sequenceLoading || dealsLoading };
}

function FollowUpsCard() {
  const { items, isLoading } = useAllFollowUps();
  const dismissBulk = useDismissFollowUp();
  const dismissSequence = useDismissSequenceFollowUp();
  const clearDealFollowUp = useUpdateDeal();

  function handleDismiss(item: FollowUpItem) {
    if (item.channel === "bulk") {
      dismissBulk.mutate(item.rawId);
    } else if (item.channel === "sequence") {
      dismissSequence.mutate(item.rawId);
    } else {
      clearDealFollowUp.mutate({ id: item.rawId, input: { followUpAt: null } });
    }
  }

  return (
    <Card className="col-span-12 md:col-span-6 lg:col-span-5">
      <CardHeader
        icon={Clock}
        title="Follow-Up Reminders"
        subtitle="Unopened outreach & deal action reminders"
      />
      <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
        {isLoading && <p className="text-xs text-slate-500">Loading follow-ups...</p>}
        {!isLoading && items.length === 0 && (
          <p className="text-xs text-slate-500 text-center py-6">No pending follow-up reminders. Great job!</p>
        )}
        {!isLoading &&
          items.map((item) => {
            const dismissing =
              item.channel === "bulk"
                ? dismissBulk.isPending && dismissBulk.variables === item.rawId
                : item.channel === "sequence"
                  ? dismissSequence.isPending && dismissSequence.variables === item.rawId
                  : clearDealFollowUp.isPending && clearDealFollowUp.variables?.id === item.rawId;

            const channelBadge: Record<string, string> = {
              bulk: "bg-blue-50 text-blue-700 border-blue-200",
              sequence: "bg-orange-50 text-orange-700 border-orange-200",
              deal: "bg-red-50 text-red-700 border-red-200",
            };

            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-blue-300 hover:bg-white transition-all shadow-2xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-slate-900 truncate">{item.name}</p>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                        channelBadge[item.channel] ?? "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {item.channelLabel}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {item.subLabel} ·{" "}
                    {item.sentAt ? new Date(item.sentAt).toLocaleDateString() : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    to={item.link}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 px-3 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors"
                  >
                    {item.channel === "deal" ? "Open" : "Contact"}
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDismiss(item)}
                    disabled={dismissing}
                    title="Dismiss reminder"
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-50 transition-colors"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
      </div>
    </Card>
  );
}
