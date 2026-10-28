import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateSeoAuditDto } from "./dto/create-seo-audit.dto";
import { UpdateSeoAuditDto } from "./dto/update-seo-audit.dto";
import type { RequestUser } from "../../common/types/request-user.type";

const seoAuditInclude = {
  department: { select: { id: true, name: true } },
} as const;

@Injectable()
export class SeoAuditsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSeoAuditDto, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const departmentId = dto.departmentId ?? user.department?.id;
    if (!departmentId) {
      throw new ForbiddenException("SEO audits must belong to a specific department");
    }
    if (!isAdmin && departmentId !== user.department?.id) {
      throw new ForbiddenException("You cannot create an audit for another department");
    }

    return this.prisma.seoAudit.create({
      data: { url: dto.url, score: dto.score, issues: dto.issues, departmentId },
      include: seoAuditInclude,
    });
  }

  findAll(departmentId: string | undefined, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const scopedDepartmentId = isAdmin ? departmentId : user.department?.id;
    if (!isAdmin && !scopedDepartmentId) {
      return [];
    }
    return this.prisma.seoAudit.findMany({
      where: scopedDepartmentId ? { departmentId: scopedDepartmentId } : undefined,
      include: seoAuditInclude,
      orderBy: { runAt: "desc" },
    });
  }

  async findOne(id: string, user: RequestUser) {
    const audit = await this.prisma.seoAudit.findUnique({ where: { id }, include: seoAuditInclude });
    if (!audit) {
      throw new NotFoundException("SEO audit not found");
    }
    this.assertCanAccess(audit, user);
    return audit;
  }

  async update(id: string, dto: UpdateSeoAuditDto, user: RequestUser) {
    const audit = await this.getOwned(id);
    this.assertCanMutate(audit, user);
    return this.prisma.seoAudit.update({ where: { id }, data: dto, include: seoAuditInclude });
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const audit = await this.getOwned(id);
    this.assertCanMutate(audit, user);
    await this.prisma.seoAudit.delete({ where: { id } });
  }

  private async getOwned(id: string) {
    const audit = await this.prisma.seoAudit.findUnique({ where: { id } });
    if (!audit) {
      throw new NotFoundException("SEO audit not found");
    }
    return audit;
  }

  private assertCanAccess(audit: { departmentId: string }, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    if (!isAdmin && audit.departmentId !== user.department?.id) {
      throw new ForbiddenException("You do not have access to this department's SEO audits");
    }
  }

  private assertCanMutate(audit: { departmentId: string }, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const isDeptManager = user.role.name === RoleName.MANAGER && audit.departmentId === user.department?.id;
    if (!isAdmin && !isDeptManager) {
      throw new ForbiddenException("Only a Manager or Admin can modify SEO audits");
    }
  }
}
