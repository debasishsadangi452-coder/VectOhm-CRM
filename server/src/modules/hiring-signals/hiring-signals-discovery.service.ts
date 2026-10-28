import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import {
  LeadSource,
  Prisma,
  type Company,
  type HiringSignalAutomation,
  type IntentEnrichedContact,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ApolloService } from "../apollo-integration/apollo.service";
import { SequencesService } from "../sequences/sequences.service";
import { GreenhouseAdapter } from "./adapters/greenhouse.adapter";
import { AshbyAdapter } from "./adapters/ashby.adapter";
import { LeverAdapter } from "./adapters/lever.adapter";
import { AdzunaAdapter } from "./adapters/adzuna.adapter";
import { CompanyGrowthService } from "../company-growth/company-growth.service";
import { deriveSlugCandidates } from "./adapters/slug-guesser.util";
import { scoreRolePriority } from "./role-priority.util";
import { canUseSalesOutreach, canUseIntentHiring, canUseSalesOrRecruitment } from "../../common/utils/sales-access";
import { toRequestUser } from "../../common/utils/to-request-user";
import type { DiscoveredJobPosting } from "./adapters/board-adapter.types";
import type { RequestUser } from "../../common/types/request-user.type";
import type { IntentHiringSearchDto } from "./dto/intent-hiring-search.dto";
import type { IntentNewsSearchDto } from "./dto/intent-news-search.dto";
import { NEWS_CATEGORY_LABELS, classifyNews, type NewsLeadCategory } from "./news-signal.util";
import type { EnrichIntentCompaniesDto } from "./dto/enrich-intent-companies.dto";
import type { EnrollIntentContactsDto } from "./dto/enroll-intent-contacts.dto";
import type { AutomateIntentEmailDto } from "./dto/automate-intent-email.dto";
import { BulkEmailService } from "../bulk-email/bulk-email.service";
import { BulkEmailEngineService } from "../bulk-email/bulk-email-engine.service";

// Shared shape for an Intent Hiring lead's decision-maker, both when built
// fresh by searchIntentHiring and when round-tripped through
// IntentSearchLead.initialDecisionMaker (a Prisma Json? column -- there's
// no way for Prisma to statically know a JSON column matches this specific
// shape, so reads/writes still need a cast, but at least a real one instead
// of `any`).
type IntentDecisionMaker = {
  apolloId?: string;
  name: string;
  firstName?: string;
  lastName?: string;
  title: string;
  email: string | null;
  phone?: string | null;
  phoneType?: "mobile" | "direct" | "office" | null;
  corporatePhone?: string | null;
  linkedinUrl: string | null;
  photoUrl?: string | null;
} | null;

const FOUNDER_EXEC_TITLES = [
  "CEO",
  "Chief Executive Officer",
  "Founder",
  "Co-Founder",
  "President",
  "Managing Director",
  "Owner",
  "Partner",
  "Chief Technology Officer",
  "CTO",
  "Chief Operating Officer",
  "COO",
];

const HR_TALENT_TITLES = [
  "Head of Human Resources",
  "Head of HR",
  "VP of Human Resources",
  "Director of Human Resources",
  "HR Director",
  "Human Resources Director",
  "Head of Talent",
  "Head of Talent Acquisition",
  "Director of Talent Acquisition",
  "Talent Acquisition Manager",
  "HR Manager",
  "Human Resources Manager",
  "Head of People",
  "VP People",
  "Chief People Officer",
  "Lead Recruiter",
  "Recruiting Manager",
  "Senior Technical Recruiter",
];

// Orchestrates: find companies with fresh hiring activity (discovery) ->
// resolve/upsert a real Company via Apollo -> find a real decision-maker via
// Apollo -> enroll them in the automation's Sequence. Every enrichment/send
// step below calls the SAME existing services a human uses from the
// Outreach UI (ApolloService, SequencesService) -- this module only adds the
// discovery step, which didn't exist before.
type BoardResult = { source: "GREENHOUSE" | "ASHBY" | "LEVER"; postings: DiscoveredJobPosting[] };

class SkipPersist extends Error {}

function isGenericMediaOrPlatform(companyName: string): boolean {
  const norm = companyName.toLowerCase();
  const generic = [
    "harvard business review",
    "hbr",
    "google",
    "alphabet",
    "facebook",
    "meta platforms",
    "apple",
    "amazon",
    "forbes",
    "bloomberg",
    "reuters",
    "business insider",
    "techcrunch",
    "yahoo",
  ];
  return generic.some((g) => norm.includes(g));
}

