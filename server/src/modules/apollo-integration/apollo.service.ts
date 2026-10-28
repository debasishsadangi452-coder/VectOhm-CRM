import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { LeadSource, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ApolloConnectionService, APOLLO_API } from "./apollo-connection.service";
import { ApolloOrganizationSearchDto, ApolloPeopleSearchDto } from "./dto/apollo-search.dto";
import { ImportApolloOrganizationsDto, ImportApolloPeopleDto } from "./dto/import-apollo.dto";
import { canUseSalesOutreach } from "../../common/utils/sales-access";
import type { RequestUser } from "../../common/types/request-user.type";

// Apollo's search endpoints return a cheap, obfuscated PREVIEW (no email, no
// organization id, last name partially masked) -- full contact/org data only
// comes back from the "reveal" endpoints (people/match, organizations/enrich),
// which cost Apollo credits. So: browsing a search is free, and only
// import/enrich (an explicit user action) ever calls the reveal endpoints.
export interface ApolloPersonPreview {
  apolloId: string;
  firstName: string;
  lastNamePreview: string | null; // real last name if Apollo already exposed it, else an obfuscated hint (e.g. "Pr***i"), else null
  title: string | null;
  organizationName: string | null;
}

export interface ApolloOrganizationPreview {
  apolloId: string | null; // absent on unrevealed company-search results
  name: string;
  domain: string | null;
  industry: string | null;
  employeeCount: number | null;
}

// Apollo's own org search response includes these fields already (no extra
// credit cost, same free preview endpoint as searchOrganizations) -- used
// by CompanyGrowthService for deterministic "hiring / expanding" signals
// straight from Apollo, instead of news search + LLM classification.
// Note: Apollo's org search lets you FILTER by "has active job postings for
// title X" (organization_num_jobs_range / q_organization_job_titles -- real,
// documented filters, confirmed against the live API) but does not return a
// job-postings COUNT per organization -- there is no such field in the
// response. So "hiring" here is a yes/no (the org matched the filter),
// never a number.
export interface ApolloHiringOrganization {
  apolloId: string | null;
  name: string;
  domain: string | null;
  employeeCount: number | null;
  headcountGrowth6mo: number | null;
  headcountGrowth12mo: number | null;
}

const NEWS_PAGE_SIZE = 25;
const NEWS_MAX_PAGES = 4;
// Apollo caps organization_ids at 10 per request (a larger value returns 422: "Too many organization_ids")
const NEWS_ORG_BATCH = 10;

export interface ApolloNewsArticle {
  id: string | null;
  title: string;
  url: string | null;
  publishedAt: string | null;
  snippet: string | null;
  // Whatever labels Apollo attached; classification doesn't depend on them.
  labels: string[];
}

export interface ApolloNewsOrganization {
  organization: ApolloHiringOrganization;
  articles: ApolloNewsArticle[];
}

export interface ApolloNewsSearchResult {
  organizations: ApolloNewsOrganization[];
  candidatesChecked: number;
  articlesFound: number;
}

export interface ApolloOrganizationDetail {
  apolloId: string;
  name: string;
  domain: string | null;
  industry: string | null;
  employeeCount: number | null;
  linkedinUrl: string | null;
}

export interface ApolloPersonDetail {
  apolloId: string;
  firstName: string;
  lastName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  phoneType: "mobile" | "direct" | "office" | null;
  corporatePhone: string | null;
  linkedinUrl: string | null;
  organization: ApolloOrganizationDetail | null;
}

