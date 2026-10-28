import { Injectable } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { isHrDepartment } from "../../common/utils/monitoring-access";
import { NotificationsService } from "../notifications/notifications.service";

export interface OversightSubject {
  id: string;
  departmentId: string | null;
  managerId: string | null;
}

/**
 * Who should hear about an employee's attendance problems: their direct
 * manager, the managers of their department, and HR. (Admin-wide alerts are
 * handled separately, where wanted, by the callers.)
 */
@Injectable()
export class AttendanceOversightService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Active HR users. Matched by department name in code so e.g. "Shrewsbury Sales" isn't swept in. */
  async getHrUserIds(): Promise<string[]> {
    const candidates = await this.prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { department: { name: { contains: "hr", mode: "insensitive" } } },
          { department: { name: { contains: "human resource", mode: "insensitive" } } },
        ],
      },
      select: { id: true, department: { select: { name: true } } },
    });
    return candidates.filter((c) => isHrDepartment(c.department?.name)).map((c) => c.id);
  }

  /** Direct manager + department managers + HR, never the subject themselves. Pass `hrIds` to reuse one lookup across many people. */
  async recipientsFor(subject: OversightSubject, hrIds?: string[]): Promise<string[]> {
    const ids = new Set<string>(hrIds ?? (await this.getHrUserIds()));
    if (subject.managerId) ids.add(subject.managerId);
    if (subject.departmentId) {
      const managers = await this.prisma.user.findMany({
        where: { isActive: true, departmentId: subject.departmentId, role: { name: RoleName.MANAGER } },
        select: { id: true },
      });
      for (const m of managers) ids.add(m.id);
    }
    ids.delete(subject.id);
    return Array.from(ids);
  }

  /** Sends one notification to each user; one failure never stops the rest. Returns how many were delivered. */
  async notify(userIds: string[], input: Omit<Parameters<NotificationsService["create"]>[0], "userId">): Promise<number> {
    let delivered = 0;
    for (const userId of userIds) {
      try {
        await this.notifications.create({ ...input, userId });
        delivered++;
      } catch {
        // best-effort
      }
    }
    return delivered;
  }
}
