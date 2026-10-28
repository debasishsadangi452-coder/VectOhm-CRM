import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AttendanceAdjustmentStatus, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../common/types/request-user.type";
import { dayKey } from "../work-sessions/work-policy";

// Only the owner reviews these; only Jivan asks.
export const LATE_START_APPROVER_EMAIL = "admin@venusglobaltech.com";
export const LATE_START_REQUESTER_EMAIL = "jivan@venushiring.com";
export const MAX_LATE_START_MIN = 360;

const personSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  department: { select: { id: true, name: true } },
} as const;
const decidedBySelect = { select: { id: true, firstName: true, lastName: true } } as const;

@Injectable()
export class LateStartRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  private assertApprover(user: RequestUser) {
    if (user.role.name !== RoleName.ADMIN || user.email.toLowerCase() !== LATE_START_APPROVER_EMAIL) {
      throw new ForbiddenException("Only the owner can review late-start requests");
    }
  }

  // Today's request for the person (any status), so the prompt knows not to ask twice.
  today(user: RequestUser) {
    return this.prisma.lateStartRequest.findFirst({
      where: { userId: user.id, forDay: dayKey(new Date()) },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(user: RequestUser, expectedLateMin: number) {
    if (user.email.toLowerCase() !== LATE_START_REQUESTER_EMAIL) {
      throw new ForbiddenException("Late-start requests are not available for this account");
    }
    if (!Number.isInteger(expectedLateMin) || expectedLateMin < 1 || expectedLateMin > MAX_LATE_START_MIN) {
      throw new BadRequestException(`Enter between 1 and ${MAX_LATE_START_MIN} minutes`);
    }
    const existing = await this.today(user);
    if (existing && existing.status !== AttendanceAdjustmentStatus.DENIED) return existing;
    return this.prisma.lateStartRequest.create({
      data: { userId: user.id, forDay: dayKey(new Date()), expectedLateMin },
    });
  }

  async list(admin: RequestUser, status?: string) {
    this.assertApprover(admin);
    const where =
      status && status in AttendanceAdjustmentStatus ? { status: status as AttendanceAdjustmentStatus } : {};
    return this.prisma.lateStartRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: personSelect }, decidedBy: decidedBySelect },
    });
  }

  async decide(admin: RequestUser, id: string, approve: boolean) {
    this.assertApprover(admin);
    const request = await this.prisma.lateStartRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException("Late-start request not found");
    if (request.userId === admin.id) throw new BadRequestException("You cannot decide your own request");

    // Guarded update: can't be decided twice.
    const claimed = await this.prisma.lateStartRequest.updateMany({
      where: { id, status: AttendanceAdjustmentStatus.PENDING },
      data: {
        status: approve ? AttendanceAdjustmentStatus.APPROVED : AttendanceAdjustmentStatus.DENIED,
        decidedById: admin.id,
        decidedAt: new Date(),
      },
    });
    if (claimed.count === 0) throw new ConflictException("This request was already decided");

    return this.prisma.lateStartRequest.findUnique({
      where: { id },
      include: { user: { select: personSelect }, decidedBy: decidedBySelect },
    });
  }
}