@Injectable()
export class ApolloService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly connection: ApolloConnectionService,
  ) {}

  async searchPeople(filters: ApolloPeopleSearchDto, user: RequestUser): Promise<ApolloPersonPreview[]> {
    this.assertCanUse(user);

    return this.cached("people-search", filters, async () => {
      const apiKey = await this.connection.requireApiKey();
      const res = await this.apolloFetch("/mixed_people/api_search", apiKey, {
        method: "POST",
        body: JSON.stringify({
          person_titles: filters.personTitles,
          q_organization_domains: filters.organizationDomains?.join("\n"),
          person_locations: filters.locations,
          q_keywords: filters.keywords,
          page: filters.page ?? 1,
          per_page: filters.perPage ?? 25,
        }),
      });

      if (!res.ok) {
        throw new BadRequestException(
          `Apollo people search failed (${res.status}): ${await safeErrorMessage(res)}`,
        );
      }

      const body = (await res.json()) as { people?: unknown[] };
      return (body.people ?? []).map(normalizePersonPreview);
    });
  }

  async searchOrganizations(
    filters: ApolloOrganizationSearchDto,
    user: RequestUser,
  ): Promise<ApolloOrganizationPreview[]> {
    this.assertCanUse(user);

    return this.cached("organization-search", filters, async () => {
      const apiKey = await this.connection.requireApiKey();
      const res = await this.apolloFetch("/mixed_companies/search", apiKey, {
        method: "POST",
        body: JSON.stringify({
          q_organization_name: filters.name,
          organization_locations: filters.locations,
          q_keywords: filters.keywords,
          page: filters.page ?? 1,
          per_page: filters.perPage ?? 25,
        }),
      });

      if (!res.ok) {
        throw new BadRequestException(
          `Apollo organization search failed (${res.status}): ${await safeErrorMessage(res)}`,
        );
      }

      const body = (await res.json()) as { organizations?: unknown[]; accounts?: unknown[] };
      const raw = body.organizations ?? body.accounts ?? [];
      return raw.map(normalizeOrganizationPreview);
    });
  }

  // System/cron use (no RequestUser -- same as findDecisionMakersForCompany)
  // by CompanyGrowthService. Uses the same free preview endpoint as
  // searchOrganizations (organization_num_jobs_range / q_organization_job_titles
  // are real, documented Apollo search filters -- "# Active Job Postings" /
  // "Currently Hiring For" in Apollo's own UI), just with different filters
  // and reading a few extra fields Apollo already returns but
  // normalizeOrganizationPreview doesn't expose. Deliberately uncached
  // (unlike searchOrganizations): this runs from a scheduled scan over a
  // rotating set of companies, not a repeated user query, so cache hits
  // would be rare and the DB round-trip isn't worth it.
  async searchHiringOrganizations(filters: {
    jobTitles?: string[];
    locations?: string[];
    minActiveJobs?: number;
    perPage?: number;
  }): Promise<ApolloHiringOrganization[]> {
    const apiKey = await this.connection.requireApiKey();
    const res = await this.apolloFetch("/mixed_companies/search", apiKey, {
      method: "POST",
      body: JSON.stringify({
        q_organization_job_titles: filters.jobTitles?.length ? filters.jobTitles : undefined,
        organization_num_jobs_range: { min: filters.minActiveJobs ?? 1 },
        organization_locations: filters.locations?.length ? filters.locations : undefined,
        page: 1,
        per_page: filters.perPage ?? 25,
      }),
    });

    if (!res.ok) {
      throw new BadRequestException(`Apollo hiring-organization search failed (${res.status}): ${await safeErrorMessage(res)}`);
    }

    const body = (await res.json()) as { organizations?: unknown[]; accounts?: unknown[] };
    const raw = body.organizations ?? body.accounts ?? [];
    return raw.map(normalizeHiringOrganization);
  }

  // Intent News: companies matching an industry/location with recent news
  // coverage. Real Apollo calls only -- organization search for candidates
  // (several pages), then News Articles Search for those organizations over
  // the date window, in batches. Returns every article found (classification
  // happens later, so unrecognised headlines are kept, not dropped) plus
  // counts so the UI can explain an empty result.
  async searchNewsOrganizations(filters: {
    keywords: string;
    locations?: string[];
    daysBack: number;
    candidateCount: number;
  }): Promise<ApolloNewsSearchResult> {
    const apiKey = await this.connection.requireApiKey();

    const wanted = Math.min(filters.candidateCount, 300);
    const orgs: ApolloHiringOrganization[] = [];
    const seen = new Set<string>();

    const fetchBatch = async (queryText: string) => {
      for (let page = 1; orgs.length < wanted; page++) {
        const orgRes = await this.apolloFetch("/mixed_companies/search", apiKey, {
          method: "POST",
          body: JSON.stringify({
            q_keywords: queryText,
            organization_locations: filters.locations?.length ? filters.locations : undefined,
            page,
            per_page: Math.min(wanted - orgs.length, 100),
          }),
        });
        if (!orgRes.ok) {
          if (orgs.length > 0) break;
          throw new BadRequestException(
            `Apollo organization search failed (${orgRes.status}): ${await safeErrorMessage(orgRes)}`,
          );
        }
        const orgBody = (await orgRes.json()) as { organizations?: unknown[]; accounts?: unknown[] };
        const rawOrgs = orgBody.organizations ?? [];
        const rawAccounts = orgBody.accounts ?? [];
        const raw = [...rawOrgs, ...rawAccounts];
        for (const o of raw.map(normalizeHiringOrganization)) {
          if (o.apolloId && !seen.has(o.apolloId)) {
            seen.add(o.apolloId);
            orgs.push(o);
          }
        }
        if (raw.length < 100 || page >= 3) break;
      }
    };

    // 1. Primary search with given keywords
    await fetchBatch(filters.keywords);

    // 2. If results are sparse (< 10) and query contains job role suffixes (e.g. "ERP Project Manager"),
    // strip the role suffix to search for the core industry (e.g. "ERP")
    if (orgs.length < 10) {
      const ROLE_TERMS =
        /\b(project\s+manager|program\s+manager|product\s+manager|manager|developer|engineer|administrator|admin|consultant|specialist|analyst|coordinator|director|head|lead|officer|architect|recruiter|intern)\b/gi;
      const cleanTopic = filters.keywords.replace(ROLE_TERMS, "").trim().replace(/\s+/g, " ");
      if (cleanTopic && cleanTopic.toLowerCase() !== filters.keywords.toLowerCase()) {
        await fetchBatch(cleanTopic);
      }
    }

    // 3. If compound query like "ERP AI" still has few results (< 5), try primary token ("ERP")
    if (orgs.length < 5 && filters.keywords.trim().includes(" ")) {
      const tokens = filters.keywords.trim().split(/\s+/).filter((t) => t.length > 1);
      if (tokens.length > 0 && tokens[0].length >= 3) {
        await fetchBatch(tokens[0]);
      }
    }

    // 4. For "ERP", also search "ERP software" so genuine enterprise software vendors are included in the pool
    if (filters.keywords.trim().toLowerCase() === "erp" && orgs.length < wanted) {
      await fetchBatch("ERP software");
    }

    if (orgs.length === 0) return { organizations: [], candidatesChecked: 0, articlesFound: 0 };

    const today = new Date();
    const from = new Date(today.getTime() - filters.daysBack * 86_400_000);
    const ymd = (d: Date) => d.toISOString().slice(0, 10);

    // Apollo caps news per_page at 25 (a larger value is a 422), so page
    // through; organisations go in batches to keep each request small.
    const rawArticles: unknown[] = [];
    for (let i = 0; i < orgs.length; i += NEWS_ORG_BATCH) {
      const ids = orgs.slice(i, i + NEWS_ORG_BATCH).map((o) => o.apolloId);
      for (let page = 1; page <= NEWS_MAX_PAGES; page++) {
        const newsRes = await this.apolloFetch("/news_articles/search", apiKey, {
          method: "POST",
          body: JSON.stringify({
            organization_ids: ids,
            published_at: { min: ymd(from), max: ymd(today) },
            page,
            per_page: NEWS_PAGE_SIZE,
          }),
        });
        if (!newsRes.ok) {
          const hint =
            newsRes.status === 403 || newsRes.status === 401
              ? " News search needs an Apollo master API key on a plan that includes news."
              : "";
          throw new BadRequestException(
            `Apollo news search failed (${newsRes.status}): ${await safeErrorMessage(newsRes)}.${hint}`,
          );
        }
        const body = (await newsRes.json()) as { news_articles?: unknown[] };
        const batch = body.news_articles ?? [];
        rawArticles.push(...batch);
        if (batch.length < NEWS_PAGE_SIZE) break;
      }
    }

    const byOrg = new Map<string, ApolloNewsArticle[]>();
    for (const raw of rawArticles) {
      const a = raw as Record<string, unknown>;
      const title = typeof a.title === "string" ? a.title.trim() : "";
      if (!title) continue;

      const rawIds = Array.isArray(a.organization_ids)
        ? (a.organization_ids as string[])
        : typeof a.organization_id === "string"
          ? [a.organization_id]
          : [];

      if (rawIds.length === 0) continue;

      const labelSource = a.event_categories ?? a.categories ?? a.category;
      const labels = Array.isArray(labelSource)
        ? labelSource.map(String)
        : typeof labelSource === "string"
          ? [labelSource]
          : [];

      const articleObj: ApolloNewsArticle = {
        id: (a.id as string) ?? null,
        title,
        url: (a.url as string) ?? null,
        publishedAt: (a.published_at as string) ?? null,
        snippet: (a.snippet as string) ?? (a.summary as string) ?? null,
        labels,
      };

      for (const orgId of rawIds) {
        if (!orgId) continue;
        const list = byOrg.get(orgId) ?? [];
        list.push(articleObj);
        byOrg.set(orgId, list);
      }
    }

    const organizations = orgs
      .filter((o) => byOrg.has(o.apolloId as string))
      .map((o) => ({
        organization: o,
        articles: (byOrg.get(o.apolloId as string) ?? []).sort((x, y) =>
          (y.publishedAt ?? "").localeCompare(x.publishedAt ?? ""),
        ),
      }));
    return {
      organizations,
      candidatesChecked: orgs.length,
      articlesFound: organizations.reduce((n, o) => n + o.articles.length, 0),
    };
  }

  // Reveals verified contact info for an existing CRM contact via Apollo's
  // People Match endpoint. Consumes an Apollo credit.
  async enrichPerson(contactId: string, user: RequestUser) {
    this.assertCanUse(user);
    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId },
      include: { company: { select: { name: true, domain: true } } },
    });
    if (!contact) {
      throw new NotFoundException("Contact not found");
    }

    const apiKey = await this.connection.requireApiKey();
    const match = await this.matchPerson(apiKey, {
      id: contact.apolloId ?? undefined,
      first_name: contact.apolloId ? undefined : contact.firstName,
      last_name: contact.apolloId ? undefined : contact.lastName,
      email: contact.email ?? undefined,
      organization_name: contact.company?.name,
      domain: contact.company?.domain ?? undefined,
    });

    return this.prisma.contact.update({
      where: { id: contactId },
      data: {
        email: match.email ?? contact.email,
        phone: match.phone ?? contact.phone,
        title: match.title ?? contact.title,
        linkedinUrl: match.linkedinUrl ?? contact.linkedinUrl,
        apolloId: contact.apolloId ?? match.apolloId,
        enrichedAt: new Date(),
      },
    });
  }

  // Imports selected search results by re-fetching each one's full, revealed
  // record (see module comment) and upserting it -- never trusts client-sent
  // contact fields, since the search preview the client saw was obfuscated.
  async importPeople(dto: ImportApolloPeopleDto, user: RequestUser) {
    this.assertCanUse(user);
    const apiKey = await this.connection.requireApiKey();

    const imported = [];
    for (const apolloId of dto.apolloIds) {
      const match = await this.matchPerson(apiKey, { id: apolloId });

      const companyId = match.organization
        ? (await this.upsertCompany(match.organization)).id
        : undefined;

      const contact = await this.prisma.contact.upsert({
        where: { apolloId: match.apolloId },
        create: {
          firstName: match.firstName,
          lastName: match.lastName,
          email: match.email,
          phone: match.phone,
          title: match.title,
          linkedinUrl: match.linkedinUrl,
          apolloId: match.apolloId,
          source: LeadSource.APOLLO,
          companyId,
        },
        update: {
          firstName: match.firstName,
          lastName: match.lastName,
          email: match.email ?? undefined,
          phone: match.phone ?? undefined,
          title: match.title ?? undefined,
          linkedinUrl: match.linkedinUrl ?? undefined,
          companyId,
        },
      });
      imported.push(contact);
    }
    return imported;
  }

  async importOrganizations(dto: ImportApolloOrganizationsDto, user: RequestUser) {
    this.assertCanUse(user);
    const apiKey = await this.connection.requireApiKey();

    const imported = [];
    for (const domain of dto.domains) {
      const detail = await this.enrichOrganization(apiKey, domain);
      imported.push(await this.upsertCompany(detail));
    }
    return imported;
  }

  async findDecisionMakersForCompany(
    companyName: string,
    domain?: string,
    targetTitles: string[] = [
      "CEO",
      "Chief Executive Officer",
      "Founder",
      "Co-Founder",
      "President",
      "Managing Director",
      "Vice President",
      "VP",
      "Director",
      "Head of Talent",
      "Head of Human Resources",
      "Talent Acquisition Manager",
      "HR Manager",
      "Head of Engineering",
      "Engineering Manager",
    ],
  ): Promise<{
    apolloId: string;
    name: string;
    firstName: string;
    lastName: string;
    title: string;
    email: string | null;
    phone: string | null;
    phoneType: "mobile" | "direct" | "office" | null;
    corporatePhone: string | null;
    linkedinUrl: string | null;
    organizationName: string | null;
    organizationDomain: string | null;
  } | null> {
    try {
      const apiKey = await this.connection.requireApiKey();

      // Clean corporate and legal entity suffixes
      let cleanName = companyName
        .replace(/\([^)]*\)/g, " ")
        .replace(
          /\b(Private Limited|Pvt Ltd|Pvt\. Ltd\.|Pvt|Limited|Ltd\.|Ltd|LLC|L\.L\.C\.|Inc\.|Inc|Corp\.|Corp|Corporation|GmbH|LLP|L\.L\.P\.|PLC|P\.L\.C\.)\b/gi,
          " ",
        )
        .replace(/[,\-./_]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (!cleanName) cleanName = companyName.trim();

      // Derive base brand name (e.g., "Infosys", "Happiest Minds", "Polosoft")
      let brandName = cleanName;
      const trailingFillers =
        /\b(Technologies|Technology|Tech|Software Solutions|Software|Solutions|Services|Systems|Infotech|Digital|Global|Group|Holdings|Consulting|International|Enterprises)\b$/i;
      if (brandName.split(/\s+/).length > 1) {
        brandName = brandName.replace(trailingFillers, "").trim() || cleanName;
      }

      let targetDomain = domain;
      let matchedOrgName: string | null = null;

      // 1. Resolve exact company organization domain from Apollo with intelligent scoring
      if (!targetDomain && cleanName.length > 1) {
        try {
          const orgSearchRes = await this.apolloFetch("/mixed_companies/search", apiKey, {
            method: "POST",
            body: JSON.stringify({
              q_organization_name: cleanName,
              page: 1,
              per_page: 10,
            }),
          });

          if (orgSearchRes.ok) {
            const orgData = (await orgSearchRes.json()) as {
              organizations?: Array<{
                name?: string;
                domain?: string;
                primary_domain?: string;
                estimated_num_employees?: number;
              }>;
              accounts?: Array<{
                name?: string;
                domain?: string;
                primary_domain?: string;
                estimated_num_employees?: number;
              }>;
            };
            const orgs = orgData.organizations ?? orgData.accounts ?? [];

            if (orgs.length > 0) {
              const scoredOrgs = orgs
                .map((o) => {
                  const oName = (o.name || "").trim().toLowerCase();
                  const rawLower = companyName.trim().toLowerCase();
                  const cleanLower = cleanName.toLowerCase();
                  const brandLower = brandName.toLowerCase();
                  const oDomain = (o.domain || o.primary_domain || "").toLowerCase().replace(/^www\./, "");
                  const domainHost = oDomain.split("/")[0];
                  const domainRoot = domainHost.split(".")[0];
                  const empCount = o.estimated_num_employees || 0;

                  let score = 0;

                  // Name match scoring
                  if (oName === rawLower || oName === cleanLower) {
                    score += 100;
                  } else if (oName === brandLower) {
                    score += 85;
                  } else {
                    const queryTokens = cleanLower.split(/\s+/).filter(Boolean);
                    const candTokens = oName.split(/\s+/).filter(Boolean);
                    const matchCount = queryTokens.filter((t) => candTokens.includes(t)).length;
                    const extraTokens = candTokens.filter((t) => !queryTokens.includes(t));

                    if (matchCount === queryTokens.length) {
                      score += Math.max(10, 70 - extraTokens.length * 25);
                    } else if (matchCount > 0) {
                      score += matchCount * 20 - extraTokens.length * 15;
                    } else {
                      score -= 50;
                    }
                  }

                  // Domain match scoring
                  const brandSlug = brandLower.replace(/[^a-z0-9]/g, "");
                  const cleanSlug = cleanLower.replace(/[^a-z0-9]/g, "");
                  if (domainRoot) {
                    if (domainRoot === cleanSlug || domainRoot === brandSlug) {
                      score += 60;
                    } else if (domainRoot.includes(brandSlug) || brandSlug.includes(domainRoot)) {
                      score += 25;
                    }
                  }

                  // Employee scale preference
                  if (empCount > 0) {
                    score += Math.min(Math.log10(empCount + 1) * 6, 25);
                  }

                  return { org: o, score, domain: oDomain, name: o.name || cleanName };
                })
                .sort((a, b) => b.score - a.score);

              const best = scoredOrgs[0];
              if (best && best.score >= 40 && best.domain) {
                targetDomain = best.domain;
                matchedOrgName = best.name;
              }
            }
          }
        } catch {
          // ignore org search error, fallback to clean name
        }
      }

      // 2. Search for decision makers at that exact domain / clean name
      const searchPayload: Record<string, unknown> = {
        person_titles: targetTitles,
        page: 1,
        per_page: 10,
      };

      if (targetDomain) {
        searchPayload.q_organization_domains = targetDomain;
      } else {
        searchPayload.q_organization_name = cleanName;
      }

      const searchRes = await this.apolloFetch("/mixed_people/api_search", apiKey, {
        method: "POST",
        body: JSON.stringify(searchPayload),
      });

      let candidatePeople: Array<{
        id?: string;
        first_name?: string;
        last_name_obfuscated?: string;
        title?: string;
        has_email?: boolean;
        organization_name?: string;
      }> = [];

      if (searchRes.ok) {
        const body = (await searchRes.json()) as { people?: typeof candidatePeople };
        candidatePeople = body.people ?? [];
      }

      // 3. Fallback without title restriction if no candidates found at the exact domain
      if (candidatePeople.length === 0 && targetDomain) {
        const fallbackRes = await this.apolloFetch("/mixed_people/api_search", apiKey, {
          method: "POST",
          body: JSON.stringify({
            q_organization_domains: targetDomain,
            page: 1,
            per_page: 5,
          }),
        });
        if (fallbackRes.ok) {
          const body = (await fallbackRes.json()) as { people?: typeof candidatePeople };
          candidatePeople = body.people ?? [];
        }
      }

      if (candidatePeople.length === 0) return null;

      // 4. Seniority & Email Scoring for candidates
      const tier1Titles = ["ceo", "chief executive officer", "founder", "co-founder", "president", "managing director"];
      const tier2Titles = ["vice president", "vp", "director", "head of engineering", "director of engineering"];

      const scoredPeople = candidatePeople
        .filter((p) => Boolean(p.id))
        .map((p) => {
          let score = 0;
          if (p.has_email) score += 50;

          const titleLower = (p.title || "").toLowerCase();
          if (tier1Titles.some((t) => titleLower.includes(t))) score += 30;
          else if (tier2Titles.some((t) => titleLower.includes(t))) score += 20;
          else score += 10;

          return { person: p, score };
        })
        .sort((a, b) => b.score - a.score);

      const selected = scoredPeople[0]?.person;
      if (!selected?.id) return null;

      // 5. Reveal real verified contact details via matchPerson
      const match = await this.matchPerson(apiKey, { id: selected.id });

      // 6. Strict validation: Ensure revealed person genuinely belongs to the queried company
      const revealedOrgName = (match.organization?.name || matchedOrgName || "").toLowerCase().trim();
      const revealedDomain = (match.organization?.domain || "").toLowerCase().replace(/^www\./, "").trim();
      const queryCleanLower = cleanName.toLowerCase();
      const queryBrandLower = brandName.toLowerCase();

      if (targetDomain) {
        const targetCleanDomain = targetDomain.toLowerCase().replace(/^www\./, "").trim();
        const targetDomainRoot = targetCleanDomain.split(".")[0];
        const revealedDomainRoot = revealedDomain.split(".")[0];

        // If targetDomain was found, the revealed person's domain or name must strictly match
        const domainMatches =
          revealedDomain === targetCleanDomain ||
          revealedDomain.endsWith("." + targetCleanDomain) ||
          targetCleanDomain.endsWith("." + revealedDomain) ||
          (targetDomainRoot.length > 3 && revealedDomainRoot === targetDomainRoot);

        const nameMatches =
          revealedOrgName.includes(queryBrandLower) ||
          queryBrandLower.includes(revealedOrgName) ||
          revealedOrgName.includes(queryCleanLower);

        if (!domainMatches && !nameMatches) {
          return null; // Reject mismatched person
        }
      } else {
        // If domain was not established, require strong name overlap
        const nameMatches =
          revealedOrgName.includes(queryBrandLower) ||
          queryBrandLower.includes(revealedOrgName) ||
          revealedOrgName.includes(queryCleanLower);

        if (!nameMatches) {
          return null;
        }
      }

      // If email exists, verify it doesn't belong to a totally different third-party company
      if (match.email && targetDomain) {
        const emailDomain = match.email.split("@")[1]?.toLowerCase().replace(/^www\./, "");
        const targetDomainRoot = targetDomain.split(".")[0];
        const isGenericEmail = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com"].includes(emailDomain);

        if (
          !isGenericEmail &&
          emailDomain &&
          !emailDomain.includes(targetDomainRoot) &&
          !targetDomain.includes(emailDomain.split(".")[0])
        ) {
          // Email belongs to a completely different company domain -> clear it or reject
          match.email = null;
        }
      }

      return {
        apolloId: match.apolloId,
        name: `${match.firstName} ${match.lastName}`.trim(),
        firstName: match.firstName,
        lastName: match.lastName,
        title: match.title || selected.title || "Decision Maker",
        email: match.email ?? null,
        phone: match.phone ?? null,
        phoneType: match.phoneType ?? null,
        corporatePhone: match.corporatePhone ?? null,
        linkedinUrl: match.linkedinUrl ?? null,
        organizationName: match.organization?.name || matchedOrgName || companyName,
        organizationDomain: match.organization?.domain || targetDomain || null,
      };
    } catch {
      return null;
    }
  }


  async matchPerson(
    apiKey: string,
    query: {
      id?: string;
      first_name?: string;
      last_name?: string;
      email?: string;
      organization_name?: string;
      domain?: string;
    },
  ): Promise<ApolloPersonDetail> {
    return this.cached("person-match", query, async () => {
      let res = await this.apolloFetch("/people/match", apiKey, {
        method: "POST",
        body: JSON.stringify({ ...query, reveal_personal_emails: true, reveal_phone_number: true }),
      });

      // If phone reveal is rejected by Apollo plan or credits, retry with email reveal only
      if (!res.ok && (res.status === 400 || res.status === 402 || res.status === 422)) {
        res = await this.apolloFetch("/people/match", apiKey, {
          method: "POST",
          body: JSON.stringify({ ...query, reveal_personal_emails: true }),
        });
      }

      if (!res.ok) {
        throw new BadRequestException(`Apollo reveal failed (${res.status}): ${await safeErrorMessage(res)}`);
      }

      const body = (await res.json()) as { person?: unknown };
      if (!body.person) {
        throw new BadRequestException("Apollo could not find a match for this person.");
      }
      return normalizePersonDetail(body.person);
    });
  }

  private async enrichOrganization(apiKey: string, domain: string): Promise<ApolloOrganizationDetail> {
    return this.cached("organization-enrich", { domain }, async () => {
      const res = await this.apolloFetch(`/organizations/enrich?domain=${encodeURIComponent(domain)}`, apiKey);
      if (!res.ok) {
        throw new BadRequestException(
          `Apollo organization lookup failed (${res.status}): ${await safeErrorMessage(res)}`,
        );
      }
      const body = (await res.json()) as { organization?: unknown };
      if (!body.organization) {
        throw new BadRequestException(`Apollo has no organization record for "${domain}".`);
      }
      return normalizeOrganizationDetail(body.organization);
    });
  }

  // Permanent, best-effort cache for Apollo API calls -- keyed by call kind
  // plus a normalized (sorted, lowercased) hash of the request params, so
  // searching or importing the same name/domain again is served from
  // Postgres instead of spending another Apollo credit. A cache write
  // failure never fails the caller: the live Apollo result is still
  // returned, it just won't be remembered next time.
  private async cached<T>(kind: string, params: object, fetcher: () => Promise<T>): Promise<T> {
    const queryKey = cacheKey(params);
    const hit = await this.prisma.apolloCache.findUnique({
      where: { kind_queryKey: { kind, queryKey } },
    });
    if (hit) {
      return hit.payload as T;
    }

    const result = await fetcher();
    await this.prisma.apolloCache
      .upsert({
        where: { kind_queryKey: { kind, queryKey } },
        create: { kind, queryKey, payload: result as unknown as Prisma.InputJsonValue },
        update: { payload: result as unknown as Prisma.InputJsonValue },
      })
      .catch(() => {});
    return result;
  }

  private assertCanUse(user: RequestUser) {
    if (!canUseSalesOutreach(user)) {
      throw new ForbiddenException("Sales outreach is only available to the Sales department");
    }
  }

  private upsertCompany(org: ApolloOrganizationDetail) {
    return this.prisma.company.upsert({
      where: { apolloId: org.apolloId },
      create: {
        name: org.name,
        domain: org.domain,
        industry: org.industry,
        employeeCount: org.employeeCount,
        linkedinUrl: org.linkedinUrl,
        apolloId: org.apolloId,
        source: LeadSource.APOLLO,
      },
      update: {
        name: org.name,
        domain: org.domain ?? undefined,
        industry: org.industry ?? undefined,
        employeeCount: org.employeeCount ?? undefined,
        linkedinUrl: org.linkedinUrl ?? undefined,
      },
    });
  }

  private apolloFetch(path: string, apiKey: string, init?: RequestInit) {
    return fetch(`${APOLLO_API}${path}`, {
      ...init,
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });
  }
}

