import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateSeoMarketingCampaignDto } from "./dto/create-seo-marketing-campaign.dto";
import { UpdateSeoMarketingCampaignDto } from "./dto/update-seo-marketing-campaign.dto";
import type { RequestUser } from "../../common/types/request-user.type";

@Injectable()
export class SeoMarketingCampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSeoMarketingCampaignDto, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const departmentId = dto.departmentId ?? user.department?.id;
    if (!departmentId) {
      throw new ForbiddenException("Marketing campaigns must belong to a specific department");
    }
    if (!isAdmin && departmentId !== user.department?.id) {
      throw new ForbiddenException("You cannot create a campaign for another department");
    }

    return this.prisma.marketingCampaign.create({
      data: {
        name: dto.name,
        description: dto.description,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        budget: dto.budget,
        spent: dto.spent,
        targetLeads: dto.targetLeads,
        status: dto.status,
        projectId: dto.projectId,
        departmentId,
      },
    });
  }

  findAll(departmentId: string | undefined, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const scopedDepartmentId = isAdmin ? departmentId : user.department?.id;
    if (!isAdmin && !scopedDepartmentId) {
      return [];
    }
    return this.prisma.marketingCampaign.findMany({
      where: scopedDepartmentId ? { departmentId: scopedDepartmentId } : undefined,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string, user: RequestUser) {
    const campaign = await this.prisma.marketingCampaign.findUnique({ where: { id } });
    if (!campaign) {
      throw new NotFoundException("Marketing campaign not found");
    }
    this.assertCanAccess(campaign, user);
    return campaign;
  }

  async update(id: string, dto: UpdateSeoMarketingCampaignDto, user: RequestUser) {
    const campaign = await this.getOwned(id);
    this.assertCanMutate(campaign, user);
    return this.prisma.marketingCampaign.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate === undefined ? undefined : dto.endDate ? new Date(dto.endDate) : null,
        budget: dto.budget,
        spent: dto.spent,
        targetLeads: dto.targetLeads,
        status: dto.status,
        projectId: dto.projectId,
      },
    });
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const campaign = await this.getOwned(id);
    this.assertCanMutate(campaign, user);
    await this.prisma.marketingCampaign.delete({ where: { id } });
  }

  private async getOwned(id: string) {
    const campaign = await this.prisma.marketingCampaign.findUnique({ where: { id } });
    if (!campaign) {
      throw new NotFoundException("Marketing campaign not found");
    }
    return campaign;
  }

  private assertCanAccess(campaign: { departmentId: string }, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    if (!isAdmin && campaign.departmentId !== user.department?.id) {
      throw new ForbiddenException(
        "You do not have access to this department's marketing campaigns",
      );
    }
  }

  private assertCanMutate(campaign: { departmentId: string }, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const isDeptManager =
      user.role.name === RoleName.MANAGER && campaign.departmentId === user.department?.id;
    if (!isAdmin && !isDeptManager) {
      throw new ForbiddenException("Only a Manager or Admin can modify marketing campaigns");
    }
  }
}
