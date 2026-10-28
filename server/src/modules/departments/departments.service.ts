import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";
import { UpdateDepartmentSettingsDto } from "./dto/update-department-settings.dto";
import { canManageDirectory } from "../../common/utils/directory-access";
import type { RequestUser } from "../../common/types/request-user.type";

const departmentInclude = {
  head: { select: { id: true, firstName: true, lastName: true } },
  _count: { select: { employees: true } },
} as const;

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.department.findMany({ include: departmentInclude, orderBy: { name: "asc" } });
  }

  async findOne(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        ...departmentInclude,
        employees: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
      },
    });
    if (!department) {
      throw new NotFoundException("Department not found");
    }
    return department;
  }

  async create(dto: CreateDepartmentDto, actor: RequestUser) {
    this.assertCanManageDirectory(actor);
    const existing = await this.prisma.department.findUnique({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException("Department name already in use");
    }
    if (dto.headId) {
      await this.assertUserExists(dto.headId);
    }

    return this.prisma.department.create({
      data: { name: dto.name, description: dto.description, headId: dto.headId },
      include: departmentInclude,
    });
  }

  async update(id: string, dto: UpdateDepartmentDto, actor: RequestUser) {
    this.assertCanManageDirectory(actor);
    await this.getOwned(id);

    if (dto.name) {
      const existing = await this.prisma.department.findUnique({ where: { name: dto.name } });
      if (existing && existing.id !== id) {
        throw new ConflictException("Department name already in use");
      }
    }
    if (dto.headId) {
      await this.assertUserExists(dto.headId);
    }

    return this.prisma.department.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        headId: dto.headId,
        monthlyTarget: dto.monthlyTarget,
        dealApprovalThreshold: dto.dealApprovalThreshold,
      },
      include: departmentInclude,
    });
  }

  async updateSettings(id: string, dto: UpdateDepartmentSettingsDto, user: RequestUser) {
    const isDeptManager = user.role.name === RoleName.MANAGER && user.department?.id === id;
    const isAdmin = user.role.name === RoleName.ADMIN;
    if (!isAdmin && !isDeptManager) {
      throw new ForbiddenException("You do not have permission to update settings for this department");
    }

    await this.getOwned(id);

    return this.prisma.department.update({
      where: { id },
      data: {
        monthlyTarget: dto.monthlyTarget,
        dealApprovalThreshold: dto.dealApprovalThreshold,
      },
      include: departmentInclude,
    });
  }

  // Deliberately no pre-delete member-count guard -- the schema's onDelete: SetNull
  // on User.departmentId already unassigns members automatically.
  async remove(id: string) {
    await this.getOwned(id);
    await this.prisma.department.delete({ where: { id } });
  }

  private async getOwned(id: string) {
    const department = await this.prisma.department.findUnique({ where: { id } });
    if (!department) {
      throw new NotFoundException("Department not found");
    }
    return department;
  }

  private async assertUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Head user not found");
    }
  }

  private assertCanManageDirectory(actor: RequestUser) {
    if (!canManageDirectory(actor)) {
      throw new ForbiddenException("You do not have permission to manage departments");
    }
  }
}