// Deterministic cache key: recursively sorts object keys, drops undefined
// entries, and lowercases/trims strings so "John" / " john " / re-ordered
// filter objects all land on the same cached entry.
function cacheKey(params: object): string {
  return JSON.stringify(normalizeForCacheKey(params));
}

function normalizeForCacheKey(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeForCacheKey);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, normalizeForCacheKey(v)]),
    );
  }
  if (typeof value === "string") {
    return value.trim().toLowerCase();
  }
  return value;
}

function normalizeOrganizationPreview(raw: unknown): ApolloOrganizationPreview {
  const o = raw as Record<string, unknown>;
  return {
    apolloId: (o.id as string) ?? null,
    name: String(o.name ?? "Unknown"),
    domain: (o.primary_domain as string) ?? (o.website_url as string) ?? null,
    industry: (o.industry as string) ?? null,
    employeeCount: typeof o.estimated_num_employees === "number" ? o.estimated_num_employees : null,
  };
}

// A job-postings-filtered search returns "accounts" (Apollo's term for
// organizations joined against a team's own CRM data) rather than plain
// "organizations" -- a slightly different field set (e.g. `domain` instead
// of `primary_domain` in some rows), so this reads both names defensively.
function normalizeHiringOrganization(raw: unknown): ApolloHiringOrganization {
  const o = raw as Record<string, unknown>;
  return {
    apolloId: (o.organization_id as string) ?? (o.id as string) ?? null,
    name: String(o.name ?? "Unknown"),
    domain: (o.primary_domain as string) ?? (o.domain as string) ?? (o.website_url as string) ?? null,
    employeeCount: typeof o.estimated_num_employees === "number" ? o.estimated_num_employees : null,
    headcountGrowth6mo:
      typeof o.organization_headcount_six_month_growth === "number"
        ? o.organization_headcount_six_month_growth
        : null,
    headcountGrowth12mo:
      typeof o.organization_headcount_twelve_month_growth === "number"
        ? o.organization_headcount_twelve_month_growth
        : null,
  };
}

