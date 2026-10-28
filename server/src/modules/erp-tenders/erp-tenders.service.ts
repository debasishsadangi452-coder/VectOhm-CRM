import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { fetchCanadaBuysTenders, fetchSamGovTenders } from "./erp-tender-feeds";
import { matchErpTerms, type TenderCandidate } from "./erp-tender.util";

export interface TenderRefreshResult {
  source: string;
  fetched: number;
  matched: number;
  created: number;
  updated: number;
  error?: string;
}

@Injectable()
export class ErpTendersService {
  private readonly logger = new Logger(ErpTendersService.name);
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  // Daily at 07:30 UTC (13:00 IST) -- feeds update on business days.
  @Cron("0 30 7 * * *")
  async scheduledRefresh() {
    await this.refresh().catch((err) => this.logger.error(`Tender refresh failed: ${err?.message}`));
  }

  async refresh(): Promise<TenderRefreshResult[]> {
    if (this.running) return [];
    this.running = true;
    try {
      const results: TenderRefreshResult[] = [];
      results.push(await this.runSource("CANADABUYS", () => fetchCanadaBuysTenders()));
      const samKey = process.env.SAM_GOV_API_KEY;
      if (samKey) {
        results.push(await this.runSource("SAM_GOV", () => fetchSamGovTenders(samKey)));
      }
      // Anything whose deadline has passed is no longer open.
      await this.prisma.erpTender.updateMany({
        where: { isOpen: true, closesAt: { lt: new Date() } },
        data: { isOpen: false },
      });
      return results;
    } finally {
      this.running = false;
    }
  }

  private async runSource(
    source: string,
    load: () => Promise<TenderCandidate[]>,
  ): Promise<TenderRefreshResult> {
    const result: TenderRefreshResult = { source, fetched: 0, matched: 0, created: 0, updated: 0 };
    try {
      const all = await load();
      result.fetched = all.length;
      for (const t of all) {
        const matchedTerms = matchErpTerms(t.title, t.description);
        if (matchedTerms.length === 0) continue;
        result.matched++;
        const data = {
          country: t.country,
          title: t.title,
          description: t.description,
          buyerName: t.buyerName,
          buyerRegion: t.buyerRegion,
          publishedAt: t.publishedAt,
          closesAt: t.closesAt,
          noticeUrl: t.noticeUrl,
          contactName: t.contactName,
          contactEmail: t.contactEmail,
          contactPhone: t.contactPhone,
          matchedTerms,
          isOpen: t.isOpen,
        };
        const existing = await this.prisma.erpTender.findUnique({
          where: { source_externalId: { source: t.source, externalId: t.externalId } },
          select: { id: true },
        });
        if (existing) {
          // status is the sales team's own triage; never overwrite it.
          await this.prisma.erpTender.update({ where: { id: existing.id }, data });
          result.updated++;
        } else {
          await this.prisma.erpTender.create({
            data: { source: t.source, externalId: t.externalId, ...data },
          });
          result.created++;
        }
      }
    } catch (err: any) {
      result.error = err?.message ?? String(err);
      this.logger.error(`${source} refresh failed: ${result.error}`);
    }
    this.logger.log(
      `${source}: fetched ${result.fetched}, matched ${result.matched}, +${result.created} new, ${result.updated} updated`,
    );
    return result;
  }

  async list(filters: {
    status?: string;
    country?: string;
    openOnly?: boolean;
    search?: string;
    take?: number;
    skip?: number;
  }) {
    const where: Prisma.ErpTenderWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.country) where.country = filters.country;
    if (filters.openOnly) where.isOpen = true;
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: "insensitive" } },
        { buyerName: { contains: filters.search, mode: "insensitive" } },
      ];
    }
    const [total, tenders] = await Promise.all([
      this.prisma.erpTender.count({ where }),
      this.prisma.erpTender.findMany({
        where,
        // Closing soonest first, tenders with no deadline last.
        orderBy: [{ isOpen: "desc" }, { closesAt: { sort: "asc", nulls: "last" } }],
        take: filters.take ?? 50,
        skip: filters.skip ?? 0,
        // The long description is only needed on the detail view.
        omit: { description: true },
      }),
    ]);
    return { total, tenders };
  }

  async get(id: string) {
    const tender = await this.prisma.erpTender.findUnique({ where: { id } });
    if (!tender) throw new NotFoundException("Tender not found");
    return tender;
  }

  async updateStatus(id: string, status: string) {
    await this.get(id);
    return this.prisma.erpTender.update({ where: { id }, data: { status } });
  }

  async stats() {
    const [total, open, newOpen, pursuing] = await Promise.all([
      this.prisma.erpTender.count(),
      this.prisma.erpTender.count({ where: { isOpen: true } }),
      this.prisma.erpTender.count({ where: { isOpen: true, status: "NEW" } }),
      this.prisma.erpTender.count({ where: { status: "PURSUING" } }),
    ]);
    return { total, open, newOpen, pursuing };
  }
}
