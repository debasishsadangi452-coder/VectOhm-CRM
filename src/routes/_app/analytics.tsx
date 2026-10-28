import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BarChart3, TrendingUp, CheckSquare, Building, Users, Calendar, DollarSign, Target } from "lucide-react";
import { useAnalyticsSummary } from "@/hooks/use-analytics";
import { MarketingAnalyticsTab } from "@/components/marketing-analytics-tab";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { data: summary, isLoading } = useAnalyticsSummary();
  const [activeTab, setActiveTab] = useState("sales");

  if (isLoading || !summary) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-xs text-text-dim">Loading company analytics...</p>
        </div>
      </div>
    );
  }

  // Format stage labels
  const getStageLabel = (stage: string) => {
    return stage.replace(/_/g, " ").replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
  };

  // Find max value in monthly trend for scaling charts
  const maxMonthlyRevenue = summary.sales.monthlyTrend.reduce((max, m) => Math.max(max, m.value), 1);

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6 select-none bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="size-11 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center text-primary shrink-0">
          <BarChart3 className="size-5" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Business Analytics</h1>
          <p className="text-sm text-text-dim mt-1">
            Real-time business insights, sales forecasts, and operational productivity metrics.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-panel border border-border-subtle p-1 rounded-xl">
          <TabsTrigger value="sales" className="rounded-lg text-xs font-semibold px-4 py-2">
            <TrendingUp className="size-3.5 mr-2" />
            Sales & Revenue
          </TabsTrigger>
          <TabsTrigger value="productivity" className="rounded-lg text-xs font-semibold px-4 py-2">
            <CheckSquare className="size-3.5 mr-2" />
            Task Productivity
          </TabsTrigger>
          <TabsTrigger value="org" className="rounded-lg text-xs font-semibold px-4 py-2">
            <Building className="size-3.5 mr-2" />
            Department Quotas
          </TabsTrigger>
          <TabsTrigger value="marketing" className="rounded-lg text-xs font-semibold px-4 py-2">
            <Target className="size-3.5 mr-2 text-blue-500" />
            Google Ads & ROI
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: SALES & REVENUE */}
        <TabsContent value="sales" className="space-y-6 outline-none">
          {/* Sales Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Closed Revenue"
              value={`$${summary.sales.totalWonRevenue.toLocaleString()}`}
              description="Life-time aggregated sales revenue"
              icon={DollarSign}
            />
            <StatCard
              title="Deals Won"
              value={String(summary.sales.leaderboard.reduce((sum, u) => sum + u.count, 0))}
              description="Total completed transactions"
              icon={TrendingUp}
            />
            <StatCard
              title="Win Rate"
              value={`${summary.sales.winRate}%`}
              description="Ratio of won vs lost closed deals"
              icon={CheckSquare}
            />
            <StatCard
              title="Avg Deal Value"
              value={`$${
                summary.sales.closedCount > 0
                  ? Math.round(summary.sales.totalWonRevenue / (summary.sales.leaderboard.reduce((sum, u) => sum + u.count, 0) || 1)).toLocaleString()
                  : "0"
              }`}
              description="Average value of all deals won"
              icon={Calendar}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sales Monthly Trend Chart */}
            <Card className="lg:col-span-2 bg-panel border-border-subtle rounded-xl overflow-hidden shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Monthly Sales Trend</CardTitle>
                <CardDescription className="text-[10px]">Closed won deal volumes by month</CardDescription>
              </CardHeader>
              <CardContent className="h-[250px] flex items-end justify-between gap-2 pt-4 px-6 border-t border-border-subtle/50">
                {summary.sales.monthlyTrend.length > 0 ? (
                  summary.sales.monthlyTrend.map((m, idx) => {
                    const heightPercent = Math.max(5, Math.round((m.value / maxMonthlyRevenue) * 100));
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer h-full justify-end">
                        <div className="w-full bg-primary/10 hover:bg-primary rounded-t-lg transition-all duration-300 relative" style={{ height: `${heightPercent}%` }}>
                          {/* Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-panel border border-border px-2 py-1 rounded text-[10px] font-mono whitespace-nowrap shadow z-10">
                            ${m.value.toLocaleString()}
                          </div>
                        </div>
                        <span className="text-[9px] text-text-dim tracking-tight text-center truncate w-full">{m.month}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-center text-text-dim text-xs">
                    No sales data logged this month
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Deal Stage Distribution */}
            <Card className="bg-panel border-border-subtle rounded-xl overflow-hidden shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Deal Stage Distribution</CardTitle>
                <CardDescription className="text-[10px]">Active deals counts in pipeline</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3.5 border-t border-border-subtle/50 pt-4">
                {Object.entries(summary.sales.stageCounts).map(([stage, count]) => {
                  const totalDeals = Object.values(summary.sales.stageCounts).reduce((s, c) => s + c, 0) || 1;
                  return (
                    <div key={stage} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-text-dim">{getStageLabel(stage)}</span>
                        <span className="font-mono">{count}</span>
                      </div>
                      <Progress value={(count / totalDeals) * 100} className="h-1.5" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Sales Leaderboard */}
          <Card className="bg-panel border-border-subtle rounded-xl overflow-hidden shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Sales Leaderboard</CardTitle>
                <CardDescription className="text-[10px]">Won revenue performance by representative</CardDescription>
              </div>
            </CardHeader>
            <Table className="border-t border-border-subtle/50">
              <TableHeader>
                <TableRow>
                  <TableHead>Sales Rep</TableHead>
                  <TableHead>Deals Won</TableHead>
                  <TableHead>Total Revenue</TableHead>
                  <TableHead className="w-[120px]">Rank</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.sales.leaderboard.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-text-dim py-8 text-xs">
                      No sales data recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  summary.sales.leaderboard.map((row, idx) => (
                    <TableRow key={row.ownerId}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Avatar className="size-6 bg-primary/10 text-primary">
                            <AvatarFallback className="text-[10px] font-bold">
                              {row.name.split(" ").map(n => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <span>{row.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-text-dim font-mono">{row.count}</TableCell>
                      <TableCell className="text-text font-semibold">${row.value.toLocaleString()}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          idx === 0 ? "bg-amber-500/10 text-amber-500" :
                          idx === 1 ? "bg-slate-400/10 text-slate-400" :
                          idx === 2 ? "bg-amber-700/10 text-amber-700" : "bg-panel-elevated text-text-dim"
                        }`}>
                          #{idx + 1}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Tab 2: TASK PRODUCTIVITY */}
        <TabsContent value="productivity" className="space-y-6 outline-none">
          {/* Productivity Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Total Active Tasks"
              value={String(summary.productivity.totalTasks)}
              description="Current task backlog count"
              icon={CheckSquare}
            />
            <StatCard
              title="Task Completion Rate"
              value={`${summary.productivity.completionRate}%`}
              description="Tasks finished vs total tasks"
              icon={CheckSquare}
            />
            <StatCard
              title="Total Active Projects"
              value={String(Object.values(summary.productivity.projectStatusCounts).reduce((s, c) => s + c, 0))}
              description="Ongoing team initiatives"
              icon={Users}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Task Status Breakdown */}
            <Card className="bg-panel border-border-subtle rounded-xl overflow-hidden shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Task Status Breakdown</CardTitle>
                <CardDescription className="text-[10px]">Division of task items in workflows</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3.5 border-t border-border-subtle/50 pt-4">
                {Object.entries(summary.productivity.statusCounts).map(([status, count]) => {
                  const pct = summary.productivity.totalTasks > 0 ? (count / summary.productivity.totalTasks) * 100 : 0;
                  return (
                    <div key={status} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-text-dim">{status.replace("_", " ")}</span>
                        <span className="font-mono">{count}</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Task Priority Distribution */}
            <Card className="bg-panel border-border-subtle rounded-xl overflow-hidden shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Task Priority breakdown</CardTitle>
                <CardDescription className="text-[10px]">Priority allocations of backlog tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3.5 border-t border-border-subtle/50 pt-4">
                {Object.entries(summary.productivity.priorityCounts).map(([priority, count]) => {
                  const pct = summary.productivity.totalTasks > 0 ? (count / summary.productivity.totalTasks) * 100 : 0;
                  return (
                    <div key={priority} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-text-dim">{priority}</span>
                        <span className="font-mono">{count}</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Project Status distribution */}
            <Card className="bg-panel border-border-subtle rounded-xl overflow-hidden shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Project Status Overview</CardTitle>
                <CardDescription className="text-[10px]">Current state of active projects</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3.5 border-t border-border-subtle/50 pt-4">
                {Object.entries(summary.productivity.projectStatusCounts).map(([status, count]) => {
                  const total = Object.values(summary.productivity.projectStatusCounts).reduce((s, c) => s + c, 0) || 1;
                  return (
                    <div key={status} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-text-dim">{status}</span>
                        <span className="font-mono">{count}</span>
                      </div>
                      <Progress value={(count / total) * 100} className="h-1.5" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Productivity Leaderboard */}
          <Card className="bg-panel border-border-subtle rounded-xl overflow-hidden shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Task Performance Leaderboard</CardTitle>
              <CardDescription className="text-[10px]">Completed tasks compared to overall assignments</CardDescription>
            </CardHeader>
            <Table className="border-t border-border-subtle/50">
              <TableHeader>
                <TableRow>
                  <TableHead>Teammate</TableHead>
                  <TableHead>Completed Tasks</TableHead>
                  <TableHead>Total Assigned</TableHead>
                  <TableHead className="w-[200px]">Completion Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.productivity.leaderboard.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-text-dim py-8 text-xs">
                      No task assignments logged.
                    </TableCell>
                  </TableRow>
                ) : (
                  summary.productivity.leaderboard.map((row) => {
                    const progressVal = row.totalCount > 0 ? (row.completedCount / row.totalCount) * 100 : 0;
                    return (
                      <TableRow key={row.assigneeId}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Avatar className="size-6 bg-primary/10 text-primary">
                              <AvatarFallback className="text-[10px] font-bold">
                                {row.name.split(" ").map(n => n[0]).join("")}
                              </AvatarFallback>
                            </Avatar>
                            <span>{row.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-text font-mono font-semibold">{row.completedCount}</TableCell>
                        <TableCell className="text-text-dim font-mono">{row.totalCount}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={progressVal} className="h-1.5 flex-1" />
                            <span className="text-[10px] font-mono text-text-dim shrink-0">{Math.round(progressVal)}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Tab 3: TEAM / ORG TARGETS */}
        <TabsContent value="org" className="space-y-6 outline-none">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="bg-panel border-border-subtle rounded-xl p-4 flex items-center gap-4 shadow-sm">
              <div className="size-10 rounded-lg bg-primary/10 grid place-items-center text-primary">
                <Users className="size-5" />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-widest text-text-dim">Total Employees</p>
                <p className="text-2xl font-bold tracking-tight mt-1">{summary.org.totalEmployees}</p>
              </div>
            </Card>
            <Card className="bg-panel border-border-subtle rounded-xl p-4 flex items-center gap-4 shadow-sm">
              <div className="size-10 rounded-lg bg-primary/10 grid place-items-center text-primary">
                <Building className="size-5" />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-widest text-text-dim">Active Departments</p>
                <p className="text-2xl font-bold tracking-tight mt-1">{summary.org.departments.length}</p>
              </div>
            </Card>
          </div>

          <Card className="bg-panel border-border-subtle rounded-xl overflow-hidden shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Department Quota Alignment</CardTitle>
              <CardDescription className="text-[10px]">Headcount and target quota mapping per department</CardDescription>
            </CardHeader>
            <Table className="border-t border-border-subtle/50">
              <TableHeader>
                <TableRow>
                  <TableHead>Department Name</TableHead>
                  <TableHead>Active Headcount</TableHead>
                  <TableHead>Monthly target</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.org.departments.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell className="font-semibold">{dept.name}</TableCell>
                    <TableCell className="text-text-dim font-mono">{dept.employeeCount} employees</TableCell>
                    <TableCell className="text-text font-mono font-medium">
                      {dept.monthlyTarget != null ? `$${dept.monthlyTarget.toLocaleString()}` : "No target set"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Tab 4: GOOGLE ADS & MARKETING ATTRIBUTION */}
        <TabsContent value="marketing">
          <MarketingAnalyticsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: any;
}) {
  return (
    <Card className="bg-panel border-border-subtle rounded-xl shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-[10px] font-medium uppercase tracking-widest text-text-dim">
          {title}
        </CardTitle>
        <Icon className="size-4 text-text-dim" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        <p className="text-[9px] text-text-dim mt-1.5">{description}</p>
      </CardContent>
    </Card>
  );
}