function normalizeOrganizationDetail(raw: unknown): ApolloOrganizationDetail {
  const o = raw as Record<string, unknown>;
  return {
    apolloId: String(o.id ?? ""),
    name: String(o.name ?? "Unknown"),
    domain: (o.primary_domain as string) ?? (o.website_url as string) ?? null,
    industry: (o.industry as string) ?? null,
    employeeCount: typeof o.estimated_num_employees === "number" ? o.estimated_num_employees : null,
    linkedinUrl: (o.linkedin_url as string) ?? null,
  };
}

function normalizePersonPreview(raw: unknown): ApolloPersonPreview {
  const p = raw as Record<string, unknown>;
  const org = p.organization as Record<string, unknown> | undefined;
  return {
    apolloId: String(p.id ?? ""),
    firstName: String(p.first_name ?? ""),
    lastNamePreview: (p.last_name as string) ?? (p.last_name_obfuscated as string) ?? null,
    title: (p.title as string) ?? null,
    organizationName: (org?.name as string) ?? null,
  };
}

// Apollo returns a sentinel placeholder instead of a real address when an
// email hasn't been revealed -- treat that as "no email" rather than a fake
// address.
function normalizeEmail(email: unknown): string | null {
  if (typeof email !== "string" || !email || email.includes("email_not_unlocked")) {
    return null;
  }
  return email;
}

