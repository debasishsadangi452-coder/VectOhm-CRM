import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuthEventType, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { LoginPhotoStorageService } from "./login-photo-storage.service";
import { canViewMonitoringData, isHrDepartment } from "../../common/utils/monitoring-access";
import type { RequestUser } from "../../common/types/request-user.type";

// Same 30-day retention window + opportunistic-sweep-on-write pattern as
// ScreenCapture/LoginEvent.
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
// How recent a LOGIN audit event has to be to get cross-referenced by a
// photo upload -- the frontend fires the capture immediately after login
// succeeds, so this only needs to cover normal request latency, not clock
// skew across sessions.
const LOGIN_EVENT_LINK_WINDOW_MS = 2 * 60 * 1000;

const photoUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  department: { select: { id: true, name: true } },
} as const;

@Injectable()
export class LoginPhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LoginPhotoStorageService,
  ) {}

  // No clocked-in gate (unlike ScreenCapture) -- this fires once, right at
  // login or clock-in/out.
  async create(user: RequestUser, buffer: Buffer, type?: string) {
    const eventType = type === "CLOCK_OUT" || type === "LOGOUT" ? AuthEventType.LOGOUT : AuthEventType.LOGIN;
    const recentLogin = await this.prisma.loginEvent.findFirst({
      where: {
        userId: user.id,
        type: eventType,
        createdAt: { gte: new Date(Date.now() - LOGIN_EVENT_LINK_WINDOW_MS) },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    const storagePath = await this.storage.save(buffer);
    const photo = await this.prisma.loginPhoto.create({
      data: {
        userId: user.id,
        loginEventId: recentLogin?.id ?? null,
        type: type ?? "CLOCK_IN",
        storagePath,
      },
    });

    if (Math.random() < 0.05) {
      await this.sweepExpired();
    }

    return { id: photo.id, type: photo.type, capturedAt: photo.capturedAt };
  }

  async list(
    viewer: RequestUser,
    filters: { userId?: string; type?: string; from?: string; to?: string },
  ) {
    const capturedAt = this.dateFilter(filters);
    const typeFilter = filters.type ? { type: filters.type } : {};

    if (filters.userId) {
      const target = await this.getTargetOrThrow(filters.userId);
      if (!canViewMonitoringData(viewer, target)) {
        throw new ForbiddenException("You do not have permission to view this user's login photos");
      }
      return this.prisma.loginPhoto.findMany({
        where: {
          userId: filters.userId,
          ...typeFilter,
          ...(capturedAt ? { capturedAt } : {}),
        },
        orderBy: { capturedAt: "desc" },
        take: 200,
        select: { id: true, type: true, capturedAt: true, user: { select: photoUserSelect } },
      });
    }

    const isAdmin = viewer.role.name === RoleName.ADMIN;
    const isHR = isHrDepartment(viewer.department?.name);
    const isManager = viewer.role.name === RoleName.MANAGER;
    if (!isAdmin && !isHR && !isManager) {
      throw new ForbiddenException("You do not have permission to view login photos");
    }

    const scope = isAdmin || isHR ? {} : { user: { departmentId: viewer.department?.id } };
    return this.prisma.loginPhoto.findMany({
      where: {
        ...scope,
        ...typeFilter,
        ...(capturedAt ? { capturedAt } : {}),
      },
      orderBy: { capturedAt: "desc" },
      take: 200,
      select: { id: true, type: true, capturedAt: true, user: { select: photoUserSelect } },
    });
  }

  // Deliberately stricter than viewing: a department Manager can see their
  // team's login photos (see canViewMonitoringData) but not delete them --
  // clearing out audit images is an HR/Admin-only action, not something
  // every Manager who can view this page should be able to do.
  async remove(id: string, viewer: RequestUser): Promise<void> {
    const photo = await this.prisma.loginPhoto.findUnique({
      where: { id },
      select: { storagePath: true },
    });
    if (!photo) {
      throw new NotFoundException("Login photo not found");
    }
    const isAdmin = viewer.role.name === RoleName.ADMIN;
    const isHR = isHrDepartment(viewer.department?.name);
    if (!isAdmin && !isHR) {
      throw new ForbiddenException("Only Admin or HR can delete login photos");
    }
    await this.storage.delete(photo.storagePath);
    await this.prisma.loginPhoto.delete({ where: { id } });
  }

  async getImage(id: string, viewer: RequestUser) {
    const photo = await this.prisma.loginPhoto.findUnique({
      where: { id },
      select: { storagePath: true, user: { select: { department: { select: { id: true } } } } },
    });
    if (!photo) {
      throw new NotFoundException("Login photo not found");
    }
    if (!canViewMonitoringData(viewer, photo.user)) {
      throw new ForbiddenException("You do not have permission to view this login photo");
    }
    return this.storage.read(photo.storagePath);
  }

  private dateFilter(filters: { from?: string; to?: string }) {
    if (!filters.from && !filters.to) return undefined;
    return {
      ...(filters.from ? { gte: new Date(filters.from) } : {}),
      ...(filters.to ? { lte: new Date(filters.to) } : {}),
    };
  }

  private async getTargetOrThrow(userId: string) {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { department: { select: { id: true } } },
    });
    if (!target) {
      throw new NotFoundException("User not found");
    }
    return target;
  }

  private async sweepExpired() {
    const expired = await this.prisma.loginPhoto.findMany({
      where: { capturedAt: { lt: new Date(Date.now() - RETENTION_MS) } },
      select: { id: true, storagePath: true },
      take: 500,
    });
    if (expired.length === 0) return;
    await Promise.all(expired.map((p) => this.storage.delete(p.storagePath)));
    await this.prisma.loginPhoto.deleteMany({ where: { id: { in: expired.map((p) => p.id) } } });
  }
}
