import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateEpicDto } from "./dto/create-epic.dto";
import { UpdateEpicDto } from "./dto/update-epic.dto";
import type { RequestUser } from "../../common/types/request-user.type";

const epicInclude = {
  department: { select: { id: true, name: true } },
} as const;

@Injectable()
export class EpicsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEpicDto, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const departmentId = dto.departmentId ?? user.department?.id;
    if (!departmentId) {
      throw new ForbiddenException("Epics must belong to a specific department");
    }
    if (!isAdmin && departmentId !== user.department?.id) {
      throw new ForbiddenException("You cannot create an epic for another department");
    }

    return this.prisma.epic.create({
      data: { name: dto.name, description: dto.description, status: dto.status, departmentId },
      include: epicInclude,
    });
  }

  findAll(departmentId: string | undefined, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const scopedDepartmentId = isAdmin ? departmentId : user.department?.id;
    if (!isAdmin && !scopedDepartmentId) {
      return [];
    }
    return this.prisma.epic.findMany({
      where: scopedDepartmentId ? { departmentId: scopedDepartmentId } : undefined,
      include: { ...epicInclude, _count: { select: { tasks: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string, user: RequestUser) {
    const epic = await this.prisma.epic.findUnique({
      where: { id },
      include: { ...epicInclude, tasks: true },
    });
    if (!epic) {
      throw new NotFoundException("Epic not found");
    }
    this.assertCanAccess(epic, user);
    return epic;
  }

  async update(id: string, dto: UpdateEpicDto, user: RequestUser) {
    const epic = await this.getOwned(id);
    this.assertCanMutate(epic, user);
    return this.prisma.epic.update({
      where: { id },
      data: { name: dto.name, description: dto.description, status: dto.status },
      include: epicInclude,
    });
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const epic = await this.getOwned(id);
    this.assertCanMutate(epic, user);
    await this.prisma.epic.delete({ where: { id } });
  }

  private async getOwned(id: string) {
    const epic = await this.prisma.epic.findUnique({ where: { id } });
    if (!epic) {
      throw new NotFoundException("Epic not found");
    }
    return epic;
  }

  private assertCanAccess(epic: { departmentId: string }, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    if (!isAdmin && epic.departmentId !== user.department?.id) {
      throw new ForbiddenException("You do not have access to this department's epics");
    }
  }

  private assertCanMutate(epic: { departmentId: string }, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const isDeptManager = user.role.name === RoleName.MANAGER && epic.departmentId === user.department?.id;
    if (!isAdmin && !isDeptManager) {
      throw new ForbiddenException("Only a Manager or Admin can modify this epic");
    }
  }
}
