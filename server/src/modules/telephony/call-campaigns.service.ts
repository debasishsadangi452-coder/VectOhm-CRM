import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateCallCampaignDto } from "./dto/create-call-campaign.dto";
import { canUseSalesOutreach } from "../../common/utils/sales-access";
import type { RequestUser } from "../../common/types/request-user.type";

const campaignInclude = {
  creator: { select: { id: true, firstName: true, lastName: true } },
  _count: { select: { leads: true } },
} as const;

const leadInclude = {
  contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
  assignedTo: { select: { id: true, firstName: true, lastName: true } },
} as const;

// Power-dialer calling lists (§11/§12) -- see schema.prisma's CallCampaign
// comment for why leads are simply assigned-or-open rather than a full
// round-robin distributor.
@Injectable()
export class CallCampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: RequestUser) {
    this.assertCanUse(user);
    return this.prisma.callCampaign.findMany({
      where: this.visibilityScope(user),
      include: campaignInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string, user: RequestUser) {
    this.assertCanUse(user);
    const campaign = await this.prisma.callCampaign.findUnique({
      where: { id },
      include: { ...campaignInclude, leads: { include: leadInclude, orderBy: { createdAt: "asc" } } },
    });
    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }
    return campaign;
  }

  async create(dto: CreateCallCampaignDto, user: RequestUser) {
    this.assertCanUse(user);

    const contacts = await this.prisma.contact.findMany({
      where: { id: { in: dto.contactIds } },
      select: { id: true },
    });
    if (contacts.length === 0) {
      throw new BadRequestException("None of the selected contacts could be found.");
    }

    return this.prisma.callCampaign.create({
      data: {
        name: dto.name,
        creatorId: user.id,
        departmentId: user.department?.id,
        leads: {
          create: contacts.map((c) => ({ contactId: c.id, assignedToId: dto.assignToId })),
        },
      },
      include: campaignInclude,
    });
  }

  // Backs CallCampaignQueue's "Start Dialing" -- every lead this agent is
  // meant to work right now, across every campaign they can see: their own
  // assigned leads, plus any unassigned lead on a campaign visible to them.
  async myQueue(user: RequestUser) {
    this.assertCanUse(user);
    return this.prisma.callCampaignLead.findMany({
      where: {
        status: "PENDING",
        // A lead assigned directly to this agent shows regardless of who
        // created the campaign (someone handed them the work); an
        // unassigned, up-for-grabs lead only shows on a campaign they can
        // otherwise see (visibilityScope) -- an Employee shouldn't see
        // another rep's open queue just because it's unclaimed.
        OR: [{ assignedToId: user.id }, { assignedToId: null, campaign: this.visibilityScope(user) }],
      },
      include: { ...leadInclude, campaign: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
  }

  // Atomically claims the next open lead in a campaign so two agents working
  // the same unassigned list never both call the same person at once (§12).
  // If the lead was unassigned, claiming it also assigns it to this agent.
  async claimNext(
    campaignId: string,
    user: RequestUser,
  ): Promise<Prisma.CallCampaignLeadGetPayload<{ include: typeof leadInclude }> | null> {
    this.assertCanUse(user);
    await this.assertCanWork(campaignId, user);

    const candidate = await this.prisma.callCampaignLead.findFirst({
      where: { campaignId, status: "PENDING", OR: [{ assignedToId: user.id }, { assignedToId: null }] },
      orderBy: { createdAt: "asc" },
      include: leadInclude,
    });
    if (!candidate) return null;

    const result = await this.prisma.callCampaignLead.updateMany({
      where: { id: candidate.id, status: "PENDING" },
      data: { status: "CALLING", assignedToId: user.id },
    });
    if (result.count === 0) {
      // Someone else claimed it in the race window -- caller can retry.
      return this.claimNext(campaignId, user);
    }
    return candidate;
  }

  private visibilityScope(user: RequestUser) {
    if (user.role.name === RoleName.ADMIN) {
      return {};
    }
    if (user.role.name === RoleName.EMPLOYEE) {
      return { creatorId: user.id };
    }
    return { OR: [{ departmentId: null }, { departmentId: user.department?.id }] };
  }

  // Wider than plain ownership: an Employee can work a campaign they didn't
  // create as long as at least one lead in it is assigned to them -- a
  // Manager building the list and handing out leads is the normal case.
  private async assertCanWork(id: string, user: RequestUser) {
    const campaign = await this.prisma.callCampaign.findUnique({ where: { id } });
    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }
    if (user.role.name === RoleName.ADMIN || user.role.name === RoleName.MANAGER) {
      return campaign;
    }
    if (campaign.creatorId === user.id) {
      return campaign;
    }
    const hasAssignedLead = await this.prisma.callCampaignLead.findFirst({
      where: { campaignId: id, assignedToId: user.id },
      select: { id: true },
    });
    if (!hasAssignedLead) {
      throw new ForbiddenException("You do not have permission to work this campaign");
    }
    return campaign;
  }

  private assertCanUse(user: RequestUser) {
    if (!canUseSalesOutreach(user)) {
      throw new ForbiddenException("Calling is only available to the Sales department");
    }
  }
}
