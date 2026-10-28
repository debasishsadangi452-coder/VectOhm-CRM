import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateReleaseDto } from "./dto/create-release.dto";
import { UpdateReleaseDto } from "./dto/update-release.dto";
import type { RequestUser } from "../../common/types/request-user.type";

const releaseInclude = {
  department: { select: { id: true, name: true } },
} as const;

@Injectable()
export class ReleasesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateReleaseDto, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const departmentId = dto.departmentId ?? user.department?.id;
    if (!departmentId) {
      throw new ForbiddenException("Releases must belong to a specific department");
    }
    if (!isAdmin && departmentId !== user.department?.id) {
      throw new ForbiddenException("You cannot create a release for another department");
    }

    return this.prisma.release.create({
      data: {
        versionName: dto.versionName,
        releaseDate: dto.releaseDate ? new Date(dto.releaseDate) : undefined,
        status: dto.status,
        departmentId,
      },
      include: releaseInclude,
    });
  }

  findAll(departmentId: string | undefined, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const scopedDepartmentId = isAdmin ? departmentId : user.department?.id;
    if (!isAdmin && !scopedDepartmentId) {
      return [];
    }
    return this.prisma.release.findMany({
      where: scopedDepartmentId ? { departmentId: scopedDepartmentId } : undefined,
      include: { ...releaseInclude, _count: { select: { tasks: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string, user: RequestUser) {
    const release = await this.prisma.release.findUnique({
      where: { id },
      include: { ...releaseInclude, tasks: true },
    });
    if (!release) {
      throw new NotFoundException("Release not found");
    }
    this.assertCanAccess(release, user);
    return release;
  }

  async update(id: string, dto: UpdateReleaseDto, user: RequestUser) {
    const release = await this.getOwned(id);
    this.assertCanMutate(release, user);
    return this.prisma.release.update({
      where: { id },
      data: {
        versionName: dto.versionName,
        releaseDate: dto.releaseDate === undefined ? undefined : dto.releaseDate ? new Date(dto.releaseDate) : null,
        status: dto.status,
      },
      include: releaseInclude,
    });
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const release = await this.getOwned(id);
    this.assertCanMutate(release, user);
    await this.prisma.release.delete({ where: { id } });
  }

  private async getOwned(id: string) {
    const release = await this.prisma.release.findUnique({ where: { id } });
    if (!release) {
      throw new NotFoundException("Release not found");
    }
    return release;
  }

  private assertCanAccess(release: { departmentId: string }, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    if (!isAdmin && release.departmentId !== user.department?.id) {
      throw new ForbiddenException("You do not have access to this department's releases");
    }
  }

  private assertCanMutate(release: { departmentId: string }, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const isDeptManager = user.role.name === RoleName.MANAGER && release.departmentId === user.department?.id;
    if (!isAdmin && !isDeptManager) {
      throw new ForbiddenException("Only a Manager or Admin can modify this release");
    }
  }
}
