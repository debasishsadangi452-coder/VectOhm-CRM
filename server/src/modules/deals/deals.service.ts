import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { DealApprovalStatus, DealStage, RoleName, ActivityType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateDealDto } from "./dto/create-deal.dto";
import { UpdateDealDto } from "./dto/update-deal.dto";
import { EngagementEventsService } from "../engagement/engagement-events.service";
import type { RequestUser } from "../../common/types/request-user.type";

// A plain Employee closing a deal above the department's configured
// threshold needs Manager/Admin sign-off before it actually moves to
// Closed Won -- see update()/approve()/reject() below.

const dealInclude = {
  company: { select: { id: true, name: true } },
  contact: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      engagementScore: true,
      engagementTier: true,
    },
  },
  owner: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
} as const;

interface DealFilters {
  stage?: DealStage;
  ownerId?: string;
  companyId?: string;
}

import { GoogleAdsOfflineConversionService } from "../google-ads-analytics/google-ads-offline-conversion.service";

@Injectable()
export class DealsService {
  private readonly logger = new Logger(DealsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engagementEvents: EngagementEventsService,
    private readonly offlineConversionService: GoogleAdsOfflineConversionService,
  ) {}

  findAll(filters: DealFilters, user: RequestUser) {
    return this.prisma.deal.findMany({
      where: {
        stage: filters.stage,
        ownerId: filters.ownerId,
        companyId: filters.companyId,
        ...this.visibilityScope(user),
      },
      include: dealInclude,
      orderBy: [{ stage: "asc" }, { position: "asc" }],
    });
  }

  // Deals with a due-or-overdue rep-set follow-up date, still open. Same
  // shape as the Bulk-Email/Sequences findFollowUps() methods, but backed by
  // an explicit field instead of a derived "unopened after N days" rule.
  findFollowUps(user: RequestUser) {
    return this.prisma.deal.findMany({
      where: {
        followUpAt: { lte: new Date() },
        stage: { notIn: [DealStage.WON, DealStage.LOST, DealStage.ARCHIVED] },
        ...this.visibilityScope(user),
      },
      include: dealInclude,
      orderBy: { followUpAt: "asc" },
    });
  }

  private visibilityScope(user: RequestUser) {
    if (user.role.name === RoleName.ADMIN) {
      return {};
    }
    const isSales = (user.department?.name || "").toLowerCase().includes("sales");
    if (!isSales) {
      throw new ForbiddenException("Access denied: You do not have access to Sales deals");
    }
    if (user.role.name === RoleName.MANAGER) {
      return { departmentId: user.department?.id };
    }
    // Sales Employee: only assigned deals
    return {
      departmentId: user.department?.id,
      ownerId: user.id,
    };
  }

  async findOne(id: string, user?: RequestUser) {
    const deal = await this.prisma.deal.findUnique({ where: { id }, include: dealInclude });
    if (!deal) {
      throw new NotFoundException("Deal not found");
    }
    if (user && user.role.name !== RoleName.ADMIN) {
      const isSales = (user.department?.name || "").toLowerCase().includes("sales");
      if (!isSales) {
        throw new ForbiddenException("Access denied: You do not have access to Sales deals");
      }
      if (user.role.name === RoleName.EMPLOYEE && deal.ownerId !== user.id) {
        throw new ForbiddenException("Access denied: You can only view deals assigned to you");
      }
      if (user.role.name === RoleName.MANAGER && deal.departmentId && deal.departmentId !== user.department?.id) {
        throw new ForbiddenException("Access denied: This deal belongs to another department");
      }
    }
    return deal;
  }

  async create(dto: CreateDealDto, creator: RequestUser) {
    if (dto.companyId) {
      await this.assertCompanyExists(dto.companyId);
    }
    if (dto.contactId) {
      await this.assertContactExists(dto.contactId);
    }
    if (dto.ownerId) {
      await this.assertUserExists(dto.ownerId);
    }

    const stage = dto.stage ?? DealStage.NEW_LEAD;
    const position = await this.nextPosition(stage);

    const deal = await this.prisma.deal.create({
      data: {
        title: dto.title,
        value: dto.value ?? 0,
        stage,
        position,
        companyId: dto.companyId,
        contactId: dto.contactId,
        ownerId: dto.ownerId ?? creator.id,
        notes: dto.notes,
        expectedCloseDate: dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : undefined,
        closedAt: this.resolveClosedAt(stage),
        departmentId: dto.departmentId ?? creator.department?.id,
      },
      include: dealInclude,
    });

    await this.prisma.activity.create({
      data: {
        type: ActivityType.SYSTEM,
        content: `Deal created by ${creator.firstName} ${creator.lastName}`,
        dealId: deal.id,
        creatorId: creator.id,
      },
    });

    if (deal.contactId) {
      await this.engagementEvents.record({
        type: "DEAL_CREATED",
        contactId: deal.contactId,
        dealId: deal.id,
        ownerId: deal.ownerId,
        departmentId: deal.departmentId,
      });
    }

    if (stage === DealStage.WON) {
      this.offlineConversionService
        .uploadDealWonConversion(deal.id, deal.value)
        .catch((err) => this.logger.error(`Offline conversion trigger error: ${err.message}`));
    }

    return deal;
  }

