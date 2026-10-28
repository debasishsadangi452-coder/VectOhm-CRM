import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ApolloService } from "../apollo-integration/apollo.service";
import { IngestScrapedArticleDto } from "./dto/ingest-scraped-article.dto";
import { classifyIntentNews } from "./intent-news-classifier.util";
import { analyzeIntentItems, isIntentAiConfigured, tierFor, type IntentAiResult } from "./intent-news-ai";
import type { RequestUser } from "../../common/types/request-user.type";

@Injectable()
export class IntentNewsScraperService {
  private readonly logger = new Logger(IntentNewsScraperService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly apollo: ApolloService,
  ) {}

  // `origin` is a server-side argument, not part of the DTO, so a browser client can't claim it.
  // `ai` is passed by the crawler, which has already analysed the item in a
  // batch; otherwise the article is analysed here when an AI key is set.
  async ingestScrapedArticle(
    dto: IngestScrapedArticleDto,
    user?: RequestUser,
    origin: "EXTENSION" | "CRAWLER" = "EXTENSION",
    ai?: IntentAiResult | null,
  ) {
    if (ai === undefined && isIntentAiConfigured()) {
      try {
        [ai] = await analyzeIntentItems([{ title: dto.articleTitle, source: dto.sourceDomain, text: dto.rawContent || dto.keySnippet }]);
      } catch (err: any) {
        this.logger.warn(`AI intent analysis failed, using keyword scoring: ${err?.message}`);
      }
    }

    // 1. Classify intent news (with special emphasis on ERP AI); AI wins when it answered.
    const classification = classifyIntentNews(dto.articleTitle, dto.rawContent || dto.keySnippet);

    const isErpAiPriority = ai ? ai.signalType === "ERP_AI" : classification.isErpAiPriority || dto.isErpAiPriority === true;
    const tier = ai ? tierFor(ai) : classification.tier;
    const intentScore = ai ? ai.intentScore : classification.intentScore;
    const signalType = ai?.signalType ?? (isErpAiPriority ? "ERP_AI" : null);
    const erpVendors = Array.from(new Set([...(ai?.erpVendors || []), ...(dto.erpVendors || []), ...classification.erpVendors]));
    const aiKeywords = Array.from(new Set([...(ai?.aiKeywords || []), ...(dto.aiKeywords || []), ...classification.aiKeywords]));
    const targetedRoles = ai?.targetedRoles.length
      ? ai.targetedRoles
      : Array.from(new Set([...(dto.targetedRoles || []), ...classification.targetedRoles]));
    const signalSummary = ai?.summary || dto.keySnippet || classification.signalSummary;
    if (ai?.companyDomain && !dto.companyDomain) dto.companyDomain = ai.companyDomain;

    // 2. Resolve or create Company
    let companyId: string | undefined;
    const companyName = (ai?.companyName || dto.companyName || "").trim();

    if (companyName) {
      let company = await this.prisma.company.findFirst({
        where: {
          OR: [
            { name: { equals: companyName, mode: "insensitive" as Prisma.QueryMode } },
            ...(dto.companyDomain ? [{ domain: { equals: dto.companyDomain.toLowerCase(), mode: "insensitive" as Prisma.QueryMode } }] : []),
          ],
        },
      });

      if (!company) {
        try {
          company = await this.prisma.company.create({
            data: {
              name: companyName,
              domain: dto.companyDomain ? dto.companyDomain.toLowerCase() : null,
              notes: `Auto-created from Intent Scraper: ${dto.articleTitle.slice(0, 100)}`,
            },
          });
        } catch {
          // Fallback if concurrent insert
          company = await this.prisma.company.findFirst({
            where: { name: { equals: companyName, mode: "insensitive" as Prisma.QueryMode } },
          });
        }
      }
      companyId = company?.id;
    }

    // 3. Find Decision-Makers (Apollo integration)
    let decisionMaker: any = null;
    if (dto.autoFindDecisionMakers !== false && companyName) {
      try {
        const priorityTitles = isErpAiPriority
          ? [
              "Chief Information Officer",
              "CIO",
              "VP of Enterprise Applications",
              "Director of Enterprise Applications",
              "Director of ERP",
              "Director of SAP",
              "VP Information Technology",
              "Head of IT",
              "Chief Technology Officer",
              "CTO",
            ]
          : [
              "Chief Information Officer",
              "Chief Technology Officer",
              "CTO",
              "VP of Engineering",
              "Head of Human Resources",
              "Chief Executive Officer",
              "CEO",
            ];

        const match = await this.apollo.findDecisionMakersForCompany(
          companyName,
          dto.companyDomain,
          priorityTitles,
        );

        if (match) {
          decisionMaker = {
            name: match.name,
            title: match.title || "Enterprise Leader",
            email: match.email || null,
            linkedinUrl: match.linkedinUrl || null,
            apolloId: match.apolloId || null,
            corporatePhone: match.corporatePhone || match.phone || null,
          };
        }
      } catch (err: any) {
        this.logger.warn(`Apollo decision-maker search failed for ${companyName}: ${err?.message}`);
      }
    }

    // 4. Draft personalized outreach pitch
    let aiDraftedEmail: string | null = null;
    if (dto.autoDraftEmail !== false) {
      const recipientName = decisionMaker?.name ? decisionMaker.name.split(" ")[0] : "Leader";
      const orgName = companyName || "your team";

      if (isErpAiPriority) {
        const vendorsStr = erpVendors.length > 0 ? erpVendors.join(" / ") : "enterprise ERP";
        aiDraftedEmail = `Subject: Accelerating ${orgName}'s ${vendorsStr} & AI modernization initiatives\n\n` +
          `Hi ${recipientName},\n\n` +
          `I came across the recent announcement regarding ${orgName}'s digital transformation and strategic investment in ${vendorsStr} and AI capabilities.\n\n` +
          `Scaling modern ERP architectures while integrating autonomous AI workflows often creates critical delivery bottlenecks around certified senior architects, data pipelines, and migration specialists.\n\n` +
          `We support enterprise leaders by providing pre-vetted senior ${erpVendors[0] || "ERP"} and Enterprise AI integration teams, cutting implementation rollout timelines by up to 40%.\n\n` +
          `Would you be open to a brief 10-minute introductory conversation this week to see how we've helped similar organizations accelerate their digital roadmaps?\n\n` +
          `Best regards,`;
      } else {
        aiDraftedEmail = `Subject: Regarding ${orgName}'s recent milestone & scaling initiatives\n\n` +
          `Hi ${recipientName},\n\n` +
          `I noticed the recent news regarding ${orgName}'s rapid growth and strategic expansion. Congratulations on the momentum!\n\n` +
          `As organizations scale critical operations, maintaining delivery speed and accessing specialized technical talent becomes a top operational priority.\n\n` +
          `We partner with fast-growing technology and enterprise organizations to provide high-velocity technical teams and workforce automation.\n\n` +
          `Do you have 10 minutes on Tuesday or Thursday for a quick introductory chat?\n\n` +
          `Best regards,`;
      }
    }

    // 5. Upsert Scraped Article in PostgreSQL
    const existing = await this.prisma.scrapedIntentArticle.findUnique({
      where: { url: dto.articleUrl },
    });

    if (existing) {
      return this.prisma.scrapedIntentArticle.update({
        where: { id: existing.id },
        data: {
          title: dto.articleTitle,
          domain: dto.sourceDomain,
          publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : undefined,
          rawContent: dto.rawContent,
          keySnippet: signalSummary,
          signalType,
          tier,
          isErpAiPriority,
          intentScore,
          erpVendors,
          aiKeywords,
          targetedRoles,
          companyName,
          companyDomain: dto.companyDomain,
          companyId,
          discoveredById: user?.id,
          decisionMaker: decisionMaker || existing.decisionMaker,
          aiDraftedEmail: aiDraftedEmail || existing.aiDraftedEmail,
          status: decisionMaker?.email ? "ENRICHED" : existing.status,
        },
        include: { company: true },
      });
    }

    return this.prisma.scrapedIntentArticle.create({
      data: {
        title: dto.articleTitle,
        url: dto.articleUrl,
        domain: dto.sourceDomain,
        origin,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : new Date(),
        rawContent: dto.rawContent,
        keySnippet: signalSummary,
        signalType,
        tier,
        isErpAiPriority,
        intentScore,
        erpVendors,
        aiKeywords,
        targetedRoles,
        companyName,
        companyDomain: dto.companyDomain,
        companyId,
        discoveredById: user?.id,
        decisionMaker,
        aiDraftedEmail,
        status: decisionMaker?.email ? "ENRICHED" : "NEW",
      },
      include: { company: true },
    });
  }

