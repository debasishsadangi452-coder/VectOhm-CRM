import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkSessionsService } from "../work-sessions/work-sessions.service";
import { ScreenshotStorageService } from "./screenshot-storage.service";
import { canViewMonitoringData, isHrDepartment } from "../../common/utils/monitoring-access";
import type { RequestUser } from "../../common/types/request-user.type";

// Same 30-day window + opportunistic-sweep-on-write pattern as
// LoginEvent/auth.service.ts's recordAuthEvent.
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const captureUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  department: { select: { id: true, name: true } },
} as const;

@Injectable()
export class ScreenMonitoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workSessions: WorkSessionsService,
    private readonly storage: ScreenshotStorageService,
  ) {}

  // Called by the desktop agent, authenticated as the employee whose screen
  // this is. Only allowed while clocked in -- monitoring is explicitly scoped
  // to work hours, not the employee's personal time on the same laptop.
  async create(user: RequestUser, buffer: Buffer) {
    const activeSession = await this.workSessions.getActive(user.id);
    if (!activeSession) {
      throw new ConflictException("You must be clocked in to capture a screenshot");
    }

    const storagePath = await this.storage.save(buffer);
    const capture = await this.prisma.screenCapture.create({
      data: { userId: user.id, workSessionId: activeSession.id, storagePath },
    });

    // Opportunistic retention: same 5%-of-writes trigger as LoginEvent's
    // sweep -- costs almost nothing, bounded by the capturedAt index. Unlike
    // that sweep, this one also has to remove the backing file per row
    // before dropping the DB row.
    if (Math.random() < 0.05) {
      await this.sweepExpired();
    }

    return { id: capture.id, capturedAt: capture.capturedAt };
  }

  async list(viewer: RequestUser, filters: { userId?: string; from?: string; to?: string }) {
    const capturedAt = this.dateFilter(filters);

    if (filters.userId) {
      const target = await this.getTargetOrThrow(filters.userId);
      if (!canViewMonitoringData(viewer, target)) {
        throw new ForbiddenException("You do not have permission to view this user's screen captures");
      }
      return this.prisma.screenCapture.findMany({
        where: { userId: filters.userId, ...(capturedAt ? { capturedAt } : {}) },
        orderBy: { capturedAt: "desc" },
        take: 200,
        select: { id: true, capturedAt: true, user: { select: captureUserSelect } },
      });
    }

    // No specific user requested -- return everything this viewer is broadly
    // allowed to see. Admin/HR see the whole company; a Manager sees only
    // their own department. Anyone else (a plain Employee hitting this
    // endpoint directly) gets nothing -- the nav never surfaces this page to
    // them, but the backend enforces it independently too.
    const isAdmin = viewer.role.name === RoleName.ADMIN;
    const isHR = isHrDepartment(viewer.department?.name);
    const isManager = viewer.role.name === RoleName.MANAGER;
    if (!isAdmin && !isHR && !isManager) {
      throw new ForbiddenException("You do not have permission to view screen captures");
    }

    const scope = isAdmin || isHR ? {} : { user: { departmentId: viewer.department?.id } };
    return this.prisma.screenCapture.findMany({
      where: { ...scope, ...(capturedAt ? { capturedAt } : {}) },
      orderBy: { capturedAt: "desc" },
      take: 200,
      select: { id: true, capturedAt: true, user: { select: captureUserSelect } },
    });
  }

  async getImage(id: string, viewer: RequestUser) {
    const capture = await this.prisma.screenCapture.findUnique({
      where: { id },
      select: { storagePath: true, user: { select: { department: { select: { id: true } } } } },
    });
    if (!capture) {
      throw new NotFoundException("Screen capture not found");
    }
    // Re-check per-image, not just at the list level -- someone could have
    // an id without having gone through list().
    if (!canViewMonitoringData(viewer, capture.user)) {
      throw new ForbiddenException("You do not have permission to view this screen capture");
    }
    return this.storage.read(capture.storagePath);
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
    const expired = await this.prisma.screenCapture.findMany({
      where: { capturedAt: { lt: new Date(Date.now() - RETENTION_MS) } },
      select: { id: true, storagePath: true },
      take: 500,
    });
    if (expired.length === 0) return;
    await Promise.all(expired.map((c) => this.storage.delete(c.storagePath)));
    await this.prisma.screenCapture.deleteMany({ where: { id: { in: expired.map((c) => c.id) } } });
  }
}
