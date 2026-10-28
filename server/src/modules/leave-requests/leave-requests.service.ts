import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { LeaveStatus, NotificationType, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateLeaveRequestDto } from "./dto/create-leave-request.dto";
import { UpdateLeaveRequestDto } from "./dto/update-leave-request.dto";
import type { RequestUser } from "../../common/types/request-user.type";
import { NotificationsService } from "../notifications/notifications.service";

import { isHrUser } from "../../common/utils/directory-access";

const leaveInclude = {
  user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, departmentId: true } },
  reviewedBy: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
} as const;

@Injectable()
export class LeaveRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // Admins and HR members see all; department managers see their department; regular employees only see their own.
  findAll(user: RequestUser, filters: { userId?: string; status?: LeaveStatus }) {
    const isFullAccess = user.role.name === RoleName.ADMIN || isHrUser(user);
    const isDeptManager = user.role.name === RoleName.MANAGER && !!user.department?.id;

    const where: Record<string, unknown> = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (isFullAccess) {
      // HR/Admin can optionally filter by employee
      if (filters.userId) {
        where.userId = filters.userId;
      }
    } else if (isDeptManager) {
      if (filters.userId) {
        where.userId = filters.userId;
        where.user = { departmentId: user.department?.id };
      } else {
        where.user = { departmentId: user.department?.id };
      }
    } else {
      // Regular employees only see their own
      where.userId = user.id;
    }

    return this.prisma.leaveRequest.findMany({
      where,
      include: leaveInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string, user: RequestUser) {
    const leave = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: leaveInclude,
    });
    if (!leave) throw new NotFoundException("Leave request not found");

    const isFullAccess = user.role.name === RoleName.ADMIN || isHrUser(user);
    const isDeptManager =
      user.role.name === RoleName.MANAGER &&
      !!user.department?.id &&
      leave.user?.departmentId === user.department?.id;

    if (!isFullAccess && !isDeptManager && leave.userId !== user.id) {
      throw new ForbiddenException("Access denied");
    }
    return leave;
  }

  async create(dto: CreateLeaveRequestDto, user: RequestUser) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    if (end < start) {
      throw new BadRequestException("End date must be after start date");
    }

    const leave = await this.prisma.leaveRequest.create({
      data: {
        userId: user.id,
        type: dto.type,
        startDate: start,
        endDate: end,
        reason: dto.reason,
      },
      include: leaveInclude,
    });

    // Notify HR, Admins and reporting manager of the new leave request
    try {
      const userRecord = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { managerId: true },
      });

      const reviewers = await this.prisma.user.findMany({
        where: {
          isActive: true,
          id: { not: user.id },
          OR: [
            { role: { name: RoleName.ADMIN } },
            { department: { name: { in: ["HR", "Human Resources"] } } },
            ...(userRecord?.managerId ? [{ id: userRecord.managerId }] : []),
          ],
        },
        select: { id: true },
      });

      const startStr = start.toISOString().split("T")[0];
      const endStr = end.toISOString().split("T")[0];
      for (const reviewer of reviewers) {
        await this.notifications.create({
          userId: reviewer.id,
          type: NotificationType.GENERAL,
          title: `New Leave Request · ${user.firstName} ${user.lastName}`,
          message: `${user.firstName} ${user.lastName} submitted a ${dto.type.toLowerCase().replace(/_/g, " ")} request (${startStr} → ${endStr}).`,
          link: "/hr?tab=leave-requests",
        });
      }
    } catch {
      // Non-blocking
    }

    return leave;
  }

  // HR/Admin only: approve or reject; employees can cancel their own pending requests.
  async update(id: string, dto: UpdateLeaveRequestDto, user: RequestUser) {
    const leave = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!leave) throw new NotFoundException("Leave request not found");

    const canReview =
      user.role.name === RoleName.ADMIN || isHrUser(user);

    // Employees can only cancel their own pending requests
    if (!canReview) {
      if (leave.userId !== user.id) throw new ForbiddenException("Access denied");
      if (dto.status && dto.status !== LeaveStatus.CANCELLED) {
        throw new ForbiddenException("Employees can only cancel their own requests");
      }
      if (dto.reviewNote !== undefined) {
        throw new ForbiddenException("Only HR or an admin can add a review note");
      }
      if (leave.status !== LeaveStatus.PENDING) {
        throw new BadRequestException("Only pending requests can be cancelled");
      }
    } else if (
      leave.userId === user.id &&
      user.role.name !== RoleName.ADMIN &&
      (dto.status === LeaveStatus.APPROVED || dto.status === LeaveStatus.REJECTED)
    ) {
      throw new ForbiddenException("You cannot review your own leave request");
    }

    const isReviewAction =
      dto.status === LeaveStatus.APPROVED || dto.status === LeaveStatus.REJECTED;

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: dto.status,
        reviewNote: dto.reviewNote,
        ...(isReviewAction
          ? { reviewedById: user.id, reviewedAt: new Date() }
          : {}),
      },
      include: leaveInclude,
    });

    // Fire notification to the leave owner on approve/reject
    if (dto.status === LeaveStatus.APPROVED) {
      await this.notifications.create({
        userId: leave.userId,
        type: "LEAVE_APPROVED",
        title: "Leave Approved ✓",
        message: dto.reviewNote
          ? `Your leave request was approved. Note: ${dto.reviewNote}`
          : "Your leave request has been approved.",
        link: "/hr?tab=leave-requests",
      });
    } else if (dto.status === LeaveStatus.REJECTED) {
      await this.notifications.create({
        userId: leave.userId,
        type: "LEAVE_REJECTED",
        title: "Leave Request Rejected",
        message: dto.reviewNote
          ? `Your leave request was rejected. Reason: ${dto.reviewNote}`
          : "Your leave request has been rejected.",
        link: "/hr?tab=leave-requests",
      });
    }

    return updated;
  }

  async remove(id: string, user: RequestUser) {
    const leave = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!leave) throw new NotFoundException("Leave request not found");

    const canSeeAll =
      user.role.name === RoleName.ADMIN || isHrUser(user);

    if (!canSeeAll && leave.userId !== user.id) {
      throw new ForbiddenException("Access denied");
    }
    // An approved leave excuses absences in attendance, so only HR/Admin may
    // remove it; the owner must cancel while it's still pending.
    if (!canSeeAll && leave.status === LeaveStatus.APPROVED) {
      throw new ForbiddenException("An approved leave can only be removed by HR or an admin");
    }

    return this.prisma.leaveRequest.delete({ where: { id } });
  }

  // HR/Admin only: stats overview for the admin panel
  async getStats(user: RequestUser) {
    const canSeeAll =
      user.role.name === RoleName.ADMIN || isHrUser(user);
    if (!canSeeAll) {
      throw new ForbiddenException("Access denied");
    }

    const [total, pending, approved, rejected, byType] = await Promise.all([
      this.prisma.leaveRequest.count(),
      this.prisma.leaveRequest.count({ where: { status: "PENDING" } }),
      this.prisma.leaveRequest.count({ where: { status: "APPROVED" } }),
      this.prisma.leaveRequest.count({ where: { status: "REJECTED" } }),
      this.prisma.leaveRequest.groupBy({
        by: ["type"],
        _count: { id: true },
      }),
    ]);

    return {
      total,
      pending,
      approved,
      rejected,
      byType: byType.map((b) => ({ type: b.type, count: b._count.id })),
    };
  }
}