  async listScrapedArticles(filters: {
    isErpAiPriority?: boolean;
    tier?: string;
    status?: string;
    search?: string;
    take?: number;
    skip?: number;
  }) {
    const where: any = {};

    if (filters.isErpAiPriority !== undefined) {
      where.isErpAiPriority = filters.isErpAiPriority;
    }

    if (filters.tier) {
      where.tier = filters.tier;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: "insensitive" } },
        { companyName: { contains: filters.search, mode: "insensitive" } },
        { keySnippet: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const [total, articles] = await Promise.all([
      this.prisma.scrapedIntentArticle.count({ where }),
      this.prisma.scrapedIntentArticle.findMany({
        where,
        take: filters.take || 50,
        skip: filters.skip || 0,
        orderBy: [
          { isErpAiPriority: "desc" },
          { intentScore: "desc" },
          { createdAt: "desc" },
        ],
        include: { company: { select: { id: true, name: true, domain: true } } },
      }),
    ]);

    return { total, articles };
  }

  // Crawler-found articles whose full text the server could not read (Google
  // News links only resolve in a real browser); the extension's auto-browse
  // mode opens these and posts the text back through ingest.
  async listNeedsFullText(take: number) {
    return this.prisma.scrapedIntentArticle.findMany({
      where: { rawContent: null, createdAt: { gte: new Date(Date.now() - 3 * 24 * 3600_000) } },
      orderBy: [{ intentScore: "desc" }, { createdAt: "desc" }],
      take,
      select: { id: true, url: true, title: true },
    });
  }

