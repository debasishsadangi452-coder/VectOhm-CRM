import { useState } from "react";
import {
  Sparkles,
  Zap,
  TrendingUp,
  DollarSign,
  Cpu,
  Users,
  Activity,
  Bot,
  Mail,
  FileText,
  Clock,
  Layers,
  ShieldCheck,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAiUsageSummary } from "@/hooks/use-ai-usage";
import { formatDistanceToNow } from "date-fns";

export function AiTokenMonitorWidget() {
  const [range, setRange] = useState<"today" | "7d" | "30d" | "all">("30d");
  const { data: summary, isLoading, isFetching, refetch } = useAiUsageSummary(range);

  const kpi = summary?.kpi ?? {
    totalTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalCostUsd: 0,
    todayTokens: 0,
    todayCostUsd: 0,
    monthTokens: 0,
    monthCostUsd: 0,
    totalRequests: 0,
  };

  const byProvider = summary?.byProvider ?? [];
  const byFeature = summary?.byFeature ?? [];
  const topUsers = summary?.topUsers ?? [];
  const recentLogs = summary?.recentLogs ?? [];

  return (
    <Card className="bg-panel border-border-subtle rounded-2xl shadow-sm overflow-hidden space-y-0">
      {/* Executive Header */}
      <div className="p-5 sm:p-6 border-b border-border-subtle/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-canvas/30">
        <div>
          <div className="flex items-center flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Bot className="size-3" />
              Executive Intelligence
            </span>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Realtime (5s Polling)
            </span>
            <span className="text-[11px] font-medium text-text-dim border border-border-subtle bg-panel px-2 py-0.5 rounded-full">
              Role Restricted: Admins & Managers Only
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1.5 flex items-center gap-2">
            <Sparkles className="size-4.5 text-indigo-500" />
            AI Token & Cloud Cost Monitoring
          </h2>
          <p className="text-xs text-text-dim max-w-2xl mt-0.5">
            Real-time tracking of token consumption, generative workloads (Gemini, Claude, OpenAI), and API costs across all employees and background automation pipelines.
          </p>
        </div>

        {/* Range Controls & Refresh */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
          <div className="flex items-center bg-panel border border-border-subtle rounded-lg p-1 text-xs">
            <button
              onClick={() => setRange("today")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                range === "today"
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-text-dim hover:text-foreground"
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setRange("7d")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                range === "7d"
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-text-dim hover:text-foreground"
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setRange("30d")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                range === "30d"
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-text-dim hover:text-foreground"
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setRange("all")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                range === "all"
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-text-dim hover:text-foreground"
              }`}
            >
              All Time
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-8 px-2.5 text-xs gap-1 border-border-subtle"
            title="Refresh AI Usage Metrics"
          >
            <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* Top 4 KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-canvas/50 border border-border-subtle p-4 rounded-xl space-y-1 relative overflow-hidden">
            <div className="flex items-center justify-between text-text-dim">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Tokens</span>
              <Cpu className="size-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {kpi.totalTokens.toLocaleString()}
            </div>
            <div className="flex items-center justify-between text-[11px] text-text-dim pt-1 border-t border-border-subtle/40">
              <span>Prompt: {kpi.promptTokens.toLocaleString()}</span>
              <span>Completion: {kpi.completionTokens.toLocaleString()}</span>
            </div>
          </div>

          <div className="bg-canvas/50 border border-border-subtle p-4 rounded-xl space-y-1 relative overflow-hidden">
            <div className="flex items-center justify-between text-text-dim">
              <span className="text-[11px] font-bold uppercase tracking-wider">Estimated API Cost</span>
              <DollarSign className="size-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              ${kpi.totalCostUsd.toFixed(4)}
            </div>
            <div className="flex items-center justify-between text-[11px] text-text-dim pt-1 border-t border-border-subtle/40">
              <span>Today: ${kpi.todayCostUsd.toFixed(4)}</span>
              <span>Month: ${kpi.monthCostUsd.toFixed(3)}</span>
            </div>
          </div>

          <div className="bg-canvas/50 border border-border-subtle p-4 rounded-xl space-y-1 relative overflow-hidden">
            <div className="flex items-center justify-between text-text-dim">
              <span className="text-[11px] font-bold uppercase tracking-wider">AI Calls / Invocations</span>
              <Activity className="size-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {kpi.totalRequests.toLocaleString()}
            </div>
            <div className="text-[11px] text-text-dim pt-1 border-t border-border-subtle/40">
              Across Assistant & Automations
            </div>
          </div>

          <div className="bg-canvas/50 border border-border-subtle p-4 rounded-xl space-y-1 relative overflow-hidden">
            <div className="flex items-center justify-between text-text-dim">
              <span className="text-[11px] font-bold uppercase tracking-wider">Top Provider</span>
              <Zap className="size-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
              {byProvider[0]?.provider || "GEMINI"}
            </div>
            <div className="text-[11px] text-text-dim pt-1 border-t border-border-subtle/40">
              {byProvider[0] ? `${byProvider[0].percentage}% of total token volume` : "Primary Engine"}
            </div>
          </div>
        </div>

        {/* Grid: Provider Split & Feature Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Provider Breakdown */}
          <div className="bg-canvas/30 border border-border-subtle p-5 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Layers className="size-3.5 text-indigo-500" />
                Workload by AI Provider
              </h3>
              <span className="text-[11px] text-text-dim">Tokens & Cloud Spend</span>
            </div>

            <div className="space-y-3">
              {byProvider.map((p) => {
                const colorClass =
                  p.provider === "GEMINI"
                    ? "bg-blue-500"
                    : p.provider === "ANTHROPIC"
                    ? "bg-purple-500"
                    : p.provider === "OPENAI"
                    ? "bg-emerald-500"
                    : "bg-amber-500";

                return (
                  <div key={p.provider} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`size-2 rounded-full ${colorClass}`} />
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {p.provider}
                        </span>
                        <span className="text-[11px] text-text-dim">
                          ({p.requestCount} requests)
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-text-dim">{p.tokens.toLocaleString()} tokens</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          ${p.costUsd.toFixed(4)}
                        </span>
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                          {p.percentage}%
                        </span>
                      </div>
                    </div>
                    <Progress value={p.percentage} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Feature Breakdown */}
          <div className="bg-canvas/30 border border-border-subtle p-5 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Zap className="size-3.5 text-amber-500" />
                CRM Feature Consumption
              </h3>
              <span className="text-[11px] text-text-dim">Use-Case Distribution</span>
            </div>

            <div className="space-y-3">
              {byFeature.map((f) => (
                <div key={f.feature} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      {f.feature === "AI_ASSISTANT" ? (
                        <Bot className="size-3.5 text-blue-500" />
                      ) : f.feature === "INTENT_OUTREACH" ? (
                        <Mail className="size-3.5 text-purple-500" />
                      ) : (
                        <FileText className="size-3.5 text-emerald-500" />
                      )}
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {f.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-text-dim">{f.tokens.toLocaleString()} tkn</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        ${f.costUsd.toFixed(4)}
                      </span>
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded">
                        {f.percentage}%
                      </span>
                    </div>
                  </div>
                  <Progress value={f.percentage} className="h-1.5" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* User Leaderboard & Real-time Live Stream */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Consuming Users */}
          <div className="bg-canvas/30 border border-border-subtle rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-border-subtle/50 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Users className="size-3.5 text-indigo-500" />
                Team Member Token Leaderboard
              </h3>
              <span className="text-[11px] text-text-dim">Per-Employee Usage</span>
            </div>

            <Table>
              <TableHeader className="bg-canvas/60">
                <TableRow>
                  <TableHead className="text-[11px] font-bold">Employee</TableHead>
                  <TableHead className="text-[11px] font-bold">Department</TableHead>
                  <TableHead className="text-[11px] font-bold text-right">Tokens</TableHead>
                  <TableHead className="text-[11px] font-bold text-right">Cost ($)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topUsers.map((u, idx) => (
                  <TableRow key={u.userId} className="hover:bg-canvas/50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-6 bg-primary/10 text-primary">
                          <AvatarFallback className="text-[10px] font-bold">
                            {u.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {u.name}
                          </div>
                          <div className="text-[10px] text-text-dim">{u.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-border-subtle bg-panel text-text-dim">
                        {u.department}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs font-mono font-semibold text-right">
                      {u.tokens.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs font-mono font-semibold text-emerald-600 text-right">
                      ${u.costUsd.toFixed(4)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Real-time Ingestion Activity Stream */}
          <div className="bg-canvas/30 border border-border-subtle rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-border-subtle/50 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Activity className="size-3.5 text-emerald-500" />
                Live Ingestion Stream
              </h3>
              <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Latest Requests
              </span>
            </div>

            <div className="divide-y divide-border-subtle/40 max-h-[360px] overflow-y-auto">
              {recentLogs.map((log) => (
                <div key={log.id} className="p-3 text-xs hover:bg-canvas/50 transition-colors flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {log.userName}
                      </span>
                      <span className="text-[10px] text-text-dim">· {log.feature}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-text-dim">
                      <span
                        className={`font-semibold px-1.5 py-0.2 rounded ${
                          log.provider === "GEMINI"
                            ? "bg-blue-500/10 text-blue-600"
                            : log.provider === "ANTHROPIC"
                            ? "bg-purple-500/10 text-purple-600"
                            : "bg-emerald-500/10 text-emerald-600"
                        }`}
                      >
                        {log.model}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-2.5" />
                        {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 font-mono">
                    <div className="font-bold text-slate-900 dark:text-slate-100">
                      {log.totalTokens.toLocaleString()} tokens
                    </div>
                    <div className="text-[10px] text-emerald-600 font-semibold">
                      ${log.estimatedCostUsd.toFixed(5)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
