import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateSeoKpiGoalDto } from "./dto/create-seo-kpi-goal.dto";
import { UpdateSeoKpiGoalDto } from "./dto/update-seo-kpi-goal.dto";
import type { RequestUser } from "../../common/types/request-user.type";

@Injectable()
export class SeoKpiGoalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSeoKpiGoalDto, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const departmentId = dto.departmentId ?? user.department?.id;
    if (!departmentId) {
      throw new ForbiddenException("KPI goals must belong to a specific department");
    }
    if (!isAdmin && departmentId !== user.department?.id) {
      throw new ForbiddenException("You cannot create a KPI goal for another department");
    }

    return this.prisma.seoKpiGoal.create({
      data: {
        title: dto.title,
        metricType: dto.metricType,
        targetValue: dto.targetValue,
        currentValue: dto.currentValue,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
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
    return this.prisma.seoKpiGoal.findMany({
      where: scopedDepartmentId ? { departmentId: scopedDepartmentId } : undefined,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string, user: RequestUser) {
    const goal = await this.prisma.seoKpiGoal.findUnique({ where: { id } });
    if (!goal) {
      throw new NotFoundException("KPI goal not found");
    }
    this.assertCanAccess(goal, user);
    return goal;
  }

  async update(id: string, dto: UpdateSeoKpiGoalDto, user: RequestUser) {
    const goal = await this.getOwned(id);
    this.assertCanMutate(goal, user);
    return this.prisma.seoKpiGoal.update({
      where: { id },
      data: {
        title: dto.title,
        metricType: dto.metricType,
        targetValue: dto.targetValue,
        currentValue: dto.currentValue,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        projectId: dto.projectId,
      },
    });
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const goal = await this.getOwned(id);
    this.assertCanMutate(goal, user);
    await this.prisma.seoKpiGoal.delete({ where: { id } });
  }

  private async getOwned(id: string) {
    const goal = await this.prisma.seoKpiGoal.findUnique({ where: { id } });
    if (!goal) {
      throw new NotFoundException("KPI goal not found");
    }
    return goal;
  }

  private assertCanAccess(goal: { departmentId: string }, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    if (!isAdmin && goal.departmentId !== user.department?.id) {
      throw new ForbiddenException("You do not have access to this department's KPI goals");
    }
  }

  private assertCanMutate(goal: { departmentId: string }, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const isDeptManager =
      user.role.name === RoleName.MANAGER && goal.departmentId === user.department?.id;
    if (!isAdmin && !isDeptManager) {
      throw new ForbiddenException("Only a Manager or Admin can modify KPI goals");
    }
  }
}
