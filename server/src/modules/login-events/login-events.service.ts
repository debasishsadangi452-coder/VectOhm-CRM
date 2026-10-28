import { Injectable } from "@nestjs/common";
import { AuthEventType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

const eventUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  avatarUrl: true,
  department: { select: { id: true, name: true } },
} as const;

@Injectable()
export class LoginEventsService {
  constructor(private readonly prisma: PrismaService) {}

  // Chronological log (newest first). Optionally scoped to a single user. Capped
  // so a caller can't request an unbounded dump.
  list(params: { userId?: string; limit?: number }) {
    const take = Math.min(Math.max(params.limit ?? 100, 1), 500);
    return this.prisma.loginEvent.findMany({
      where: params.userId ? { userId: params.userId } : undefined,
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        type: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        user: { select: eventUserSelect },
      },
    });
  }

  // Most recent LOGIN timestamp per user, for the "Last login" column. One row
  // per user who has ever logged in.
  async lastLogins() {
    const rows = await this.prisma.loginEvent.groupBy({
      by: ["userId"],
      where: { type: AuthEventType.LOGIN },
      _max: { createdAt: true },
    });
    return rows.map((r) => ({ userId: r.userId, lastLoginAt: r._max.createdAt }));
  }
}
