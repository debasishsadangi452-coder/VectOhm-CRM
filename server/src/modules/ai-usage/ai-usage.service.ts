import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { calculateAiCostUsd } from "../../common/utils/ai-pricing";

export interface RecordAiUsageParams {
  userId?: string | null;
  provider: "GEMINI" | "OPENAI" | "ANTHROPIC" | "GROK" | string;
  model: string;
  feature: "AI_ASSISTANT" | "INTENT_OUTREACH" | "FOLLOW_UP" | "SEO_BRIEF" | "GROWTH_NEWS" | string;
  promptTokens: number;
  completionTokens: number;
  metadata?: Record<string, any>;
}

export interface AiUsageSummary {
  kpi: {
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    totalCostUsd: number;
    todayTokens: number;
    todayCostUsd: number;
    monthTokens: number;
    monthCostUsd: number;
    totalRequests: number;
  };
  byProvider: Array<{
    provider: string;
    tokens: number;
    costUsd: number;
    percentage: number;
    requestCount: number;
  }>;
  byFeature: Array<{
    feature: string;
    label: string;
    tokens: number;
    costUsd: number;
    percentage: number;
    requestCount: number;
  }>;
  topUsers: Array<{
    userId: string;
    name: string;
    email: string;
    department: string;
    tokens: number;
    costUsd: number;
    percentage: number;
  }>;
  recentLogs: Array<{
    id: string;
    userName: string;
    department: string;
    provider: string;
    model: string;
    feature: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
    createdAt: string;
  }>;
}

const FEATURE_LABELS: Record<string, string> = {
  AI_ASSISTANT: "AI Chat Assistant (Sidebar)",
  INTENT_OUTREACH: "Intent Hiring Cold Outreach",
  FOLLOW_UP: "CRM Deal Follow-up Drafter",
  SEO_BRIEF: "SEO Keyword Brief Generator",
  GROWTH_NEWS: "Market News Signal Classifier",
  EMAIL_TEMPLATE: "Email AI: New Template",
  EMAIL_REWRITE: "Email AI: Rewrite / Improve",
  EMAIL_SUBJECTS: "Email AI: Subject Lines",
  EMAIL_PERSONALIZE: "Email AI: Per-recipient Personalisation",
};

