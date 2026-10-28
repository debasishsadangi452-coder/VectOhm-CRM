import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateHiringSignalAutomationDto } from "./dto/create-hiring-signal-automation.dto";
import { UpdateHiringSignalAutomationDto } from "./dto/update-hiring-signal-automation.dto";
import { canUseSalesOutreach } from "../../common/utils/sales-access";
import { DEFAULT_TARGET_TITLES } from "./role-priority.util";
import type { RequestUser } from "../../common/types/request-user.type";

const automationInclude = {
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  sequence: { select: { id: true, name: true } },
  _count: { select: { signals: true } },
} as const;

// CRUD for HiringSignalAutomation -- the discovery/enrichment/enrollment
// logic itself lives in HiringSignalsDiscoveryService. Gated the same way as
// every other Apollo/Sequences outreach tool (canUseSalesOutreach): Sales
// department or Admin, not siloed per-creator, matching
// SequencesService.getOwnedSequence's actual behavior (any Sales user can
// manage any sequence/automation).
@Injectable()
export class HiringSignalAutomationService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(user: RequestUser) {
    this.assertCanUse(user);
    return this.prisma.hiringSignalAutomation.findMany({
      include: automationInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string, user: RequestUser) {
    this.assertCanUse(user);
    return this.getOrThrow(id);
  }

  create(dto: CreateHiringSignalAutomationDto, user: RequestUser) {
    this.assertCanUse(user);
    return this.prisma.hiringSignalAutomation.create({
      data: {
        name: dto.name,
        industries: dto.industries ?? [],
        locations: dto.locations ?? [],
        keywords: dto.keywords,
        adzunaEnabled: dto.adzunaEnabled ?? false,
        adzunaRoleKeywords: dto.adzunaRoleKeywords ?? [],
        targetTitles: dto.targetTitles && dto.targetTitles.length > 0 ? dto.targetTitles : DEFAULT_TARGET_TITLES,
        sequenceId: dto.sequenceId,
        createdById: user.id,
      },
      include: automationInclude,
    });
  }

  async update(id: string, dto: UpdateHiringSignalAutomationDto, user: RequestUser) {
    this.assertCanUse(user);
    await this.getOrThrow(id);
    return this.prisma.hiringSignalAutomation.update({
      where: { id },
      data: {
        name: dto.name,
        isActive: dto.isActive,
        industries: dto.industries,
        locations: dto.locations,
        keywords: dto.keywords,
        adzunaEnabled: dto.adzunaEnabled,
        adzunaRoleKeywords: dto.adzunaRoleKeywords,
        targetTitles: dto.targetTitles,
        sequenceId: dto.sequenceId,
      },
      include: automationInclude,
    });
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    this.assertCanUse(user);
    await this.getOrThrow(id);
    await this.prisma.hiringSignalAutomation.delete({ where: { id } });
  }

  async recentSignals(id: string, user: RequestUser) {
    this.assertCanUse(user);
    await this.getOrThrow(id);
    return this.prisma.hiringSignal.findMany({
      where: { automationId: id },
      include: { company: { select: { id: true, name: true, domain: true } } },
      orderBy: { detectedAt: "desc" },
      take: 100,
    });
  }

  private async getOrThrow(id: string) {
    const automation = await this.prisma.hiringSignalAutomation.findUnique({ where: { id } });
    if (!automation) {
      throw new NotFoundException("Hiring signal automation not found");
    }
    return automation;
  }

  private assertCanUse(user: RequestUser) {
    if (!canUseSalesOutreach(user)) {
      throw new ForbiddenException("Hiring signal automations are only available to the Sales department");
    }
  }
}
