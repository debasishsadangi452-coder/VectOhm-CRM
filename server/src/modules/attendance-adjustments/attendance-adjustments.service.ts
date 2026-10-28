import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AttendanceAdjustmentStatus, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../common/types/request-user.type";

const DAY_MS = 24 * 60 * 60 * 1000;

export const ADJUSTMENT_APPROVER_EMAIL = "admin@venusglobaltech.com";
// The one account that can ask for an adjustment.
export const ADJUSTMENT_REQUESTER_EMAIL = "jivan@venushiring.com";

const personSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  department: { select: { id: true, name: true } },
} as const;

const decidedBySelect = { select: { id: true, firstName: true, lastName: true } } as const;

@Injectable()
export class AttendanceAdjustmentsService {
  constructor(private readonly prisma: PrismaService) {}

  // Only the owner account reviews these; other admins neither see nor decide them.
  private assertApprover(user: RequestUser) {
    if (user.role.name !== RoleName.ADMIN || user.email.toLowerCase() !== ADJUSTMENT_APPROVER_EMAIL) {
      throw new ForbiddenException("Only the owner can review attendance adjustments");
    }
  }

  // The most recent session the person really worked (never an approved adjustment).
  private latestRealSession(userId: string) {
    return this.prisma.workSession.findFirst({
      where: { userId, adjustmentRequestId: null, clockOutAt: { not: null }, durationMin: { not: null } },
      orderBy: { clockInAt: "desc" },
    });
  }

  async create(user: RequestUser, forDate: string, reason: string) {
    if (user.email.toLowerCase() !== ADJUSTMENT_REQUESTER_EMAIL) {
      throw new ForbiddenException("Attendance adjustments are not available for this account");
    }
    const date = new Date(`${forDate}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) throw new BadRequestException("Invalid date");
    if (date.getTime() >= Date.now()) throw new BadRequestException("The date must be in the past");

    const worked = await this.prisma.workSession.findFirst({
      where: { userId: user.id, date: { gte: date, lt: new Date(date.getTime() + DAY_MS) } },
    });
    if (worked) throw new ConflictException("There is already attendance recorded for that day");

    const pending = await this.prisma.attendanceAdjustmentRequest.findFirst({
      where: { userId: user.id, forDate: date, status: AttendanceAdjustmentStatus.PENDING },
    });
    if (pending) return pending;

    if (!(await this.latestRealSession(user.id))) {
      throw new BadRequestException("There is no earlier recorded session to copy from");
    }

    return this.prisma.attendanceAdjustmentRequest.create({
      data: { userId: user.id, forDate: date, reason: reason.trim() },
    });
  }

  mine(user: RequestUser) {
    return this.prisma.attendanceAdjustmentRequest.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }

  async list(admin: RequestUser, status?: string) {
    this.assertApprover(admin);
    const where =
      status && status in AttendanceAdjustmentStatus ? { status: status as AttendanceAdjustmentStatus } : {};
    return this.prisma.attendanceAdjustmentRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: personSelect }, decidedBy: decidedBySelect },
    });
  }

  async decide(admin: RequestUser, id: string, approve: boolean) {
    this.assertApprover(admin);
    const request = await this.prisma.attendanceAdjustmentRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException("Adjustment request not found");
    if (request.userId === admin.id) throw new BadRequestException("You cannot decide your own request");

    const source = approve ? await this.latestRealSession(request.userId) : null;
    if (approve && !source) throw new BadRequestException("There is no earlier recorded session to copy from");

    // Guarded update: two admins clicking at once can't both decide it.
    const claimed = await this.prisma.attendanceAdjustmentRequest.updateMany({
      where: { id, status: AttendanceAdjustmentStatus.PENDING },
      data: {
        status: approve ? AttendanceAdjustmentStatus.APPROVED : AttendanceAdjustmentStatus.DENIED,
        decidedById: admin.id,
        decidedAt: new Date(),
      },
    });
    if (claimed.count === 0) throw new ConflictException("This request was already decided");

    if (source) {
      // Same time of day and length as the source session, moved to the requested date.
      const offsetMs = source.clockInAt.getTime() - source.date.getTime();
      const clockInAt = new Date(request.forDate.getTime() + offsetMs);
      const durationMin = source.durationMin ?? 0;
      await this.prisma.workSession.create({
        data: {
          userId: request.userId,
          date: request.forDate,
          clockInAt,
          clockOutAt: new Date(clockInAt.getTime() + durationMin * 60 * 1000),
          durationMin,
          adjustmentRequestId: request.id,
        },
      });
    }

    return this.prisma.attendanceAdjustmentRequest.findUnique({
      where: { id },
      include: { user: { select: personSelect }, decidedBy: decidedBySelect },
    });
  }
}
