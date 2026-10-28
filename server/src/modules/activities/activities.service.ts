import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ActivityType, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateActivityDto } from "./dto/create-activity.dto";
import { UpdateActivityDto } from "./dto/update-activity.dto";
import { EngagementEventsService } from "../engagement/engagement-events.service";
import type { RequestUser } from "../../common/types/request-user.type";

const activityInclude = {
  creator: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  contact: { select: { id: true, firstName: true, lastName: true, email: true } },
} as const;

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engagementEvents: EngagementEventsService,
  ) {}

  findAll(filters: { dealId?: string }) {
    return this.prisma.activity.findMany({
      where: { dealId: filters.dealId },
      include: activityInclude,
      orderBy: { occurredAt: "desc" },
    });
  }

  async findOne(id: string) {
    const activity = await this.prisma.activity.findUnique({ where: { id }, include: activityInclude });
    if (!activity) {
      throw new NotFoundException("Activity not found");
    }
    return activity;
  }

  async create(dto: CreateActivityDto, creatorId: string) {
    const deal = await this.assertDealExists(dto.dealId);

    const activity = await this.prisma.activity.create({
      data: {
        dealId: dto.dealId,
        type: dto.type,
        content: dto.content,
        contactId: dto.contactId ?? null,
        outcome: dto.outcome?.trim() || null,
        durationMin: dto.durationMin ?? null,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
        creatorId,
      },
      include: activityInclude,
    });

    // No calendar/telephony correlation exists here -- a MEETING or CALL
    // activity IS the record of that meeting/call happening, logged by
    // whoever ran it. See EngagementEvent's MEETING_BOOKED/CALL_LOGGED
    // doc comment in schema.prisma for why there's no separate booking flow.
    if (dto.type === ActivityType.MEETING || dto.type === ActivityType.CALL) {
      await this.engagementEvents.record({
        type: dto.type === ActivityType.MEETING ? "MEETING_BOOKED" : "CALL_LOGGED",
        contactId: dto.contactId,
        dealId: dto.dealId,
        ownerId: creatorId,
        departmentId: deal.departmentId,
      });
    }

    return activity;
  }

  async update(id: string, dto: UpdateActivityDto, user: RequestUser) {
    const activity = await this.getOwned(id);
    this.assertCanMutate(activity, user);

    return this.prisma.activity.update({
      where: { id },
      data: {
        type: dto.type,
        content: dto.content,
        ...(dto.contactId !== undefined ? { contactId: dto.contactId } : {}),
        ...(dto.outcome !== undefined ? { outcome: dto.outcome?.trim() || null } : {}),
        ...(dto.durationMin !== undefined ? { durationMin: dto.durationMin } : {}),
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
      },
      include: activityInclude,
    });
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const activity = await this.getOwned(id);
    this.assertCanMutate(activity, user);
    await this.prisma.activity.delete({ where: { id } });
  }

  private async getOwned(id: string) {
    const activity = await this.prisma.activity.findUnique({ where: { id } });
    if (!activity) {
      throw new NotFoundException("Activity not found");
    }
    return activity;
  }

  private async assertDealExists(dealId: string) {
    const deal = await this.prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal) {
      throw new NotFoundException("Deal not found");
    }
    return deal;
  }

  // TODO: revisit ACL model -- creator or ADMIN/MANAGER only, for now.
  private assertCanMutate(activity: { creatorId: string }, user: RequestUser) {
    const isPrivileged = user.role.name === RoleName.ADMIN || user.role.name === RoleName.MANAGER;
    if (!isPrivileged && activity.creatorId !== user.id) {
      throw new ForbiddenException("You do not have permission to modify this activity");
    }
  }
}
