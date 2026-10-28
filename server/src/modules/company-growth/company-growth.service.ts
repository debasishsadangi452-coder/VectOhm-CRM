import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { CompanyGrowthSignalStatus, CompanyGrowthSignalType, LeadSource } from "@prisma/client";
import type { ApolloHiringOrganization } from "../apollo-integration/apollo.service";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { ApolloService } from "../apollo-integration/apollo.service";
import { SequencesService } from "../sequences/sequences.service";
import { NewsApiAdapter } from "./adapters/newsapi.adapter";
import { CompanyNewsClassifierService } from "./company-news-classifier.service";
import { canUseSalesOutreach, SALES_OUTREACH_DEPARTMENT } from "../../common/utils/sales-access";
import type { RequestUser } from "../../common/types/request-user.type";

// A company needs this many new HiringSignal rows within the lookback
// window to count as "hiring velocity" worth flagging -- one job posting
// alone is noise, several in a couple weeks is a real pattern.
const HIRING_VELOCITY_THRESHOLD = 3;
const HIRING_VELOCITY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

// How far back to search for news per scan -- daily cron, so a few days'
// overlap catches anything published just before the last run without
// re-fetching the same month of history every time.
const NEWS_LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000;

// Minimum 6-month headcount growth (Apollo's own computed figure) to count
// as an expansion signal -- 10% in half a year is a real, visible pattern,
// not noise from a couple of hires/departures.
const APOLLO_HEADCOUNT_GROWTH_THRESHOLD = 0.1;

const GROWTH_SIGNALS_LINK = "/outreach?tab=growth-signals";

@Injectable()
export class CompanyGrowthService {
  private readonly logger = new Logger(CompanyGrowthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly apollo: ApolloService,
    private readonly sequences: SequencesService,
    private readonly newsApi: NewsApiAdapter,
    private readonly classifier: CompanyNewsClassifierService,
  ) {}

  // Called by HiringSignalsDiscoveryService right after it records new
  // HiringSignal rows for a company -- isolated (caller wraps this in its
  // own try/catch), never throws.
  async detectHiringVelocity(companyId: string): Promise<void> {
    const since = new Date(Date.now() - HIRING_VELOCITY_WINDOW_MS);

    const recentCount = await this.prisma.hiringSignal.count({
      where: { companyId, detectedAt: { gte: since } },
    });
    if (recentCount < HIRING_VELOCITY_THRESHOLD) return;

    // Don't refire within the same window -- HIRING_VELOCITY rows always
    // have sourceUrl=null so the DB @@unique constraint can't dedupe these
    // (see the model's own comment in schema.prisma); check in code instead.
    const alreadyFired = await this.prisma.companyGrowthSignal.findFirst({
      where: { companyId, type: CompanyGrowthSignalType.HIRING_VELOCITY, detectedAt: { gte: since } },
    });
    if (alreadyFired) return;

    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return;

    await this.prisma.companyGrowthSignal.create({
      data: {
        companyId,
        type: CompanyGrowthSignalType.HIRING_VELOCITY,
        summary: `${recentCount} new roles posted in the last 14 days`,
      },
    });

    await this.notifications.notifyDepartment(SALES_OUTREACH_DEPARTMENT, {
      type: "COMPANY_GROWTH_SIGNAL",
      title: "Hiring velocity signal",
      message: `${company.name} posted ${recentCount} new roles in the last 14 days — looks like they're expanding.`,
      link: GROWTH_SIGNALS_LINK,
    });
  }