  async update(id: string, dto: UpdateDealDto, user: RequestUser) {
    const deal = await this.getOwned(id);
    this.assertCanMutate(deal, user);

    if (dto.companyId) {
      await this.assertCompanyExists(dto.companyId);
    }
    if (dto.contactId) {
      await this.assertContactExists(dto.contactId);
    }
    if (dto.ownerId) {
      await this.assertUserExists(dto.ownerId);
    }

    // A plain Employee closing a big deal doesn't get to move it to WON
    // directly -- the stage change is withheld and flagged for a
    // Manager/Admin to approve() or reject() instead. Every other requested
    // field still applies normally.
    let threshold = 10000;
    if (deal.departmentId) {
      const dept = await this.prisma.department.findUnique({
        where: { id: deal.departmentId },
        select: { dealApprovalThreshold: true },
      });
      if (dept) {
        threshold = dept.dealApprovalThreshold;
      }
    }

    const requiresApproval =
      dto.stage === DealStage.WON &&
      deal.stage !== DealStage.WON &&
      user.role.name === RoleName.EMPLOYEE &&
      (dto.value ?? deal.value) > threshold;

    const stage = requiresApproval ? undefined : dto.stage;
    const approvalStatus = requiresApproval
      ? DealApprovalStatus.PENDING
      : dto.stage !== undefined
        ? DealApprovalStatus.NONE
        : undefined;

    const updated = await this.prisma.deal.update({
      where: { id },
      data: {
        title: dto.title,
        value: dto.value,
        stage,
        position: dto.position,
        companyId: dto.companyId,
        contactId: dto.contactId,
        ownerId: dto.ownerId,
        notes: dto.notes,
        expectedCloseDate:
          dto.expectedCloseDate === undefined
            ? undefined
            : dto.expectedCloseDate
              ? new Date(dto.expectedCloseDate)
              : null,
        closedAt: this.resolveClosedAt(stage),
        departmentId: dto.departmentId,
        approvalStatus,
        followUpAt:
          dto.followUpAt === undefined
            ? undefined
            : dto.followUpAt
              ? new Date(dto.followUpAt)
              : null,
        // Any change to followUpAt (new date, or cleared) means the previous
        // notification is stale -- let DealFollowUpsService re-evaluate it.
        followUpNotifiedAt: dto.followUpAt === undefined ? undefined : null,
      },
      include: dealInclude,
    });

    // Logging system updates
    if (dto.value !== undefined && dto.value !== deal.value) {
      await this.prisma.activity.create({
        data: {
          type: ActivityType.SYSTEM,
          content: `Value updated from $${deal.value.toLocaleString()} to $${dto.value.toLocaleString()}`,
          dealId: id,
          creatorId: user.id,
        },
      });
    }

    if (dto.stage !== undefined && stage !== deal.stage && stage !== undefined) {
      await this.prisma.activity.create({
        data: {
          type: ActivityType.SYSTEM,
          content: `Stage updated from ${deal.stage} to ${stage}`,
          dealId: id,
          creatorId: user.id,
        },
      });

      if (updated.contactId) {
        await this.engagementEvents.record({
          type: "DEAL_STAGE_CHANGED",
          contactId: updated.contactId,
          dealId: id,
          ownerId: updated.ownerId,
          departmentId: updated.departmentId,
          metadata: { fromStage: deal.stage, toStage: stage },
        });
      }

      // Offline Conversion Tracking: If deal moved to WON, send conversion to Google Ads Smart Bidding
      if (stage === DealStage.WON && deal.stage !== DealStage.WON) {
        this.offlineConversionService
          .uploadDealWonConversion(id, dto.value ?? deal.value)
          .catch((err) => this.logger.error(`Offline conversion trigger error: ${err.message}`));
      }
    }

    if (requiresApproval) {
      await this.prisma.activity.create({
        data: {
          type: ActivityType.SYSTEM,
          content: `Approval requested: value ($${(dto.value ?? deal.value).toLocaleString()}) exceeds limit ($${threshold.toLocaleString()})`,
          dealId: id,
          creatorId: user.id,
        },
      });
    }

    return updated;
  }