function buildTopicRegex(keywords: string): RegExp {
  const clean = keywords
    .replace(
      /\b(project\s+manager|program\s+manager|product\s+manager|manager|developer|engineer|administrator|admin|consultant|specialist|analyst|coordinator|director|head|lead|officer|architect|recruiter|intern)\b/gi,
      "",
    )
    .trim();
  const base = clean || keywords.trim();
  const lower = base.toLowerCase();

  if (lower === "erp" || lower.includes("erp")) {
    return /\b(erp|enterprise\s+resource\s+planning|sap|netsuite|infor|epicor|acumatica|sage|mrp|cloud\s+erp|workday|supply\s+chain)\b/i;
  }
  if (lower === "ai" || lower === "artificial intelligence") {
    return /\b(ai|artificial\s+intelligence|machine\s+learning|genai|llm|deep\s+learning|copilot)\b/i;
  }
  const tokens = base.split(/\s+/).filter((t) => t.length > 2);
  if (tokens.length === 0) return new RegExp(base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  return new RegExp(`\\b(${tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "i");
}

function hasLocationConflict(text: string, location?: string): boolean {
  if (!location) return false;
  const locLower = location.toLowerCase();

  if (locLower.includes("united states") || locLower === "us" || locLower === "usa") {
    const foreignMarkers =
      /\b(uae|abu\s+dhabi|dubai|emirati|saudi|qatar|kuwait|singapore|australia|uk|london|britain|germany|france|spain|italy|india|delhi|mumbai|bangalore|tokyo|japan|china|beijing)\b/i;
    if (foreignMarkers.test(text) && !/\b(us|usa|united\s+states|america|american)\b/i.test(text)) {
      return true;
    }
  }

  if (locLower.includes("india")) {
    const foreignMarkers = /\b(us|usa|united\s+states|california|new\s+york|texas|london|uk|germany)\b/i;
    if (foreignMarkers.test(text) && !/\b(india|indian|delhi|mumbai|bangalore|hyderabad|pune)\b/i.test(text)) {
      return true;
    }
  }

  return false;
}

@Injectable()
export class HiringSignalsDiscoveryService {
  private readonly logger = new Logger(HiringSignalsDiscoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly apollo: ApolloService,
    private readonly sequences: SequencesService,
    private readonly greenhouse: GreenhouseAdapter,
    private readonly ashby: AshbyAdapter,
    private readonly lever: LeverAdapter,
    private readonly adzuna: AdzunaAdapter,
    private readonly companyGrowth: CompanyGrowthService,
    private readonly bulkEmailService: BulkEmailService,
    private readonly bulkEmailEngine: BulkEmailEngineService,
  ) {}

  // Live real-time Intent Hiring search combining Adzuna live job openings
  // with Apollo decision-maker and executive email resolution.
  // Persists the search result to PostgreSQL so the UI can retain and display
  // old fetched data even after leaving the page until a new search is triggered.
  // `opts` exists for scheduled automations: they must never send mail to the
  // placeholder sample companies, and shouldn't overwrite the "latest search"
  // a person sees in the Intent Hiring page.
  async searchIntentHiring(
    dto: IntentHiringSearchDto,
    user: RequestUser,
    opts: { persist?: boolean; allowSamples?: boolean } = {},
  ) {
    if (!canUseIntentHiring(user)) {
      throw new ForbiddenException("Intent hiring search is only available to the Recruitment department");
    }

    const limit = Math.min(dto.maxResults ?? 25, 50);

    // 1. Search Adzuna for live job postings matching the role and location
    const adzunaMatches = await this.adzuna.search(dto.role, dto.location, undefined, limit);

    const rawMatches = [...adzunaMatches];

    // 2. If Adzuna returned 0 results, query Apollo for companies currently hiring for this role
    if (rawMatches.length === 0) {
      try {
        const apolloHiring = await this.apollo.searchHiringOrganizations({
          jobTitles: [dto.role],
          locations: dto.location ? [dto.location] : undefined,
          perPage: limit,
        });

        for (const org of apolloHiring) {
          if (!org.name) continue;
          rawMatches.push({
            companyName: org.name,
            externalJobId: org.apolloId || `apollo-${Math.random().toString(36).slice(2, 9)}`,
            title: dto.role,
            url: org.domain
              ? `https://${org.domain}/careers`
              : `https://www.google.com/search?q=${encodeURIComponent(`${org.name} careers ${dto.role}`)}`,
            location: dto.location || "Global",
            description: `Active hiring organization identified for ${dto.role}`,
            created: new Date().toISOString(),
          });
        }
      } catch (err) {
        this.logger.warn(`Apollo hiring search fallback: ${err}`);
      }
    }

    const leads: Array<{
      id: string;
      jobTitle: string;
      jobUrl: string;
      companyName: string;
      companyLocation?: string;
      companyDomain?: string;
      salary?: string;
      jobDescription?: string;
      discoveredAt: string;
      source: "ADZUNA" | "GREENHOUSE" | "ASHBY" | "LEVER";
      decisionMaker: IntentDecisionMaker;
    }> = [];

    // Deduplicate companies to avoid repeated queries
    const processedCompanies = new Map<
      string,
      { decisionMaker: typeof leads[0]["decisionMaker"]; domain?: string }
    >();

    for (const match of rawMatches) {
      if (leads.length >= limit) break;

      const normComp = match.companyName.toLowerCase().trim();
      const cached = processedCompanies.get(normComp);
      let decisionMaker: typeof leads[0]["decisionMaker"];
      let compDomain: string | undefined;

      if (cached !== undefined) {
        decisionMaker = cached.decisionMaker;
        compDomain = cached.domain;
      } else {
        // Query Apollo for decision-makers (CEO, Founder, VP, Director, HR, Talent Acquisition)
        const apolloPerson = await this.apollo.findDecisionMakersForCompany(match.companyName);
        if (apolloPerson) {
          decisionMaker = {
            apolloId: apolloPerson.apolloId,
            name: apolloPerson.name,
            firstName: apolloPerson.firstName,
            lastName: apolloPerson.lastName,
            title: apolloPerson.title,
            email: apolloPerson.email,
            phone: apolloPerson.phone ?? null,
            phoneType: apolloPerson.phoneType ?? null,
            corporatePhone: apolloPerson.corporatePhone ?? null,
            linkedinUrl: apolloPerson.linkedinUrl,
          };
          compDomain = apolloPerson.organizationDomain ?? undefined;
        } else {
          decisionMaker = null;
        }
        processedCompanies.set(normComp, { decisionMaker, domain: compDomain });
      }

      leads.push({
        id: `lead-${match.externalJobId || Math.random().toString(36).slice(2)}`,
        jobTitle: match.title,
        jobUrl: match.url,
        companyName: match.companyName,
        companyLocation: match.location || dto.location,
        companyDomain: compDomain,
        salary: match.salary,
        jobDescription: match.description,
        discoveredAt: match.created || new Date().toISOString(),
        source: "ADZUNA",
        decisionMaker: decisionMaker || null,
      });
    }

    // Persist search record & discovered jobs in the database
    try {
      if (opts.persist === false) throw new SkipPersist();
      await this.prisma.intentSearchRecord.create({
        data: {
          role: dto.role,
          location: dto.location || "Global",
          totalFound: leads.length,
          createdById: user.id,
          leads: {
            create: leads.map((l) => ({
              externalJobId: l.id,
              jobTitle: l.jobTitle,
              jobUrl: l.jobUrl,
              companyName: l.companyName,
              companyLocation: l.companyLocation,
              companyDomain: l.companyDomain,
              salary: l.salary,
              jobDescription: l.jobDescription,
              discoveredAt: new Date(l.discoveredAt),
              source: l.source,
              initialDecisionMaker: l.decisionMaker
                ? (l.decisionMaker as unknown as Prisma.InputJsonValue)
                : undefined,
            })),
          },
        },
      });
    } catch (dbErr) {
      if (!(dbErr instanceof SkipPersist)) {
        this.logger.warn(`Failed to persist intent search record to DB: ${dbErr}`);
      }
    }

    return {
      role: dto.role,
      location: dto.location || "Global",
      totalFound: leads.length,
      leads,
    };
  }

  // Intent News: companies with recent Apollo news (funding, expansion,
  // leadership change, ...) -> the same Apollo decision-maker lookup Intent
  // Hiring uses. Results use the IntentHiringLead shape (headline in
  // jobTitle, article link in jobUrl) so the existing enrich / outreach /
  // resolve-and-send steps work on them unchanged -- those are all keyed by
  // company, not by job.
  async searchIntentNews(dto: IntentNewsSearchDto, user: RequestUser) {
    if (!canUseIntentHiring(user)) {
      throw new ForbiddenException("Intent news search is only available to Recruitment and Sales");
    }

    const limit = Math.min(dto.maxResults ?? 25, 50);
    const daysBack = dto.daysBack ?? 30;
    const found = await this.apollo.searchNewsOrganizations({
      keywords: dto.keywords,
      locations: dto.location ? [dto.location] : undefined,
      daysBack,
      candidateCount: Math.min(Math.max(limit * 2, 50), 100),
    });

    type NewsArticleSummary = {
      title: string;
      url: string | null;
      publishedAt: string | null;
      category: NewsLeadCategory;
      categoryLabel: string;
    };
    type NewsLead = {
      id: string;
      jobTitle: string;
      jobUrl: string;
      companyName: string;
      companyLocation?: string;
      companyDomain?: string;
      jobDescription?: string;
      discoveredAt: string;
      source: "APOLLO_NEWS";
      newsCategory: NewsLeadCategory;
      newsCategoryLabel: string;
      newsArticles: NewsArticleSummary[];
      decisionMaker: IntentDecisionMaker;
    };

    const topicRegex = buildTopicRegex(dto.keywords);

    // Every article keeps a category (unrecognised headlines become "OTHER"),
    // so "any signal" shows all the news Apollo has, not just the pattern hits.
    const candidates: Array<Omit<NewsLead, "decisionMaker"> & { org: (typeof found.organizations)[number]["organization"] }> = [];
    for (const { organization, articles } of found.organizations) {
      const isGeneric = isGenericMediaOrPlatform(organization.name);

      const summaries: Array<NewsArticleSummary & { snippet: string | null; id: string | null; topicMatch: boolean }> = [];
      for (const article of articles) {
        // Discard articles that have a direct geographic conflict with the requested location
        if (hasLocationConflict(article.title, dto.location)) {
          continue;
        }

        const fullText = `${article.title} ${article.snippet ?? ""} ${article.labels.join(" ")}`;
        const topicMatch = topicRegex.test(fullText);

        // Discard generic publishers / mega-platforms (Google, HBR) if the article doesn't even mention the topic
        if (isGeneric && !topicMatch) {
          continue;
        }

        const categories = classifyNews(fullText);
        const category: NewsLeadCategory = dto.category
          ? categories.includes(dto.category)
            ? dto.category
            : "OTHER"
          : (categories[0] ?? "OTHER");

        summaries.push({
          title: article.title,
          url: article.url,
          publishedAt: article.publishedAt,
          category,
          categoryLabel: NEWS_CATEGORY_LABELS[category],
          snippet: article.snippet,
          id: article.id,
          topicMatch,
        });
      }

      if (summaries.length === 0) continue;

      // Filter by category if requested
      const matchingCategory = dto.category
        ? summaries.filter((x) => x.category === dto.category)
        : summaries;

      if (matchingCategory.length === 0) continue;

      // Pick best headline: prefer direct topic matches first, then newest
      matchingCategory.sort((a, b) => {
        if (a.topicMatch !== b.topicMatch) return a.topicMatch ? -1 : 1;
        return (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
      });

      const main = matchingCategory[0];
      if (!main) continue;

      candidates.push({
        id: `news-${organization.apolloId}-${main.id ?? candidates.length}`,
        jobTitle: main.title,
        jobUrl: main.url ?? "",
        companyName: organization.name,
        companyLocation: dto.location,
        companyDomain: organization.domain ?? undefined,
        jobDescription: main.snippet ?? undefined,
        discoveredAt: main.publishedAt ?? new Date().toISOString(),
        source: "APOLLO_NEWS",
        newsCategory: main.category,
        newsCategoryLabel: main.categoryLabel,
        newsArticles: summaries
          .filter((x) => x !== main)
          .slice(0, 5)
          .map(({ snippet: _s, id: _i, topicMatch: _t, ...rest }) => rest),
        org: organization,
      });
    }

    // Sort candidates:
    // 1. Topic matches first
    // 2. Specific signals before generic "OTHER"
    // 3. Newest discovery date
    candidates.sort((x, y) => {
      const xTopic = topicRegex.test(`${x.jobTitle} ${x.jobDescription ?? ""}`);
      const yTopic = topicRegex.test(`${y.jobTitle} ${y.jobDescription ?? ""}`);
      if (xTopic !== yTopic) return xTopic ? -1 : 1;

      const rank = (c: NewsLeadCategory) => (c === "OTHER" ? 1 : 0);
      return rank(x.newsCategory) - rank(y.newsCategory) || y.discoveredAt.localeCompare(x.discoveredAt);
    });
    const picked = candidates.slice(0, limit);

    // Decision-maker lookups run a few at a time; one failing never loses the row.
    const leads: NewsLead[] = [];
    const CONCURRENCY = 5;
    for (let i = 0; i < picked.length; i += CONCURRENCY) {
      const batch = await Promise.all(
        picked.slice(i, i + CONCURRENCY).map(async ({ org, ...lead }) => {
          let decisionMaker: IntentDecisionMaker = null;
          try {
            const person = await this.apollo.findDecisionMakersForCompany(org.name, org.domain ?? undefined);
            if (person) {
              decisionMaker = {
                apolloId: person.apolloId,
                name: person.name,
                firstName: person.firstName,
                lastName: person.lastName,
                title: person.title,
                email: person.email,
                phone: person.phone ?? null,
                phoneType: person.phoneType ?? null,
                corporatePhone: person.corporatePhone ?? null,
                linkedinUrl: person.linkedinUrl,
              };
            }
          } catch (err) {
            this.logger.warn(`Decision-maker lookup failed for ${org.name}: ${err}`);
          }
          return { ...lead, decisionMaker } as NewsLead;
        }),
      );
      leads.push(...batch);
    }

    return {
      keywords: dto.keywords,
      location: dto.location || "Global",
      category: dto.category ?? null,
      daysBack,
      totalFound: leads.length,
      candidatesChecked: found.candidatesChecked,
      articlesFound: found.articlesFound,
      leads,
    };
  }

  // Retrieves the most recent Intent Hiring search from the database so the UI
  // displays previous search results immediately when loaded or revisited.
  async getLatestIntentSearch(user: RequestUser) {
    if (!canUseIntentHiring(user)) {
      throw new ForbiddenException("Intent hiring search is only available to the Recruitment department");
    }

    const latest = await this.prisma.intentSearchRecord.findFirst({
      orderBy: { createdAt: "desc" },
      include: {
        leads: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!latest) {
      return null;
    }

    return {
      id: latest.id,
      role: latest.role,
      location: latest.location || "Global",
      totalFound: latest.totalFound,
      searchedAt: latest.createdAt.toISOString(),
      leads: latest.leads.map((lead) => ({
        id: lead.externalJobId || lead.id,
        jobTitle: lead.jobTitle,
        jobUrl: lead.jobUrl,
        companyName: lead.companyName,
        companyLocation: lead.companyLocation || undefined,
        companyDomain: lead.companyDomain || undefined,
        salary: lead.salary || undefined,
        jobDescription: lead.jobDescription || undefined,
        discoveredAt: lead.discoveredAt.toISOString(),
        source: lead.source as "ADZUNA" | "GREENHOUSE" | "ASHBY" | "LEVER",
        decisionMaker: lead.initialDecisionMaker as unknown as IntentDecisionMaker,
      })),
    };
  }

  // Apollo Batch Decision-Maker Enrichment:
  // Extracts company names from search data, queries Apollo for Founders & HR Leads,
  // reveals official emails & LinkedIn URLs, saves them in IntentEnrichedContact & CRM,
  // and optionally auto-enrolls them into an active Email Automation Sequence.
  async enrichCompaniesWithApollo(dto: EnrichIntentCompaniesDto, user: RequestUser) {
    if (!canUseSalesOrRecruitment(user)) {
      throw new ForbiddenException("Apollo enrichment is only available to the Recruitment and Sales departments");
    }

    let targetCompanies: Array<{ name: string; domain?: string; jobTitle?: string; jobUrl?: string }> = [];

    if (dto.companyNames && dto.companyNames.length > 0) {
      targetCompanies = dto.companyNames.map((name) => ({ name: name.trim() }));
    } else {
      // Pull companies from the latest search record
      const latest = await this.prisma.intentSearchRecord.findFirst({
        where: dto.searchRecordId ? { id: dto.searchRecordId } : undefined,
        orderBy: { createdAt: "desc" },
        include: { leads: true },
      });
      if (latest && latest.leads.length > 0) {
        const unique = new Map<string, { name: string; domain?: string; jobTitle?: string; jobUrl?: string }>();
        for (const l of latest.leads) {
          const key = l.companyName.trim().toLowerCase();
          if (!unique.has(key)) {
            unique.set(key, {
              name: l.companyName.trim(),
              domain: l.companyDomain || undefined,
              jobTitle: l.jobTitle,
              jobUrl: l.jobUrl,
            });
          }
        }
        targetCompanies = Array.from(unique.values());
      }
    }

    if (targetCompanies.length === 0) {
      return { enrichedCount: 0, autoEnrolledCount: 0, leads: [] };
    }

    const createdLeads: IntentEnrichedContact[] = [];
    let autoEnrolledCount = 0;

    for (const comp of targetCompanies) {
      try {
        const categories = [
          { type: "FOUNDER_EXEC", titles: FOUNDER_EXEC_TITLES },
          { type: "HR_TALENT", titles: HR_TALENT_TITLES },
        ];

        for (const cat of categories) {
          const person = await this.apollo.findDecisionMakersForCompany(comp.name, comp.domain, cat.titles);
          if (!person || !person.name) continue;

          // Avoid duplicate leads in DB
          const existingEnriched = await this.prisma.intentEnrichedContact.findFirst({
            where: {
              companyName: { equals: comp.name, mode: "insensitive" },
              personName: { equals: person.name, mode: "insensitive" },
            },
          });
          if (existingEnriched) {
            createdLeads.push(existingEnriched);
            continue;
          }

          // Upsert real CRM Company
          const company = await this.prisma.company.upsert({
            where: { name: comp.name },
            create: {
              name: comp.name,
              domain: person.organizationDomain || comp.domain || null,
              source: LeadSource.APOLLO,
            },
            update: {
              domain: person.organizationDomain || comp.domain || undefined,
            },
          });

          // Upsert real CRM Contact
          let contact = null;
          if (person.email) {
            contact = await this.prisma.contact.findFirst({ where: { email: person.email } });
          }
          if (!contact && person.apolloId) {
            contact = await this.prisma.contact.findUnique({ where: { apolloId: person.apolloId } });
          }

          if (contact) {
            contact = await this.prisma.contact.update({
              where: { id: contact.id },
              data: {
                firstName: person.firstName || contact.firstName,
                lastName: person.lastName || contact.lastName,
                title: person.title || contact.title,
                phone: person.phone || contact.phone,
                linkedinUrl: person.linkedinUrl || contact.linkedinUrl,
                companyId: company.id,
                source: LeadSource.APOLLO,
              },
            });
          } else {
            contact = await this.prisma.contact.create({
              data: {
                firstName: person.firstName || person.name.split(" ")[0] || "Executive",
                lastName: person.lastName || person.name.split(" ").slice(1).join(" ") || "",
                email: person.email,
                phone: person.phone,
                title: person.title,
                linkedinUrl: person.linkedinUrl,
                apolloId: person.apolloId,
                companyId: company.id,
                source: LeadSource.APOLLO,
              },
            });
          }

          // Save IntentEnrichedContact
          let enrichedRecord = await this.prisma.intentEnrichedContact.create({
            data: {
              companyName: comp.name,
              companyDomain: person.organizationDomain || comp.domain,
              personName: person.name,
              firstName: person.firstName,
              lastName: person.lastName,
              title: person.title,
              departmentCategory: cat.type,
              email: person.email,
              linkedinUrl: person.linkedinUrl,
              apolloId: person.apolloId,
              sourceJobTitle: comp.jobTitle,
              sourceJobUrl: comp.jobUrl,
              contactId: contact.id,
              createdById: user.id,
            },
          });

          // Auto-enroll into sequence if requested and email is present
          if (dto.autoEnrollSequenceId && contact.email) {
            try {
              const enrollRes = await this.sequences.enroll(
                dto.autoEnrollSequenceId,
                { contactIds: [contact.id] },
                user,
              );
              if (enrollRes && enrollRes[0]?.enrolled) {
                const seq = await this.prisma.sequence.findUnique({
                  where: { id: dto.autoEnrollSequenceId },
                  select: { name: true },
                });
                enrichedRecord = await this.prisma.intentEnrichedContact.update({
                  where: { id: enrichedRecord.id },
                  data: {
                    sequenceEnrolled: true,
                    autoEnrolledSequenceId: dto.autoEnrollSequenceId,
                    sequenceName: seq?.name,
                    enrolledAt: new Date(),
                  },
                });
                autoEnrolledCount++;
              }
            } catch (seqErr) {
              this.logger.warn(`Failed to auto-enroll contact ${contact.id} into sequence: ${seqErr}`);
            }
          }

          createdLeads.push(enrichedRecord);
        }
      } catch (err) {
        this.logger.warn(`Failed to enrich company ${comp.name}: ${err instanceof Error ? err.message : err}`);
      }
    }

    return {
      enrichedCount: createdLeads.length,
      autoEnrolledCount,
      leads: createdLeads,
    };
  }

  // Returns all saved decision makers / enriched leads
  async getEnrichedContacts(user: RequestUser) {
    if (!canUseSalesOrRecruitment(user)) {
      throw new ForbiddenException("Enriched contacts are only available to the Recruitment and Sales departments");
    }

    const rows = await this.prisma.intentEnrichedContact.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        contact: {
          select: {
            id: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    return rows.map((r) => ({
      ...r,
      phone: r.contact?.phone ?? null,
    }));
  }

  // Batch enrolls selected enriched decision makers into a specific email sequence
  async enrollEnrichedContacts(dto: EnrollIntentContactsDto, user: RequestUser) {
    if (!canUseSalesOrRecruitment(user)) {
      throw new ForbiddenException("Sequence enrollment is only available to the Recruitment and Sales departments");
    }

    const leads = await this.prisma.intentEnrichedContact.findMany({
      where: { id: { in: dto.leadIds } },
      include: { contact: true },
    });

    const contactIdsToEnroll: string[] = [];
    const leadMap = new Map<string, string>(); // contactId -> leadId

    for (const lead of leads) {
      if (lead.contactId) {
        contactIdsToEnroll.push(lead.contactId);
        leadMap.set(lead.contactId, lead.id);
      } else if (lead.email) {
        // Create CRM contact if missing
        const newContact = await this.prisma.contact.create({
          data: {
            firstName: lead.firstName || lead.personName.split(" ")[0] || "Executive",
            lastName: lead.lastName || lead.personName.split(" ").slice(1).join(" ") || "",
            email: lead.email,
            title: lead.title,
            linkedinUrl: lead.linkedinUrl,
            apolloId: lead.apolloId,
            source: LeadSource.APOLLO,
          },
        });
        contactIdsToEnroll.push(newContact.id);
        leadMap.set(newContact.id, lead.id);
        await this.prisma.intentEnrichedContact.update({
          where: { id: lead.id },
          data: { contactId: newContact.id },
        });
      }
    }

    if (contactIdsToEnroll.length === 0) {
      return { successCount: 0, results: [] };
    }

    const enrollResults = await this.sequences.enroll(
      dto.sequenceId,
      { contactIds: contactIdsToEnroll },
      user,
    );

    const seq = await this.prisma.sequence.findUnique({
      where: { id: dto.sequenceId },
      select: { name: true },
    });

    let successCount = 0;
    for (const res of enrollResults) {
      if (res.enrolled) {
        successCount++;
        const leadId = leadMap.get(res.contactId);
        if (leadId) {
          await this.prisma.intentEnrichedContact.update({
            where: { id: leadId },
            data: {
              sequenceEnrolled: true,
              autoEnrolledSequenceId: dto.sequenceId,
              sequenceName: seq?.name,
              enrolledAt: new Date(),
            },
          });
        }
      }
    }

    return {
      successCount,
      results: enrollResults,
    };
  }

  // Delete an enriched contact
  async deleteEnrichedContact(id: string, user: RequestUser) {
    if (!canUseSalesOrRecruitment(user)) {
      throw new ForbiddenException("Access denied");
    }
    await this.prisma.intentEnrichedContact.delete({ where: { id } });
    return { deleted: true };
  }

  // Per-lead, on-demand version of the same resolve-and-enroll flow
  // ensureContactAndEnroll uses for automations -- called from the Intent
  // Hiring results table's "Find contact & send" action, for a lead the
  // live search didn't already resolve a decision-maker for (Apollo lookup
  // failed, rate-limited, or hadn't finished in time). Explicit, single
  // click per lead -- same human-in-the-loop principle as
  // CompanyGrowthService.accept(): nothing sends until the user asks for
  // this specific company.
  async resolveAndSend(companyName: string, companyDomain: string | undefined, sequenceId: string, user: RequestUser) {
    if (!canUseSalesOrRecruitment(user)) {
      throw new ForbiddenException("Intent hiring outreach is only available to the Recruitment and Sales departments");
    }

    const decisionMaker = await this.apollo.findDecisionMakersForCompany(companyName, companyDomain);
    if (!decisionMaker?.apolloId) {
      throw new BadRequestException(`Could not find a decision-maker contact for ${companyName} via Apollo.`);
    }

    const [imported] = await this.apollo.importPeople({ apolloIds: [decisionMaker.apolloId] }, user);
    if (!imported?.email) {
      throw new BadRequestException(`Found a contact at ${companyName} but no email address was available.`);
    }

    await this.sequences.enroll(sequenceId, { contactIds: [imported.id] }, user);

    return {
      decisionMaker: {
        apolloId: decisionMaker.apolloId,
        name: decisionMaker.name,
        firstName: decisionMaker.firstName,
        lastName: decisionMaker.lastName,
        title: decisionMaker.title,
        email: imported.email,
        phone: imported.phone || decisionMaker.phone,
        phoneType: decisionMaker.phoneType,
        corporatePhone: decisionMaker.corporatePhone,
        linkedinUrl: decisionMaker.linkedinUrl,
      },
    };
  }
  // Safety-net batch run, same cadence class as JobBoardSyndicationService's
  // retry cron -- discovery isn't latency-sensitive, so every 6 hours is
  // plenty rather than hammering these public APIs constantly.
  @Cron(CronExpression.EVERY_6_HOURS)
  async handleCron() {
    const automations = await this.prisma.hiringSignalAutomation.findMany({ where: { isActive: true } });
    for (const automation of automations) {
      try {
        await this.runAutomationRecord(automation);
      } catch (err) {
        this.logger.error(
          `Hiring signal automation ${automation.id} failed: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  // Manual "run now" -- also usable by tests, same pattern as
  // SequenceEngineService.runOnce().
  async runAutomation(id: string, user: RequestUser) {
    if (!canUseSalesOutreach(user)) {
      throw new ForbiddenException("Hiring signal automations are only available to the Sales department");
    }
    const automation = await this.prisma.hiringSignalAutomation.findUnique({ where: { id } });
    if (!automation) {
      throw new NotFoundException("Hiring signal automation not found");
    }
    return this.runAutomationRecord(automation);
  }

  // Every candidate company costs at least one more Apollo call to resolve
  // (resolveCompany) and, if it's genuinely hiring, another for the people
  // search -- capped here so a broad keyword/industry match can't silently
  // burn through Apollo credits in a single run. Deliberately conservative;
  // raise it once a run's actual behavior/cost is understood.
  private static readonly MAX_CANDIDATES_PER_RUN = 5;

  private async runAutomationRecord(automation: HiringSignalAutomation) {
    const ownerUser = await this.loadOwnerAsRequestUser(automation.createdById);

    const candidateNames = new Set<string>();

    if (automation.industries.length > 0 || automation.locations.length > 0 || automation.keywords) {
      const orgs = await this.apollo.searchOrganizations(
        {
          keywords: automation.keywords || automation.industries.join(" "),
          locations: automation.locations,
          perPage: HiringSignalsDiscoveryService.MAX_CANDIDATES_PER_RUN,
        },
        ownerUser,
      );
      for (const org of orgs) candidateNames.add(org.name);
    }

    if (automation.adzunaEnabled && this.adzuna.isConfigured()) {
      // Route through the automation's own configured locations so the
      // scheduled/cron run searches the same market the user set up the
      // automation for, instead of falling back to determineCountryCode's
      // hardcoded default (which is not necessarily "us").
      const adzunaLocation = automation.locations.length > 0 ? automation.locations.join(" ") : undefined;
      for (const roleKeyword of automation.adzunaRoleKeywords) {
        const matches = await this.adzuna.search(roleKeyword, adzunaLocation);
        for (const match of matches) candidateNames.add(match.companyName);
      }
    }

    const candidatesToProcess = Array.from(candidateNames).slice(
      0,
      HiringSignalsDiscoveryService.MAX_CANDIDATES_PER_RUN,
    );

    let signalsFound = 0;
    for (const name of candidatesToProcess) {
      const company = await this.resolveCompany(name, ownerUser);
      if (!company) continue;

      const found = await this.findOpenPostings(company.name, company.domain);
      if (found.length === 0) continue;

      const newSignals = await this.recordSignals(company.id, automation.id, found);
      signalsFound += newSignals.length;

      if (newSignals.length > 0) {
        // Isolated per company -- e.g. no sender mailbox/HTTP fallback
        // connected yet (SequencesService.assertSenderConnected) shouldn't
        // abort every other candidate in this run, same isolation principle
        // as SequenceEngineService's per-enrollment processing.
        try {
          await this.ensureContactAndEnroll(company, automation, ownerUser);
        } catch (err) {
          this.logger.warn(
            `Could not enroll a contact for ${company.name}: ${err instanceof Error ? err.message : err}`,
          );
        }

        // Separately: check whether this company has now crossed the
        // hiring-velocity threshold worth flagging to all of Sales for
        // manual review (see CompanyGrowthService) -- distinct from the
        // auto-enroll above, and never lets a failure here break it.
        try {
          await this.companyGrowth.detectHiringVelocity(company.id);
        } catch (err) {
          this.logger.warn(
            `Hiring-velocity check failed for ${company.name}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    }

    await this.prisma.hiringSignalAutomation.update({
      where: { id: automation.id },
      data: { lastRunAt: new Date() },
    });

    return { candidatesChecked: candidatesToProcess.length, signalsFound };
  }

  // Resolves a bare company name to a real Company row with a real domain,
  // via Apollo's organization search + import (the same "reveal" flow the
  // Outreach UI's Companies tab already uses) -- never fabricates a domain.
  // Returns null if Apollo has no matching org with a usable domain.
  private async resolveCompany(name: string, ownerUser: RequestUser): Promise<Company | null> {
    const previews = await this.apollo.searchOrganizations({ name, perPage: 5 }, ownerUser);
    const withDomain = previews.find((p) => p.domain);
    if (!withDomain?.domain) return null;

    const [company] = await this.apollo.importOrganizations({ domains: [withDomain.domain] }, ownerUser);
    return company ?? null;
  }

  private async findOpenPostings(name: string, domain: string | null): Promise<BoardResult[]> {
    const slugs = deriveSlugCandidates(name, domain);
    const results: BoardResult[] = [];

    const tryAdapter = async (
      source: BoardResult["source"],
      lookup: (slug: string) => Promise<DiscoveredJobPosting[]>,
    ) => {
      for (const slug of slugs) {
        const postings = await lookup(slug);
        if (postings.length > 0) {
          results.push({ source, postings });
          return;
        }
      }
    };

    await Promise.all([
      tryAdapter("GREENHOUSE", (slug) => this.greenhouse.listOpenJobs(slug)),
      tryAdapter("ASHBY", (slug) => this.ashby.listOpenJobs(slug)),
      tryAdapter("LEVER", (slug) => this.lever.listOpenJobs(slug)),
    ]);

    return results;
  }

  // Idempotent via HiringSignal's @@unique([companyId, source, externalJobId])
  // -- re-running an automation against a company already checked only
  // creates rows for genuinely new postings.
  private async recordSignals(companyId: string, automationId: string, found: BoardResult[]) {
    const created = [];
    for (const { source, postings } of found) {
      for (const posting of postings) {
        const existing = await this.prisma.hiringSignal.findUnique({
          where: { companyId_source_externalJobId: { companyId, source, externalJobId: posting.externalJobId } },
        });
        if (existing) continue;

        created.push(
          await this.prisma.hiringSignal.create({
            data: {
              companyId,
              automationId,
              source,
              externalJobId: posting.externalJobId,
              jobTitle: posting.title,
              jobUrl: posting.url,
            },
          }),
        );
      }
    }
    return created;
  }

  // Top N decision-makers to find and enroll per company -- e.g. the
  // HR/Talent-Acquisition lead plus a backup, rather than betting the whole
  // outreach on a single contact who might not open the email.
  private static readonly CONTACTS_PER_COMPANY = 2;

  // Reuses existing enriched Contacts at this company first; tops up from
  // Apollo (ranked by scoreRolePriority) only for however many more are
  // needed to reach CONTACTS_PER_COMPANY. Never a guessed email --
  // unrevealed Apollo emails come back null, same honesty as the rest of
  // ApolloService -- and each contact is enrolled via the exact same
  // SequencesService.enroll() a human uses, which itself refuses to enroll a
  // contact with no real email.
  private async ensureContactAndEnroll(
    company: Company,
    automation: HiringSignalAutomation,
    ownerUser: RequestUser,
  ) {
    const target = HiringSignalsDiscoveryService.CONTACTS_PER_COMPANY;
    const contacts = await this.prisma.contact.findMany({
      where: { companyId: company.id, email: { not: null } },
      take: target,
    });

    if (contacts.length < target && company.domain) {
      const people = await this.apollo.searchPeople(
        { organizationDomains: [company.domain], personTitles: automation.targetTitles, perPage: 10 },
        ownerUser,
      );
      const ranked = [...people].sort((a, b) => scoreRolePriority(b.title) - scoreRolePriority(a.title));
      const alreadyHave = new Set(contacts.map((c) => c.apolloId).filter(Boolean));

      for (const candidate of ranked) {
        if (contacts.length >= target) break;
        if (alreadyHave.has(candidate.apolloId)) continue;

        const [imported] = await this.apollo.importPeople({ apolloIds: [candidate.apolloId] }, ownerUser);
        if (imported?.email) {
          contacts.push(imported);
          alreadyHave.add(candidate.apolloId);
        }
      }
    }

    for (const contact of contacts) {
      if (!contact.email) continue;
      await this.sequences.enroll(automation.sequenceId, { contactIds: [contact.id] }, ownerUser);
    }
  }

  // Automates email outreach for selected Intent Hiring leads using a chosen template
  // or custom template with exact company and decision maker credentials merged.
  async automateIntentEmail(dto: AutomateIntentEmailDto, user: RequestUser) {
    if (!canUseSalesOrRecruitment(user)) {
      throw new ForbiddenException("Email automation is only available to the Recruitment and Sales departments");
    }

    if (!dto.leads || dto.leads.length === 0) {
      throw new BadRequestException("No leads selected for email automation");
    }

    const contactIds: string[] = [];
    const rawEmails: string[] = [];
    const processedLeads: Array<{ companyName: string; email: string; personName: string; status: string }> = [];

    for (const lead of dto.leads) {
      const email = lead.decisionMaker?.email?.trim().toLowerCase();
      if (!email) continue;

      // Find or create Company
      let company = await this.prisma.company.findFirst({
        where: { name: { equals: lead.companyName.trim(), mode: "insensitive" } },
      });

      if (!company) {
        company = await this.prisma.company.create({
          data: {
            name: lead.companyName.trim(),
            domain: lead.companyDomain || null,
          },
        });
      }

      // Extract First and Last Name
      let firstName = lead.decisionMaker?.firstName?.trim() || "";
      let lastName = lead.decisionMaker?.lastName?.trim() || "";
      if (!firstName && lead.decisionMaker?.name) {
        const parts = lead.decisionMaker.name.trim().split(/\s+/);
        firstName = parts[0] || "Hiring";
        lastName = parts.slice(1).join(" ") || "Manager";
      }
      if (!firstName) firstName = "Hiring";
      if (!lastName) lastName = "Manager";

      // Find or upsert contact
      let contact = await this.prisma.contact.findFirst({
        where: { email },
      });

      if (!contact) {
        contact = await this.prisma.contact.create({
          data: {
            email,
            firstName,
            lastName,
            phone: lead.decisionMaker?.phone?.trim() || null,
            title: lead.decisionMaker?.title?.trim() || "Decision Maker",
            companyId: company.id,
            source: LeadSource.MANUAL,
          },
        });
      } else {
        const updateData: Prisma.ContactUncheckedUpdateInput = {};
        if (!contact.companyId) updateData.companyId = company.id;
        if (!contact.title && lead.decisionMaker?.title?.trim()) {
          updateData.title = lead.decisionMaker.title.trim();
        }
        if (!contact.phone && lead.decisionMaker?.phone?.trim()) {
          updateData.phone = lead.decisionMaker.phone.trim();
        }
        if (Object.keys(updateData).length > 0) {
          contact = await this.prisma.contact.update({
            where: { id: contact.id },
            data: updateData,
          });
        }
      }

      contactIds.push(contact.id);
      processedLeads.push({
        companyName: lead.companyName,
        email,
        personName: `${firstName} ${lastName}`.trim(),
        status: "QUEUED",
      });
    }

    if (contactIds.length === 0 && rawEmails.length === 0) {
      throw new BadRequestException(
        "None of the selected companies have valid email addresses. Please verify/enrich contacts first.",
      );
    }

    const campaignName =
      dto.campaignName?.trim() ||
      `Intent Hiring Outreach: ${dto.leads[0]?.jobTitle || "Lead"} (${new Date().toLocaleDateString()})`;

    // Create the bulk email campaign
    const campaign = await this.bulkEmailService.create(
      {
        name: campaignName,
        templateId: dto.templateId,
        subject: dto.customSubject,
        bodyHtml: dto.customBodyHtml,
        appendSignature: dto.appendSignature ?? true,
        contactIds,
        rawEmails,
      },
      user,
    );

    // Trigger runOnce immediately so emails go out without waiting
    let processed = 0;
    try {
      const runRes = await this.bulkEmailEngine.runOnce();
      processed = runRes.processed;
    } catch (err) {
      this.logger.warn(`Failed to run bulk email engine immediately: ${err instanceof Error ? err.message : err}`);
    }

    return {
      campaignId: campaign.id,
      campaignName: campaign.name,
      totalRecipients: contactIds.length + rawEmails.length,
      processedImmediately: processed,
      recipients: processedLeads,
    };
  }

  private async loadOwnerAsRequestUser(userId: string): Promise<RequestUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { role: true, department: true },
    });
    return toRequestUser(user);
  }
}
