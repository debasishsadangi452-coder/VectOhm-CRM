import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ActivityType, CallStatus, DealStage, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateCallDto } from "./dto/create-call.dto";
import { UpdateCallDispositionDto } from "./dto/update-call-disposition.dto";
import { canUseSalesOutreach } from "../../common/utils/sales-access";
import type { RequestUser } from "../../common/types/request-user.type";

const callInclude = {
  agent: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
  company: { select: { id: true, name: true } },
  deal: { select: { id: true, title: true } },
} as const;

export interface CallFilters {
  contactId?: string;
  dealId?: string;
  agentId?: string;
  status?: CallStatus;
  from?: string;
  to?: string;
}

@Injectable()
export class CallsService {
  constructor(private readonly prisma: PrismaService) {}

  // Called by GlobalCallWidget the moment the JustCall Dialer SDK's
  // dialNumber() fires -- this row exists from the very start of the call,
  // status INITIATED, with no providerCallId yet. The webhook handler fills
  // that in (and everything else) as JustCall's own events arrive.
  async create(dto: CreateCallDto, user: RequestUser) {
    this.assertCanUse(user);
    if (dto.contactId) await this.assertContactExists(dto.contactId);
    if (dto.companyId) await this.assertCompanyExists(dto.companyId);
    if (dto.dealId) await this.assertDealExists(dto.dealId);

    const call = await this.prisma.call.create({
      data: {
        provider: dto.provider ?? "justcall",
        agentId: user.id,
        toNumber: dto.toNumber,
        fromNumber: dto.fromNumber,
        direction: dto.direction ?? "OUTBOUND",
        contactId: dto.contactId,
        companyId: dto.companyId,
        dealId: dto.dealId,
        campaignId: dto.campaignId,
        status: CallStatus.INITIATED,
      },
      include: callInclude,
    });

    if (dto.campaignId && dto.contactId) {
      await this.prisma.callCampaignLead.updateMany({
        where: { campaignId: dto.campaignId, contactId: dto.contactId },
        data: { status: "CALLING" },
      });
    }

    return call;
  }

  async findAll(filters: CallFilters, user: RequestUser) {
    this.assertCanUse(user);
    return this.prisma.call.findMany({
      where: {
        contactId: filters.contactId,
        dealId: filters.dealId,
        agentId: filters.agentId,
        status: filters.status,
        startedAt: {
          gte: filters.from ? new Date(filters.from) : undefined,
          lte: filters.to ? new Date(filters.to) : undefined,
        },
        ...this.visibilityScope(user),
      },
      include: callInclude,
      orderBy: { startedAt: "desc" },
      take: 200,
    });
  }

  // Backs IncomingCallModal: when the JustCall Dialer SDK's call-ringing
  // fires with direction "inbound" (the SDK rings in every logged-in agent's
  // browser, not just ours -- there's no separate provider push we need to
  // subscribe to), the widget looks the caller up here to show a known-caller
  // card (contact + company + most relevant open deal) or fall back to the
  // unknown-caller "Create Contact / Ignore" flow -- see the plan's §9/§10.
  async lookupByPhone(rawNumber: string, user: RequestUser) {
    this.assertCanUse(user);
    const digits = rawNumber.replace(/\D/g, "");
    if (digits.length < 7) return null;
    const last10 = digits.slice(-10);

    const contact = await this.prisma.contact.findFirst({
      where: { phone: { contains: last10 } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        company: { select: { id: true, name: true } },
        deals: {
          where: { stage: { notIn: [DealStage.WON, DealStage.LOST, DealStage.ARCHIVED] } },
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: { id: true, title: true, value: true },
        },
      },
    });
    if (!contact) return null;

    return {
      contactId: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      phone: contact.phone,
      company: contact.company,
      deal: contact.deals[0] ?? null,
    };
  }

  async findOne(id: string, user: RequestUser) {
    this.assertCanUse(user);
    const call = await this.getOwned(id);
    this.assertCanView(call, user);
    return this.prisma.call.findUnique({ where: { id }, include: callInclude });
  }

  // Called by GlobalCallWidget as soon as the JustCall Dialer SDK's
  // call-ringing event supplies the provider's own call id (if it does --
  // unconfirmed against the live SDK, see justcall-dialer-widget.ts). Linking
  // deterministically here means the webhook handler never has to guess which
  // local Call row a given event belongs to via fuzzy from/to/time matching.
  async linkProviderCallId(id: string, providerCallId: string, user: RequestUser) {
    this.assertCanUse(user);
    const call = await this.getOwned(id);
    this.assertCanView(call, user);
    return this.prisma.call.update({ where: { id }, data: { providerCallId }, include: callInclude });
  }

  async updateDisposition(id: string, dto: UpdateCallDispositionDto, user: RequestUser) {
    this.assertCanUse(user);
    const call = await this.getOwned(id);
    this.assertCanView(call, user);

    const updated = await this.prisma.call.update({
      where: { id },
      data: {
        disposition: dto.disposition,
        notes: dto.notes,
        nextFollowUpAt: dto.nextFollowUpAt ? new Date(dto.nextFollowUpAt) : undefined,
      },
      include: callInclude,
    });

    // Disposition saved = the rep is done with this lead -- advance the
    // power-dialer queue (see CallCampaignsService.claimNext, which only
    // hands out PENDING leads) without requiring a separate "mark done" step.
    if (updated.campaignId && updated.contactId) {
      await this.prisma.callCampaignLead.updateMany({
        where: { campaignId: updated.campaignId, contactId: updated.contactId },
        data: { status: "DONE" },
      });
    }

    return updated;
  }