  // Soft-archive rather than delete -- ARCHIVED is already a pipeline stage,
  // so this preserves history exactly like ProjectsService.archive().
  async archive(id: string, user: RequestUser) {
    const deal = await this.getOwned(id);
    this.assertCanMutate(deal, user);

    return this.prisma.deal.update({
      where: { id },
      data: { stage: DealStage.ARCHIVED },
      include: dealInclude,
    });
  }

  // Approve/reject a deal an Employee tried to close above the threshold.
  // Deliberately gated by assertCanApprove, not assertCanMutate -- letting
  // the Employee who requested it approve their own request would defeat
  // the point of requiring sign-off.
  async approve(id: string, user: RequestUser) {
    const deal = await this.getOwned(id);
    this.assertCanApprove(deal, user);

    const updated = await this.prisma.deal.update({
      where: { id },
      data: {
        stage: DealStage.WON,
        approvalStatus: DealApprovalStatus.APPROVED,
        closedAt: new Date(),
      },
      include: dealInclude,
    });

    await this.prisma.activity.create({
      data: {
        type: ActivityType.SYSTEM,
        content: `Deal approved by ${user.firstName} ${user.lastName} (Stage set to WON)`,
        dealId: id,
        creatorId: user.id,
      },
    });

    if (updated.contactId) {
      await this.engagementEvents.record({
        type: "DEAL_STAGE_CHANGED",
        contactId: updated.contactId,
        dealId: id,
        ownerId: updated.ownerId,
        departmentId: updated.departmentId,
        metadata: { fromStage: deal.stage, toStage: "WON" },
      });
    }

    return updated;
  }

  async reject(id: string, user: RequestUser) {
    const deal = await this.getOwned(id);
    this.assertCanApprove(deal, user);

    const updated = await this.prisma.deal.update({
      where: { id },
      data: { approvalStatus: DealApprovalStatus.REJECTED },
      include: dealInclude,
    });

    await this.prisma.activity.create({
      data: {
        type: ActivityType.SYSTEM,
        content: `Deal rejected by ${user.firstName} ${user.lastName}`,
        dealId: id,
        creatorId: user.id,
      },
    });

    return updated;
  }

  // undefined = stage not changing, don't touch closedAt. WON/LOST = just
  // closed, stamp now. Anything else = moved back to an open stage, clear it
  // (e.g. reopened from Lost).
  private resolveClosedAt(newStage: DealStage | undefined): Date | null | undefined {
    if (newStage === undefined) {
      return undefined;
    }
    return newStage === DealStage.WON || newStage === DealStage.LOST ? new Date() : null;
  }

  private async nextPosition(stage: DealStage): Promise<number> {
    const last = await this.prisma.deal.findFirst({
      where: { stage },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }

  private async getOwned(id: string) {
    const deal = await this.prisma.deal.findUnique({ where: { id } });
    if (!deal) {
      throw new NotFoundException("Deal not found");
    }
    return deal;
  }

  private async assertCompanyExists(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException("Company not found");
    }
  }

  private async assertContactExists(contactId: string) {
    const contact = await this.prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact) {
      throw new NotFoundException("Contact not found");
    }
  }

  private async assertUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Owner not found");
    }
  }

  // TODO: revisit ACL model -- creator-defaulted owner, ADMIN, or a
  // same-department MANAGER only, for now. See TasksService.assertCanMutate
  // for the full rationale (phase 6).
  private assertCanMutate(
    deal: { ownerId: string; departmentId: string | null },
    user: RequestUser,
  ) {
    if (user.role.name === RoleName.ADMIN) return;
    const isSales = (user.department?.name || "").toLowerCase().includes("sales");
    if (!isSales) {
      throw new ForbiddenException("Access denied: You do not belong to the Sales department");
    }
    const isOwner = deal.ownerId === user.id;
    const isDeptManager =
      user.role.name === RoleName.MANAGER && deal.departmentId === user.department?.id;
    if (!isOwner && !isDeptManager) {
      throw new ForbiddenException("You do not have permission to modify this deal");
    }
  }

  // Narrower than assertCanMutate above -- no owner branch (see approve/reject).
  private assertCanApprove(
    deal: { departmentId: string | null; approvalStatus: DealApprovalStatus },
    user: RequestUser,
  ) {
    if (deal.approvalStatus !== DealApprovalStatus.PENDING) {
      throw new BadRequestException("This deal has no pending approval request");
    }
    if (user.role.name === RoleName.ADMIN) return;
    const isSales = (user.department?.name || "").toLowerCase().includes("sales");
    if (!isSales) {
      throw new ForbiddenException("Access denied: You do not belong to the Sales department");
    }
    const isDeptManager =
      user.role.name === RoleName.MANAGER && deal.departmentId === user.department?.id;
    if (!isDeptManager) {
      throw new ForbiddenException("You do not have permission to approve this deal");
    }
  }
}
