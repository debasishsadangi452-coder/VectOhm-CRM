import { ForbiddenException, Injectable } from "@nestjs/common";
import { DealStage, OfferStatus, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../common/types/request-user.type";

const dealInclude = {
  company: { select: { id: true, name: true } },
  contact: { select: { id: true, firstName: true, lastName: true } },
  owner: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
} as const;

const OPEN_STAGES_EXCLUDED: DealStage[] = [DealStage.WON, DealStage.LOST, DealStage.ARCHIVED];

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSalesStats(user: RequestUser) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const months = this.getLastSixMonths(now);
    const startOfWindow = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    if (user.role.name !== RoleName.ADMIN) {
      const isSales = (user.department?.name || "").toLowerCase().includes("sales");
      if (!isSales) {
        throw new ForbiddenException("Access denied: Sales dashboard is only accessible to Sales and Admin");
      }
    }
    const scope = this.visibilityScope(user);

    const [pipelineAgg, wonAgg, lostAgg, topOpenDeals, wonDealsInWindow, stageBreakdownAgg] = await Promise.all([
      this.prisma.deal.aggregate({
        where: { stage: { notIn: OPEN_STAGES_EXCLUDED }, ...scope },
        _sum: { value: true },
      }),
      this.prisma.deal.aggregate({
        where: { stage: DealStage.WON, closedAt: { gte: startOfMonth }, ...scope },
        _sum: { value: true },
        _count: true,
      }),
      this.prisma.deal.aggregate({
        where: { stage: DealStage.LOST, closedAt: { gte: startOfMonth }, ...scope },
        _sum: { value: true },
        _count: true,
      }),
      this.prisma.deal.findMany({
        where: { stage: { notIn: OPEN_STAGES_EXCLUDED }, ...scope },
        orderBy: { value: "desc" },
        take: 5,
        include: dealInclude,
      }),
      this.prisma.deal.findMany({
        where: { stage: DealStage.WON, closedAt: { gte: startOfWindow }, ...scope },
        select: { value: true, closedAt: true },
      }),
      this.prisma.deal.groupBy({
        by: ["stage"],
        where: { stage: { notIn: [DealStage.ARCHIVED, DealStage.LOST] }, ...scope },
        _sum: { value: true },
        _count: true,
      }),
    ]);

    const wonCount = wonAgg._count;
    const lostCount = lostAgg._count;
    const totalClosed = wonCount + lostCount;

    const valueByMonth = new Map<string, number>(months.map((m) => [m, 0]));
    for (const deal of wonDealsInWindow) {
      if (!deal.closedAt) continue;
      const key = this.monthKey(deal.closedAt);
      if (valueByMonth.has(key)) {
        valueByMonth.set(key, (valueByMonth.get(key) ?? 0) + deal.value);
      }
    }

    let wonValue = 0;
    let proposalValue = 0;
    let qualifiedValue = 0;
    let leadValue = 0;

    for (const item of stageBreakdownAgg) {
      const val = item._sum.value ?? 0;
      if (item.stage === DealStage.WON) {
        wonValue += val;
      } else if (item.stage === DealStage.PROPOSAL_SENT || item.stage === DealStage.NEGOTIATION) {
        proposalValue += val;
      } else if (item.stage === DealStage.QUALIFIED || item.stage === DealStage.MEETING_SCHEDULED) {
        qualifiedValue += val;
      } else if (item.stage === DealStage.NEW_LEAD) {
        leadValue += val;
      }
    }

    const totalActiveValue = wonValue + proposalValue + qualifiedValue + leadValue;

    const stageBreakdown = [
      {
        label: "Closed Won Deals",
        value: wonValue,
        share: totalActiveValue > 0 ? Math.round((wonValue / totalActiveValue) * 100) : 0,
        color: "#2563EB",
        bg: "bg-blue-600",
      },
      {
        label: "Proposal & Negotiation",
        value: proposalValue,
        share: totalActiveValue > 0 ? Math.round((proposalValue / totalActiveValue) * 100) : 0,
        color: "#F97316",
        bg: "bg-orange-500",
      },
      {
        label: "Qualified Pipeline",
        value: qualifiedValue,
        share: totalActiveValue > 0 ? Math.round((qualifiedValue / totalActiveValue) * 100) : 0,
        color: "#10B981",
        bg: "bg-emerald-500",
      },
      {
        label: "Initial Lead Intake",
        value: leadValue,
        share: totalActiveValue > 0 ? Math.round((leadValue / totalActiveValue) * 100) : 0,
        color: "#EF4444",
        bg: "bg-red-500",
      },
    ];

    return {
      openPipelineValue: pipelineAgg._sum.value ?? 0,
      totalActiveValue,
      wonThisMonth: { count: wonCount, value: wonAgg._sum.value ?? 0 },
      lostThisMonth: { count: lostCount, value: lostAgg._sum.value ?? 0 },
      winRateThisMonth: totalClosed > 0 ? (wonCount / totalClosed) * 100 : null,
      topOpenDeals,
      revenueByMonth: months.map((month) => ({ month, value: valueByMonth.get(month) ?? 0 })),
      stageBreakdown,
    };
  }

  async getDevStats(user: RequestUser) {
    if (user.role.name !== RoleName.ADMIN) {
      const isDev = (user.department?.name || "").toLowerCase().includes("dev");
      if (!isDev) {
        throw new ForbiddenException("Access denied: Dev stats are only accessible to Development and Admin");
      }
    }

    const isEmployee = user.role.name === RoleName.EMPLOYEE;
    const projectScope = user.role.name === RoleName.ADMIN
      ? {}
      : user.role.name === RoleName.MANAGER
        ? { departmentId: user.department?.id }
        : { departmentId: user.department?.id, OR: [{ ownerId: user.id }, { members: { some: { id: user.id } } }] };

    const taskScope = user.role.name === RoleName.ADMIN
      ? {}
      : user.role.name === RoleName.MANAGER
        ? { departmentId: user.department?.id }
        : { departmentId: user.department?.id, OR: [{ assigneeId: user.id }, { assignees: { some: { userId: user.id } } }, { testerId: user.id }] };

    const [activeProjects, openTasks, completedTasks, openBugs] = await Promise.all([
      this.prisma.project.count({ where: { status: "ACTIVE", ...projectScope } }),
      this.prisma.task.count({ where: { status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] }, ...taskScope } }),
      this.prisma.task.count({ where: { status: "DONE", ...taskScope } }),
      this.prisma.bug.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    ]);

    return {
      activeProjects,
      openTasks,
      completedTasks,
      openBugs,
    };
  }

  async getRecruitmentStats(user: RequestUser) {
    if (user.role.name !== RoleName.ADMIN) {
      const isRecruitment = (user.department?.name || "").toLowerCase().includes("recruit");
      if (!isRecruitment) {
        throw new ForbiddenException("Access denied: Recruitment stats are only accessible to Recruitment and Admin");
      }
    }

    const candidateScope = user.role.name === RoleName.ADMIN
      ? {}
      : user.role.name === RoleName.MANAGER
        ? { departmentId: user.department?.id }
        : { departmentId: user.department?.id, ownerId: user.id };

    const [activeCandidates, totalInterviews, totalOffers] = await Promise.all([
      this.prisma.candidate.count({
        where: { stage: { notIn: ["HIRED", "REJECTED"] }, ...candidateScope },
      }),
      this.prisma.interview.count({
        where: { status: "SCHEDULED" },
      }),
      this.prisma.offer.count({
        where: { status: { in: [OfferStatus.DRAFT, OfferStatus.SENT] } },
      }),
    ]);

    return {
      activeCandidates,
      totalInterviews,
      totalOffers,
    };
  }

  private visibilityScope(user: RequestUser) {
    if (user.role.name === RoleName.ADMIN) {
      return {};
    }
    const isSales = (user.department?.name || "").toLowerCase().includes("sales");
    if (!isSales) {
      throw new ForbiddenException("Access denied: Sales dashboard is only accessible to Sales and Admin");
    }
    if (user.role.name === RoleName.MANAGER) {
      return { departmentId: user.department?.id };
    }
    return { departmentId: user.department?.id, ownerId: user.id };
  }

  private monthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  private getLastSixMonths(now: Date): string[] {
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      months.push(this.monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
    }
    return months;
  }
}