  // Backs CallAnalyticsDashboard (§20). Same visibility scoping as findAll --
  // an Employee's dashboard is just their own numbers, Manager/Admin see the
  // whole (department-scoped, or unrestricted for Admin) picture.
  async analytics(filters: Pick<CallFilters, "from" | "to">, user: RequestUser) {
    this.assertCanUse(user);
    const where = {
      startedAt: {
        gte: filters.from ? new Date(filters.from) : undefined,
        lte: filters.to ? new Date(filters.to) : undefined,
      },
      ...this.visibilityScope(user),
    };

    const calls = await this.prisma.call.findMany({
      where,
      select: { status: true, durationSec: true, agentId: true, agent: { select: { firstName: true, lastName: true } } },
    });

    const totalCalls = calls.length;
    const connected = calls.filter((c) => c.status === CallStatus.COMPLETED || c.status === CallStatus.CONNECTED).length;
    const missed = calls.filter((c) => c.status === CallStatus.NO_ANSWER).length;
    const noAnswer = calls.filter((c) => c.status === CallStatus.FAILED || c.status === CallStatus.BUSY).length;
    const totalTalkSec = calls.reduce((sum, c) => sum + (c.durationSec ?? 0), 0);
    const connectionRate = totalCalls > 0 ? connected / totalCalls : 0;

    const byAgent = new Map<string, { name: string; calls: number; connected: number; talkSec: number }>();
    for (const call of calls) {
      const entry = byAgent.get(call.agentId) ?? {
        name: `${call.agent.firstName} ${call.agent.lastName}`,
        calls: 0,
        connected: 0,
        talkSec: 0,
      };
      entry.calls += 1;
      if (call.status === CallStatus.COMPLETED || call.status === CallStatus.CONNECTED) entry.connected += 1;
      entry.talkSec += call.durationSec ?? 0;
      byAgent.set(call.agentId, entry);
    }

    return {
      totalCalls,
      connected,
      missed,
      noAnswer,
      totalTalkSec,
      avgCallSec: connected > 0 ? Math.round(totalTalkSec / connected) : 0,
      connectionRate,
      byAgent: Array.from(byAgent.entries()).map(([agentId, v]) => ({ agentId, ...v })),
    };
  }

  // Employee sees only their own calls; Manager/Admin see every Sales call --
  // Admin explicitly unrestricted (not department-scoped) per the requirement
  // that Admin can see every sales rep's call logs and recordings. Manager is
  // scoped to their own department's agents, same convention as
  // DealsService.visibilityScope.
  private visibilityScope(user: RequestUser) {
    if (user.role.name === RoleName.ADMIN) {
      return {};
    }
    if (user.role.name === RoleName.EMPLOYEE) {
      return { agentId: user.id };
    }
    return { agent: { departmentId: user.department?.id ?? "__none__" } };
  }

  private assertCanView(call: { agentId: string; agentDepartmentId: string | null }, user: RequestUser) {
    if (user.role.name === RoleName.ADMIN) return;
    if (call.agentId === user.id) return;
    if (user.role.name === RoleName.MANAGER && call.agentDepartmentId === (user.department?.id ?? null)) {
      return;
    }
    throw new ForbiddenException("You do not have permission to view this call");
  }

  private async getOwned(id: string) {
    const call = await this.prisma.call.findUnique({
      where: { id },
      select: { id: true, agentId: true, agent: { select: { departmentId: true } } },
    });
    if (!call) {
      throw new NotFoundException("Call not found");
    }
    return { id: call.id, agentId: call.agentId, agentDepartmentId: call.agent.departmentId };
  }

  private async assertContactExists(contactId: string) {
    const contact = await this.prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact) throw new NotFoundException("Contact not found");
  }

  private async assertCompanyExists(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException("Company not found");
  }

  private async assertDealExists(dealId: string) {
    const deal = await this.prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal) throw new NotFoundException("Deal not found");
  }

  private assertCanUse(user: RequestUser) {
    if (!canUseSalesOutreach(user)) {
      throw new ForbiddenException("Calling is only available to the Sales department");
    }
  }
}

// Mirrors Activity's freeform-outcome, system-authored-row convention (see
// DealsService's ActivityType.SYSTEM writes) -- called by
// JustCallWebhookService once a call completes, so a call tied to a deal
// still shows up in that deal's timeline exactly like it does today.
export async function logCallToDealTimeline(
  prisma: PrismaService,
  call: { id: string; dealId: string | null; agentId: string; durationSec: number | null; disposition: string | null },
) {
  if (!call.dealId) return;
  await prisma.activity.create({
    data: {
      type: ActivityType.CALL,
      content: call.disposition ? `Call logged -- ${call.disposition}` : "Call logged",
      dealId: call.dealId,
      creatorId: call.agentId,
      durationMin: call.durationSec ? Math.round(call.durationSec / 60) : null,
      outcome: call.disposition,
    },
  });
}