  async getSummaryStats() {
    const [total, erpAiCount, enrichedCount] = await Promise.all([
      this.prisma.scrapedIntentArticle.count(),
      this.prisma.scrapedIntentArticle.count({ where: { isErpAiPriority: true } }),
      this.prisma.scrapedIntentArticle.count({ where: { status: "ENRICHED" } }),
    ]);

    return {
      total,
      erpAiCount,
      enrichedCount,
      standardCount: total - erpAiCount,
    };
  }

  async updateStatus(id: string, status: string) {
    const article = await this.prisma.scrapedIntentArticle.findUnique({ where: { id } });
    if (!article) throw new NotFoundException("Scraped intent article not found");

    return this.prisma.scrapedIntentArticle.update({
      where: { id },
      data: { status },
    });
  }

  async deleteArticle(id: string) {
    const article = await this.prisma.scrapedIntentArticle.findUnique({ where: { id } });
    if (!article) throw new NotFoundException("Scraped intent article not found");

    await this.prisma.scrapedIntentArticle.delete({ where: { id } });
    return { success: true };
  }

  async recalculateAllScores() {
    const articles = await this.prisma.scrapedIntentArticle.findMany();
    const updated = [];
    for (const article of articles) {
      const classification = classifyIntentNews(article.title, article.rawContent || article.keySnippet || undefined);
      const res = await this.prisma.scrapedIntentArticle.update({
        where: { id: article.id },
        data: {
          intentScore: classification.intentScore,
          tier: classification.tier,
          isErpAiPriority: classification.isErpAiPriority,
          erpVendors: classification.erpVendors,
          aiKeywords: classification.aiKeywords,
          targetedRoles: classification.targetedRoles,
        },
      });
      updated.push({ id: res.id, title: res.title, domain: res.domain, score: res.intentScore, tier: res.tier });
    }
    return { count: updated.length, articles: updated };
  }
}
