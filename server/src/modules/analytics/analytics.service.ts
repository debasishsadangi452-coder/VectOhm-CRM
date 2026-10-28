import { Injectable } from "@nestjs/common";
import { DealStage, ProjectStatus, RoleName, TaskPriority, TaskStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../common/types/request-user.type";

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // Same rationale as TasksService.visibilityScope -- non-Admins only see
  // their own department's data (plus legacy/unscoped rows) in this
  // company-wide summary, same as the Dashboard.
  private visibilityScope(user: RequestUser) {
    if (user.role.name === RoleName.ADMIN) {
      return {};
    }
    return { OR: [{ departmentId: null }, { departmentId: user.department?.id }] };
  }

  async getSummary(user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const scope = this.visibilityScope(user);

    // 1. SALES METRICS
    const allDeals = await this.prisma.deal.findMany({
      where: scope,
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const wonDeals = allDeals.filter((d) => d.stage === DealStage.WON);
    const lostDeals = allDeals.filter((d) => d.stage === DealStage.LOST);
    const totalWonRevenue = wonDeals.reduce((sum, d) => sum + d.value, 0);

    const closedCount = wonDeals.length + lostDeals.length;
    const winRate = closedCount > 0 ? Math.round((wonDeals.length / closedCount) * 100) : 0;

    // Deal Stage Distribution
    const stageCounts = Object.values(DealStage).reduce((acc, stage) => {
      acc[stage] = allDeals.filter((d) => d.stage === stage).length;
      return acc;
    }, {} as Record<DealStage, number>);

    // Monthly Revenue Trend
    // Group won deals by "YYYY-MM"
    const revenueByMonth: Record<string, number> = {};
    wonDeals.forEach((d) => {
      if (d.closedAt) {
        const date = new Date(d.closedAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        revenueByMonth[monthKey] = (revenueByMonth[monthKey] || 0) + d.value;
      }
    });

    // Format monthly trend: array of { month: "Jan 2026", value: 12000 } sorted chronologically
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyTrend = Object.entries(revenueByMonth)
      .map(([key, value]) => {
        const [year, monthStr] = key.split("-");
        const monthIndex = parseInt(monthStr, 10) - 1;
        return {
          key, // YYYY-MM for sorting
          month: `${monthNames[monthIndex]} ${year}`,
          value,
        };
      })
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(({ month, value }) => ({ month, value }));

    // Sales Leaderboard
    const salesByUser: Record<string, { name: string; value: number; count: number }> = {};
    wonDeals.forEach((d) => {
      const name = `${d.owner.firstName} ${d.owner.lastName}`;
      if (!salesByUser[d.ownerId]) {
        salesByUser[d.ownerId] = { name, value: 0, count: 0 };
      }
      salesByUser[d.ownerId].value += d.value;
      salesByUser[d.ownerId].count += 1;
    });
    const salesLeaderboard = Object.entries(salesByUser)
      .map(([ownerId, stats]) => ({
        ownerId,
        ...stats,
      }))
      .sort((a, b) => b.value - a.value);


    // 2. PRODUCTIVITY METRICS
    const allTasks = await this.prisma.task.findMany({
      where: scope,
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const completedTasks = allTasks.filter((t) => t.status === TaskStatus.DONE);
    const taskCompletionRate = allTasks.length > 0 ? Math.round((completedTasks.length / allTasks.length) * 100) : 0;

    // Task Status Distribution
    const taskStatusCounts = Object.values(TaskStatus).reduce((acc, status) => {
      acc[status] = allTasks.filter((t) => t.status === status).length;
      return acc;
    }, {} as Record<TaskStatus, number>);

    // Task Priority Distribution
    const taskPriorityCounts = Object.values(TaskPriority).reduce((acc, priority) => {
      acc[priority] = allTasks.filter((t) => t.priority === priority).length;
      return acc;
    }, {} as Record<TaskPriority, number>);

    // Productivity Leaderboard (completed tasks by assignee)
    const taskStatsByUser: Record<string, { name: string; completedCount: number; totalCount: number }> = {};
    allTasks.forEach((t) => {
      if (t.assignee) {
        const name = `${t.assignee.firstName} ${t.assignee.lastName}`;
        if (!taskStatsByUser[t.assigneeId!]) {
          taskStatsByUser[t.assigneeId!] = { name, completedCount: 0, totalCount: 0 };
        }
        taskStatsByUser[t.assigneeId!].totalCount += 1;
        if (t.status === TaskStatus.DONE) {
          taskStatsByUser[t.assigneeId!].completedCount += 1;
        }
      }
    });
    const productivityLeaderboard = Object.entries(taskStatsByUser)
      .map(([assigneeId, stats]) => ({
        assigneeId,
        ...stats,
      }))
      .sort((a, b) => b.completedCount - a.completedCount);

    // Project Status distribution
    const allProjects = await this.prisma.project.findMany({ where: scope });
    const projectStatusCounts = Object.values(ProjectStatus).reduce((acc, status) => {
      acc[status] = allProjects.filter((p) => p.status === status).length;
      return acc;
    }, {} as Record<ProjectStatus, number>);


    // 3. TEAM / ORG METRICS -- scoped to the caller's own department unless Admin.
    const allDepartments = await this.prisma.department.findMany({
      where: isAdmin ? undefined : { id: user.department?.id },
      include: {
        _count: { select: { employees: true } },
      },
    });

    const departmentStats = allDepartments.map((d) => ({
      id: d.id,
      name: d.name,
      employeeCount: d._count.employees,
      monthlyTarget: d.monthlyTarget,
    }));

    const totalEmployees = isAdmin
      ? await this.prisma.user.count()
      : await this.prisma.user.count({ where: { departmentId: user.department?.id } });

    // 4. DEV METRICS
    const devVelocityByUser: Record<string, { name: string; storyPoints: number }> = {};
    let totalBugs = 0;
    let totalFeatures = 0;

    allTasks.forEach((t) => {
      if (t.type === "BUG") totalBugs++;
      if (t.type === "FEATURE") totalFeatures++;

      if (t.status === TaskStatus.DONE && t.storyPoints && t.assignee) {
        const name = `${t.assignee.firstName} ${t.assignee.lastName}`;
        if (!devVelocityByUser[t.assigneeId!]) {
          devVelocityByUser[t.assigneeId!] = { name, storyPoints: 0 };
        }
        devVelocityByUser[t.assigneeId!].storyPoints += t.storyPoints;
      }
    });

    const velocityLeaderboard = Object.entries(devVelocityByUser)
      .map(([assigneeId, stats]) => ({ assigneeId, ...stats }))
      .sort((a, b) => b.storyPoints - a.storyPoints);

    return {
      sales: {
        totalWonRevenue,
        closedCount,
        winRate,
        stageCounts,
        monthlyTrend,
        leaderboard: salesLeaderboard,
      },
      productivity: {
        totalTasks: allTasks.length,
        completionRate: taskCompletionRate,
        statusCounts: taskStatusCounts,
        priorityCounts: taskPriorityCounts,
        leaderboard: productivityLeaderboard,
        projectStatusCounts,
      },
      org: {
        totalEmployees,
        departments: departmentStats,
      },
      dev: {
        velocityLeaderboard,
        totalBugs,
        totalFeatures,
        qualityRatio: totalFeatures > 0 ? Math.round((totalBugs / totalFeatures) * 100) : 0,
      }
    };
  }
}
