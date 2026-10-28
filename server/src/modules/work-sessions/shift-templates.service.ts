import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { isHrUser } from "../../common/utils/directory-access";
import type { RequestUser } from "../../common/types/request-user.type";
import { SHIFT_TIME_RE } from "./work-policy";

const MAX_APPLY = 500;

/**
 * Reusable working hours ("9-6 Sales") so HR doesn't have to type the same two
 * times into every employee. A template is a convenience: applying it copies its
 * times onto the people chosen (it isn't a live link, so editing a template later
 * doesn't silently change anyone's hours).
 */
@Injectable()
export class ShiftTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  private assertCanManage(user: RequestUser) {
    if (user.role.name !== RoleName.ADMIN && !isHrUser(user)) {
      throw new ForbiddenException("Only Admin and HR can manage shift templates.");
    }
  }

  private validate(name: string, shiftStart: string, shiftEnd: string) {
    if (!name.trim()) throw new BadRequestException("A template needs a name.");
    if (!SHIFT_TIME_RE.test(shiftStart) || !SHIFT_TIME_RE.test(shiftEnd)) {
      throw new BadRequestException("Times must be HH:MM (24-hour).");
    }
    if (shiftStart === shiftEnd) throw new BadRequestException("Shift start and end can't be the same time.");
  }

  list(user: RequestUser) {
    this.assertCanManage(user);
    return this.prisma.shiftTemplate.findMany({ orderBy: [{ shiftStart: "asc" }, { name: "asc" }] });
  }

  async create(user: RequestUser, dto: { name: string; shiftStart: string; shiftEnd: string }) {
    this.assertCanManage(user);
    const name = dto.name.trim();
    this.validate(name, dto.shiftStart, dto.shiftEnd);
    if (await this.prisma.shiftTemplate.findUnique({ where: { name } })) {
      throw new ConflictException(`A template called "${name}" already exists.`);
    }
    return this.prisma.shiftTemplate.create({ data: { name, shiftStart: dto.shiftStart, shiftEnd: dto.shiftEnd } });
  }

  async update(user: RequestUser, id: string, dto: { name?: string; shiftStart?: string; shiftEnd?: string }) {
    this.assertCanManage(user);
    const existing = await this.prisma.shiftTemplate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Shift template not found.");
    const name = (dto.name ?? existing.name).trim();
    const shiftStart = dto.shiftStart ?? existing.shiftStart;
    const shiftEnd = dto.shiftEnd ?? existing.shiftEnd;
    this.validate(name, shiftStart, shiftEnd);
    if (name !== existing.name && (await this.prisma.shiftTemplate.findUnique({ where: { name } }))) {
      throw new ConflictException(`A template called "${name}" already exists.`);
    }
    return this.prisma.shiftTemplate.update({ where: { id }, data: { name, shiftStart, shiftEnd } });
  }

  async remove(user: RequestUser, id: string) {
    this.assertCanManage(user);
    const existing = await this.prisma.shiftTemplate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Shift template not found.");
    await this.prisma.shiftTemplate.delete({ where: { id } });
    return { success: true };
  }

  /** Copies the template's hours onto each chosen user. Returns how many people were updated. */
  async apply(user: RequestUser, id: string, userIds: string[]) {
    this.assertCanManage(user);
    const template = await this.prisma.shiftTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException("Shift template not found.");
    const unique = Array.from(new Set(userIds));
    if (unique.length === 0) throw new BadRequestException("Choose at least one person.");
    if (unique.length > MAX_APPLY) throw new BadRequestException(`Choose at most ${MAX_APPLY} people at a time.`);

    const result = await this.prisma.user.updateMany({
      where: { id: { in: unique }, isActive: true },
      data: { shiftStart: template.shiftStart, shiftEnd: template.shiftEnd },
    });
    return { updated: result.count, shiftStart: template.shiftStart, shiftEnd: template.shiftEnd };
  }
}
