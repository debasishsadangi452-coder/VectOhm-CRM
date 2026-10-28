import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateSeoCompetitorDto } from "./dto/create-seo-competitor.dto";
import { UpdateSeoCompetitorDto } from "./dto/update-seo-competitor.dto";
import type { RequestUser } from "../../common/types/request-user.type";

@Injectable()
export class SeoCompetitorsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSeoCompetitorDto, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const departmentId = dto.departmentId ?? user.department?.id;
    if (!departmentId) {
      throw new ForbiddenException("SEO competitors must belong to a specific department");
    }
    if (!isAdmin && departmentId !== user.department?.id) {
      throw new ForbiddenException("You cannot create a competitor for another department");
    }

    return this.prisma.seoCompetitor.create({
      data: { domain: dto.domain, da: dto.da, traffic: dto.traffic, departmentId },
    });
  }

  findAll(departmentId: string | undefined, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const scopedDepartmentId = isAdmin ? departmentId : user.department?.id;
    if (!isAdmin && !scopedDepartmentId) {
      return [];
    }
    return this.prisma.seoCompetitor.findMany({
      where: scopedDepartmentId ? { departmentId: scopedDepartmentId } : undefined,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string, user: RequestUser) {
    const competitor = await this.prisma.seoCompetitor.findUnique({ where: { id } });
    if (!competitor) {
      throw new NotFoundException("SEO competitor not found");
    }
    this.assertCanAccess(competitor, user);
    return competitor;
  }

  async update(id: string, dto: UpdateSeoCompetitorDto, user: RequestUser) {
    const competitor = await this.getOwned(id);
    this.assertCanMutate(competitor, user);
    return this.prisma.seoCompetitor.update({ where: { id }, data: dto });
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const competitor = await this.getOwned(id);
    this.assertCanMutate(competitor, user);
    await this.prisma.seoCompetitor.delete({ where: { id } });
  }

  private async getOwned(id: string) {
    const competitor = await this.prisma.seoCompetitor.findUnique({ where: { id } });
    if (!competitor) {
      throw new NotFoundException("SEO competitor not found");
    }
    return competitor;
  }

  private assertCanAccess(competitor: { departmentId: string }, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    if (!isAdmin && competitor.departmentId !== user.department?.id) {
      throw new ForbiddenException("You do not have access to this department's SEO competitors");
    }
  }

  private assertCanMutate(competitor: { departmentId: string }, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const isDeptManager = user.role.name === RoleName.MANAGER && competitor.departmentId === user.department?.id;
    if (!isAdmin && !isDeptManager) {
      throw new ForbiddenException("Only a Manager or Admin can modify SEO competitors");
    }
  }
}