  // Deterministic "who's expanding / hiring" straight from Apollo's own org
  // search data -- no news search, no LLM classification. Runs one Apollo
  // query per active HiringSignalAutomation, reusing its targetTitles/
  // locations (the same config a user already set up for that automation's
  // ICP), rather than introducing a separate config surface.
  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async scanApolloSignals(): Promise<{ automationsScanned: number; companiesChecked: number; signalsFound: number }> {
    const automations = await this.prisma.hiringSignalAutomation.findMany({ where: { isActive: true } });

    let companiesChecked = 0;
    let signalsFound = 0;
    for (const automation of automations) {
      try {
        const orgs = await this.apollo.searchHiringOrganizations({
          jobTitles: automation.targetTitles.length > 0 ? automation.targetTitles : undefined,
          locations: automation.locations.length > 0 ? automation.locations : undefined,
          minActiveJobs: 1,
          perPage: 10,
        });
        for (const org of orgs) {
          companiesChecked += 1;
          signalsFound += await this.recordApolloSignal(org, automation.targetTitles);
        }
      } catch (err) {
        this.logger.warn(
          `Apollo signal scan failed for automation "${automation.name}": ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    return { automationsScanned: automations.length, companiesChecked, signalsFound };
  }

  // Manual trigger -- same "Run now" pattern as the news scan and Hiring
  // Signals automations.
  async runApolloScanNow(user: RequestUser) {
    this.assertCanUse(user);
    return this.scanApolloSignals();
  }

  // Resolves/upserts the Company (Apollo's org id dedupes re-imports, same
  // as ApolloService.upsertCompany) and records whichever of the two
  // Apollo-native signal types apply. Returns how many new signals were
  // created (0, 1, or 2 -- a company can be both hiring and growing).
  private async recordApolloSignal(org: ApolloHiringOrganization, matchedTitles: string[]): Promise<number> {
    if (!org.name) return 0;

    const company = await this.prisma.company.upsert({
      where: { name: org.name },
      create: {
        name: org.name,
        domain: org.domain,
        employeeCount: org.employeeCount,
        apolloId: org.apolloId ?? undefined,
        source: LeadSource.APOLLO,
      },
      update: {
        domain: org.domain ?? undefined,
        employeeCount: org.employeeCount ?? undefined,
      },
    });

    const since = new Date(Date.now() - HIRING_VELOCITY_WINDOW_MS);
    let created = 0;

    // APOLLO_HIRING -- presence in the job-title-filtered results IS the
    // signal; Apollo doesn't expose a job-postings count to threshold on.
    const hiringAlreadyFired = await this.prisma.companyGrowthSignal.findFirst({
      where: { companyId: company.id, type: CompanyGrowthSignalType.APOLLO_HIRING, detectedAt: { gte: since } },
    });
    if (!hiringAlreadyFired) {
      await this.prisma.companyGrowthSignal.create({
        data: {
          companyId: company.id,
          type: CompanyGrowthSignalType.APOLLO_HIRING,
          summary: `Apollo reports active hiring for ${matchedTitles.length > 0 ? matchedTitles.join(", ") : "open roles"}`,
        },
      });
      created += 1;
      await this.notifications.notifyDepartment(SALES_OUTREACH_DEPARTMENT, {
        type: "COMPANY_GROWTH_SIGNAL",
        title: "Apollo hiring signal",
        message: `${company.name} is actively hiring, per Apollo.`,
        link: GROWTH_SIGNALS_LINK,
      });
    }

    if (org.headcountGrowth6mo != null && org.headcountGrowth6mo >= APOLLO_HEADCOUNT_GROWTH_THRESHOLD) {
      const growthAlreadyFired = await this.prisma.companyGrowthSignal.findFirst({
        where: {
          companyId: company.id,
          type: CompanyGrowthSignalType.APOLLO_HEADCOUNT_GROWTH,
          detectedAt: { gte: since },
        },
      });
      if (!growthAlreadyFired) {
        const pct = Math.round(org.headcountGrowth6mo * 100);
        await this.prisma.companyGrowthSignal.create({
          data: {
            companyId: company.id,
            type: CompanyGrowthSignalType.APOLLO_HEADCOUNT_GROWTH,
            summary: `Headcount grew ${pct}% over the last 6 months, per Apollo.`,
          },
        });
        created += 1;
        await this.notifications.notifyDepartment(SALES_OUTREACH_DEPARTMENT, {
          type: "COMPANY_GROWTH_SIGNAL",
          title: "Apollo headcount growth signal",
          message: `${company.name}: headcount grew ${pct}% in the last 6 months.`,
          link: GROWTH_SIGNALS_LINK,
        });
      }
    }

    return created;
  }

  // Daily news sweep -- skipped entirely if NEWSAPI_KEY is missing, same
  // "declared, optional integration" pattern as AdzunaAdapter.isConfigured()
  // gating the rest of the Hiring Signals module. Unlike the first version
  // of this method, ANTHROPIC_API_KEY being unset no longer skips the whole
  // scan -- every fetched article still gets a permanent
  // CompanyNewsArticleLog row (classified: false) so the NewsAPI half of
  // the pipeline is visibly working even before Claude is wired up; only
  // classification (and therefore signal creation) needs that key.
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async scanNews(): Promise<{ companiesScanned: number; articlesFetched: number; signalsFound: number }> {
    if (!this.newsApi.isConfigured()) {
      return { companiesScanned: 0, articlesFetched: 0, signalsFound: 0 };
    }

    // Bounded to companies Sales already cares about (already have a
    // HiringSignal or were Apollo-imported at some point) rather than every
    // CRM company -- keeps NewsAPI/Claude usage proportional to actual
    // outreach activity.
    const companies = await this.prisma.company.findMany({
      where: { OR: [{ hiringSignals: { some: {} } }, { apolloId: { not: null } }] },
      select: { id: true, name: true },
    });

    const since = new Date(Date.now() - NEWS_LOOKBACK_MS).toISOString().slice(0, 10);
    let articlesFetched = 0;
    let signalsFound = 0;
    for (const company of companies) {
      try {
        const result = await this.scanCompanyNews(company, since);
        articlesFetched += result.articlesFetched;
        signalsFound += result.signalsFound;
      } catch (err) {
        this.logger.warn(`News scan failed for ${company.name}: ${err instanceof Error ? err.message : err}`);
      }
    }
    return { companiesScanned: companies.length, articlesFetched, signalsFound };
  }

  // Manual trigger -- doesn't wait up to the cron interval, same pattern as
  // HiringSignalsDiscoveryService.runAutomation being both @Cron'd and
  // directly callable. Lets a Sales user confirm the pipeline is working
  // right now instead of waiting for 6am.
  async runNewsScanNow(user: RequestUser) {
    this.assertCanUse(user);
    return this.scanNews();
  }

  private async scanCompanyNews(
    company: { id: string; name: string },
    sinceISODate: string,
  ): Promise<{ articlesFetched: number; signalsFound: number }> {
    const articles = await this.newsApi.search(company.name, sinceISODate);
    let signalsFound = 0;

    for (const article of articles) {
      // Skip articles already logged for this company (also saves a Claude
      // call on repeat scans) -- checked by URL alone since one article can
      // only ever classify as one type. This is the article-level record,
      // independent of whether it ends up relevant.
      const existing = await this.prisma.companyNewsArticleLog.findUnique({
        where: { companyId_url: { companyId: company.id, url: article.url } },
      });
      if (existing) continue;

      // Write the log row first, unconditionally -- this is what makes the
      // NewsAPI half of the pipeline visible/auditable even with no
      // ANTHROPIC_API_KEY set yet.
      const logRow = await this.prisma.companyNewsArticleLog.create({
        data: {
          companyId: company.id,
          title: article.title,
          url: article.url,
          sourceName: article.sourceName,
          publishedAt: article.publishedAt ? new Date(article.publishedAt) : null,
        },
      });

      if (!this.classifier.isConfigured()) continue;

      const classification = await this.classifier.classify(company.name, article);
      await this.prisma.companyNewsArticleLog.update({
        where: { id: logRow.id },
        data: {
          classified: true,
          relevant: classification.relevant,
          signalType: classification.type ?? undefined,
        },
      });

      if (!classification.relevant || !classification.type || !classification.summary) continue;

      await this.prisma.companyGrowthSignal.create({
        data: {
          companyId: company.id,
          type: classification.type,
          summary: classification.summary,
          sourceUrl: article.url,
        },
      });
      signalsFound += 1;

      await this.notifications.notifyDepartment(SALES_OUTREACH_DEPARTMENT, {
        type: "COMPANY_GROWTH_SIGNAL",
        title: "New growth signal",
        message: `${company.name}: ${classification.summary}`,
        link: GROWTH_SIGNALS_LINK,
      });
    }

    return { articlesFetched: articles.length, signalsFound };
  }

  // Recent article-level record, independent of CompanyGrowthSignal --
  // shows every article NewsAPI returned whether or not it became a
  // signal, so "is the news pipeline actually working" is answerable
  // without waiting on Claude classification.
  async listNewsLog(user: RequestUser, filters: { companyId?: string }) {
    this.assertCanUse(user);
    return this.prisma.companyNewsArticleLog.findMany({
      where: { companyId: filters.companyId },
      orderBy: { fetchedAt: "desc" },
      take: 100,
      include: { company: { select: { id: true, name: true } } },
    });
  }

  async list(user: RequestUser, filters: { status?: CompanyGrowthSignalStatus; companyId?: string }) {
    this.assertCanUse(user);
    return this.prisma.companyGrowthSignal.findMany({
      where: {
        status: filters.status ?? CompanyGrowthSignalStatus.PENDING,
        companyId: filters.companyId,
      },
      orderBy: { detectedAt: "desc" },
      take: 100,
      include: {
        company: { select: { id: true, name: true, domain: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  // Explicit human decision to act on a signal -- resolves a contact (an
  // existing one with an email, else Apollo's decision-maker search, same
  // as HiringSignalsDiscoveryService.ensureContactAndEnroll) and enrolls
  // them in the chosen sequence via SequencesService.enroll -- the same,
  // already-battle-tested send mechanism the rest of Outreach uses. Nothing
  // gets emailed by any other path in this module.
  async accept(id: string, sequenceId: string, user: RequestUser) {
    this.assertCanUse(user);
    const signal = await this.getPendingOrThrow(id);

    let contact = await this.prisma.contact.findFirst({
      where: { companyId: signal.companyId, email: { not: null } },
    });

    if (!contact) {
      const decisionMaker = await this.apollo.findDecisionMakersForCompany(
        signal.company.name,
        signal.company.domain ?? undefined,
      );
      if (decisionMaker?.apolloId) {
        const [imported] = await this.apollo.importPeople({ apolloIds: [decisionMaker.apolloId] }, user);
        if (imported?.email) contact = imported;
      }
    }

    if (!contact?.email) {
      throw new BadRequestException(
        `Could not find a contact with an email address for ${signal.company.name}. Add one manually first.`,
      );
    }

    await this.sequences.enroll(sequenceId, { contactIds: [contact.id] }, user);

    return this.prisma.companyGrowthSignal.update({
      where: { id },
      data: {
        status: CompanyGrowthSignalStatus.ACCEPTED,
        sequenceId,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    });
  }

  async dismiss(id: string, user: RequestUser) {
    this.assertCanUse(user);
    await this.getPendingOrThrow(id);

    return this.prisma.companyGrowthSignal.update({
      where: { id },
      data: {
        status: CompanyGrowthSignalStatus.DISMISSED,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    });
  }

  private async getPendingOrThrow(id: string) {
    const signal = await this.prisma.companyGrowthSignal.findUnique({
      where: { id },
      include: { company: true },
    });
    if (!signal) {
      throw new NotFoundException("Growth signal not found");
    }
    if (signal.status !== CompanyGrowthSignalStatus.PENDING) {
      throw new BadRequestException("This signal has already been reviewed");
    }
    return signal;
  }

  private assertCanUse(user: RequestUser) {
    if (!canUseSalesOutreach(user)) {
      throw new ForbiddenException("Growth signals are only available to the Sales department");
    }
  }
}