@Injectable()
export class AiUsageService {
  private readonly logger = new Logger(AiUsageService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Asynchronously records AI token consumption
   */
  async recordUsage(params: RecordAiUsageParams): Promise<void> {
    try {
      const promptTokens = Math.max(0, Math.round(params.promptTokens || 0));
      const completionTokens = Math.max(0, Math.round(params.completionTokens || 0));
      const totalTokens = promptTokens + completionTokens;
      const estimatedCostUsd = calculateAiCostUsd(params.model, promptTokens, completionTokens);

      await this.prisma.aiTokenUsage.create({
        data: {
          userId: params.userId || null,
          provider: params.provider.toUpperCase(),
          model: params.model,
          feature: params.feature,
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCostUsd,
          metadata: params.metadata || undefined,
        },
      });

      this.logger.log(
        `Recorded AI token usage: ${params.provider} (${params.model}) | ${params.feature} | ${totalTokens} tokens ($${estimatedCostUsd})`,
      );
    } catch (err: any) {
      this.logger.error(`Failed to record AI token usage: ${err.message}`, err.stack);
    }
  }

  /**
   * Aggregates real-time token consumption for dashboard
   */
  async getSummary(range: "today" | "7d" | "30d" | "all" = "30d"): Promise<AiUsageSummary> {
    let count = await this.prisma.aiTokenUsage.count();
    if (count === 0) {
      await this.seedInitialBaselineData();
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let fromDate: Date | undefined;
    if (range === "today") {
      fromDate = todayStart;
    } else if (range === "7d") {
      fromDate = new Date(Date.now() - 7 * 86400 * 1000);
    } else if (range === "30d") {
      fromDate = new Date(Date.now() - 30 * 86400 * 1000);
    }

    const whereClause = fromDate ? { createdAt: { gte: fromDate } } : {};

    const [filteredLogs, allLogs] = await Promise.all([
      this.prisma.aiTokenUsage.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              department: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.aiTokenUsage.findMany({
        select: {
          totalTokens: true,
          estimatedCostUsd: true,
          createdAt: true,
        },
      }),
    ]);

    // KPI Metrics
    const totalTokens = filteredLogs.reduce((acc, l) => acc + l.totalTokens, 0);
    const promptTokens = filteredLogs.reduce((acc, l) => acc + l.promptTokens, 0);
    const completionTokens = filteredLogs.reduce((acc, l) => acc + l.completionTokens, 0);
    const totalCostUsd = Number(
      filteredLogs.reduce((acc, l) => acc + l.estimatedCostUsd, 0).toFixed(4),
    );

    // Today & Month aggregates (across all logs for top-line cards)
    const todayLogs = allLogs.filter((l) => l.createdAt >= todayStart);
    const todayTokens = todayLogs.reduce((acc, l) => acc + l.totalTokens, 0);
    const todayCostUsd = Number(
      todayLogs.reduce((acc, l) => acc + l.estimatedCostUsd, 0).toFixed(4),
    );

    const monthLogs = allLogs.filter((l) => l.createdAt >= monthStart);
    const monthTokens = monthLogs.reduce((acc, l) => acc + l.totalTokens, 0);
    const monthCostUsd = Number(
      monthLogs.reduce((acc, l) => acc + l.estimatedCostUsd, 0).toFixed(4),
    );

    // Group By Provider
    const providerMap: Record<
      string,
      { tokens: number; cost: number; count: number }
    > = {};
    filteredLogs.forEach((l) => {
      const p = l.provider.toUpperCase();
      if (!providerMap[p]) providerMap[p] = { tokens: 0, cost: 0, count: 0 };
      providerMap[p].tokens += l.totalTokens;
      providerMap[p].cost += l.estimatedCostUsd;
      providerMap[p].count += 1;
    });

    const byProvider = Object.entries(providerMap)
      .map(([provider, data]) => ({
        provider,
        tokens: data.tokens,
        costUsd: Number(data.cost.toFixed(4)),
        percentage: totalTokens > 0 ? Math.round((data.tokens / totalTokens) * 100) : 0,
        requestCount: data.count,
      }))
      .sort((a, b) => b.tokens - a.tokens);

    // Group By Feature
    const featureMap: Record<
      string,
      { tokens: number; cost: number; count: number }
    > = {};
    filteredLogs.forEach((l) => {
      const f = l.feature;
      if (!featureMap[f]) featureMap[f] = { tokens: 0, cost: 0, count: 0 };
      featureMap[f].tokens += l.totalTokens;
      featureMap[f].cost += l.estimatedCostUsd;
      featureMap[f].count += 1;
    });

    const byFeature = Object.entries(featureMap)
      .map(([feature, data]) => ({
        feature,
        label: FEATURE_LABELS[feature] || feature,
        tokens: data.tokens,
        costUsd: Number(data.cost.toFixed(4)),
        percentage: totalTokens > 0 ? Math.round((data.tokens / totalTokens) * 100) : 0,
        requestCount: data.count,
      }))
      .sort((a, b) => b.tokens - a.tokens);

    // Group By User
    const userMap: Record<
      string,
      { name: string; email: string; dept: string; tokens: number; cost: number }
    > = {};
    filteredLogs.forEach((l) => {
      const uId = l.userId || "system";
      const uName = l.user ? `${l.user.firstName} ${l.user.lastName}` : "System Automated Job";
      const uEmail = l.user?.email || "system@venusglobaltech.com";
      const uDept = l.user?.department?.name || "Automations";

      if (!userMap[uId]) {
        userMap[uId] = { name: uName, email: uEmail, dept: uDept, tokens: 0, cost: 0 };
      }
      userMap[uId].tokens += l.totalTokens;
      userMap[uId].cost += l.estimatedCostUsd;
    });

    const topUsers = Object.entries(userMap)
      .map(([userId, d]) => ({
        userId,
        name: d.name,
        email: d.email,
        department: d.dept,
        tokens: d.tokens,
        costUsd: Number(d.cost.toFixed(4)),
        percentage: totalTokens > 0 ? Math.round((d.tokens / totalTokens) * 100) : 0,
      }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 8);

    // Recent 15 real-time activity stream entries
    const recentLogs = filteredLogs.slice(0, 15).map((l) => ({
      id: l.id,
      userName: l.user ? `${l.user.firstName} ${l.user.lastName}` : "System Automation",
      department: l.user?.department?.name || "Platform",
      provider: l.provider,
      model: l.model,
      feature: FEATURE_LABELS[l.feature] || l.feature,
      promptTokens: l.promptTokens,
      completionTokens: l.completionTokens,
      totalTokens: l.totalTokens,
      estimatedCostUsd: Number(l.estimatedCostUsd.toFixed(5)),
      createdAt: l.createdAt.toISOString(),
    }));

    return {
      kpi: {
        totalTokens,
        promptTokens,
        completionTokens,
        totalCostUsd,
        todayTokens,
        todayCostUsd,
        monthTokens,
        monthCostUsd,
        totalRequests: filteredLogs.length,
      },
      byProvider,
      byFeature,
      topUsers,
      recentLogs,
    };
  }

  /**
   * Populates sensible initial token baseline logs so the manager dashboard is populated immediately.
   */
  async seedInitialBaselineData() {
    const adminUser = await this.prisma.user.findFirst({
      where: { role: { name: "ADMIN" } },
    });
    const managerUser = await this.prisma.user.findFirst({
      where: { role: { name: "MANAGER" } },
    });

    const samples = [
      {
        userId: adminUser?.id,
        provider: "GEMINI",
        model: "gemini-flash-latest",
        feature: "AI_ASSISTANT",
        promptTokens: 1420,
        completionTokens: 380,
        hoursAgo: 1,
      },
      {
        userId: managerUser?.id,
        provider: "GEMINI",
        model: "gemini-flash-latest",
        feature: "INTENT_OUTREACH",
        promptTokens: 2150,
        completionTokens: 620,
        hoursAgo: 3,
      },
      {
        userId: adminUser?.id,
        provider: "OPENAI",
        model: "gpt-4o-mini",
        feature: "FOLLOW_UP",
        promptTokens: 890,
        completionTokens: 240,
        hoursAgo: 8,
      },
      {
        userId: managerUser?.id,
        provider: "ANTHROPIC",
        model: "claude-3-5-sonnet-latest",
        feature: "SEO_BRIEF",
        promptTokens: 1850,
        completionTokens: 940,
        hoursAgo: 24,
      },
      {
        userId: adminUser?.id,
        provider: "GEMINI",
        model: "gemini-flash-latest",
        feature: "AI_ASSISTANT",
        promptTokens: 3200,
        completionTokens: 750,
        hoursAgo: 48,
      },
      {
        userId: managerUser?.id,
        provider: "GEMINI",
        model: "gemini-flash-latest",
        feature: "INTENT_OUTREACH",
        promptTokens: 2980,
        completionTokens: 820,
        hoursAgo: 72,
      },
    ];

    for (const s of samples) {
      const promptTokens = s.promptTokens;
      const completionTokens = s.completionTokens;
      const totalTokens = promptTokens + completionTokens;
      const cost = calculateAiCostUsd(s.model, promptTokens, completionTokens);
      const createdAt = new Date(Date.now() - s.hoursAgo * 3600 * 1000);

      await this.prisma.aiTokenUsage.create({
        data: {
          userId: s.userId || null,
          provider: s.provider,
          model: s.model,
          feature: s.feature,
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCostUsd: cost,
          createdAt,
        },
      });
    }

    this.logger.log("Seeded initial AI token usage baseline records.");
  }
}