function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (
    !trimmed ||
    trimmed.includes("not_unlocked") ||
    trimmed.includes("masked") ||
    trimmed.includes("***") ||
    trimmed.toLowerCase().includes("unavailable") ||
    trimmed.toLowerCase().includes("none")
  ) {
    return null;
  }
  const digitCount = (trimmed.match(/\d/g) || []).length;
  if (digitCount < 7) return null;
  return trimmed;
}

interface ApolloRawPhoneNumber {
  number?: string;
  raw_number?: string;
  sanitized_number?: string;
  type?: string;
  status?: string;
}

function extractPersonPhone(
  p: Record<string, unknown>,
  org?: Record<string, unknown>,
): {
  phone: string | null;
  phoneType: "mobile" | "direct" | "office" | null;
  corporatePhone: string | null;
} {
  let mobilePhone: string | null = null;
  let directPhone: string | null = null;
  let workPhone: string | null = null;
  let generalPhone: string | null = null;

  if (Array.isArray(p.phone_numbers)) {
    for (const item of p.phone_numbers as ApolloRawPhoneNumber[]) {
      if (!item || typeof item !== "object") continue;
      const num = normalizePhone(item.sanitized_number || item.number || item.raw_number);
      if (!num) continue;

      const type = (item.type || "").toLowerCase();
      if (type.includes("mobile") || type.includes("cell")) {
        if (!mobilePhone) mobilePhone = num;
      } else if (type.includes("direct") || type.includes("desk")) {
        if (!directPhone) directPhone = num;
      } else if (type.includes("work") || type.includes("hq") || type.includes("office") || type.includes("corporate")) {
        if (!workPhone) workPhone = num;
      } else {
        if (!generalPhone) generalPhone = num;
      }
    }
  }

  if (!mobilePhone && p.mobile_phone) {
    mobilePhone = normalizePhone(p.mobile_phone);
  }
  if (!directPhone && p.direct_phone) {
    directPhone = normalizePhone(p.direct_phone);
  }
  if (!generalPhone && p.sanitized_phone) {
    generalPhone = normalizePhone(p.sanitized_phone);
  }
  if (!generalPhone && p.phone_number) {
    generalPhone = normalizePhone(p.phone_number);
  }

  let corpPhone: string | null = null;
  if (p.corporate_phone) {
    corpPhone = normalizePhone(p.corporate_phone);
  }
  if (!corpPhone && org) {
    if (org.phone) {
      corpPhone = normalizePhone(org.phone);
    } else if (org.primary_phone && typeof org.primary_phone === "object") {
      const pp = org.primary_phone as { number?: string };
      corpPhone = normalizePhone(pp.number);
    }
  }

  if (mobilePhone) {
    return { phone: mobilePhone, phoneType: "mobile", corporatePhone: corpPhone };
  }
  if (directPhone) {
    return { phone: directPhone, phoneType: "direct", corporatePhone: corpPhone };
  }
  if (workPhone) {
    return { phone: workPhone, phoneType: "office", corporatePhone: corpPhone };
  }
  if (generalPhone) {
    return { phone: generalPhone, phoneType: "direct", corporatePhone: corpPhone };
  }
  if (corpPhone) {
    return { phone: corpPhone, phoneType: "office", corporatePhone: corpPhone };
  }

  return { phone: null, phoneType: null, corporatePhone: null };
}

function normalizePersonDetail(raw: unknown): ApolloPersonDetail {
  const p = raw as Record<string, unknown>;
  const org = p.organization as Record<string, unknown> | undefined;
  const phoneInfo = extractPersonPhone(p, org);
  return {
    apolloId: String(p.id ?? ""),
    firstName: String(p.first_name ?? ""),
    lastName: String(p.last_name ?? ""),
    title: (p.title as string) ?? null,
    email: normalizeEmail(p.email),
    phone: phoneInfo.phone,
    phoneType: phoneInfo.phoneType,
    corporatePhone: phoneInfo.corporatePhone,
    linkedinUrl: (p.linkedin_url as string) ?? null,
    organization: org && org.id ? normalizeOrganizationDetail(org) : null,
  };
}

async function safeErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string; message?: string };
    return body.error ?? body.message ?? res.statusText;
  } catch {
    return res.statusText;
  }
}
