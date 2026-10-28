import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuthEventType, RoleName, SignOutRequestStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../common/types/request-user.type";

// How long an approval stays actionable for the requester's client -- stops an
// old approval from signing someone out again long after they logged back in.
const APPROVAL_WINDOW_MS = 10 * 60 * 1000;
const MAX_REASON_LENGTH = 300;

const requesterSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  department: { select: { id: true, name: true } },
} as const;

@Injectable()
export class SignOutRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  private assertAdmin(user: RequestUser) {
    if (user.role.name !== RoleName.ADMIN) {
      throw new ForbiddenException("Only an admin can review sign-out requests");
    }
  }

  // One open request per person -- asking again just returns it.
  async create(user: RequestUser, reason?: string) {
    const existing = await this.prisma.signOutRequest.findFirst({
      where: { userId: user.id, status: SignOutRequestStatus.PENDING },
    });
    if (existing) return existing;
    return this.prisma.signOutRequest.create({
      data: { userId: user.id, reason: reason?.trim().slice(0, MAX_REASON_LENGTH) || null },
    });
  }

  // The requester's latest request that still needs their client to act on it:
  // pending, or decided (and not yet acknowledged) recently.
  async mine(user: RequestUser) {
    const latest = await this.prisma.signOutRequest.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    if (!latest) return null;
    if (latest.status === SignOutRequestStatus.PENDING) return latest;
    if (latest.ackedAt) return null;
    const decidedAt = latest.decidedAt?.getTime() ?? 0;
    return Date.now() - decidedAt <= APPROVAL_WINDOW_MS ? latest : null;
  }

  async acknowledge(user: RequestUser, id: string) {
    const result = await this.prisma.signOutRequest.updateMany({
      where: { id, userId: user.id, ackedAt: null, status: { not: SignOutRequestStatus.PENDING } },
      data: { ackedAt: new Date() },
    });
    return { acknowledged: result.count > 0 };
  }

  async list(admin: RequestUser, status?: string) {
    this.assertAdmin(admin);
    const where =
      status && status in SignOutRequestStatus ? { status: status as SignOutRequestStatus } : {};
    return this.prisma.signOutRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        user: { select: requesterSelect },
        decidedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async decide(admin: RequestUser, id: string, approve: boolean) {
    this.assertAdmin(admin);
    const request = await this.prisma.signOutRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException("Sign-out request not found");
    if (request.userId === admin.id) {
      throw new BadRequestException("You cannot decide your own request");
    }

    // Guarded update: two admins clicking at once can't both decide it.
    const claimed = await this.prisma.signOutRequest.updateMany({
      where: { id, status: SignOutRequestStatus.PENDING },
      data: {
        status: approve ? SignOutRequestStatus.APPROVED : SignOutRequestStatus.DENIED,
        decidedById: admin.id,
        decidedAt: new Date(),
      },
    });
    if (claimed.count === 0) throw new ConflictException("This request was already decided");

    if (approve) {
      // Sign the person out everywhere: with their refresh tokens gone the web
      // app (which also notices the approval and leaves at once) and the
      // desktop agent can no longer renew their session.
      await this.prisma.refreshToken.deleteMany({ where: { userId: request.userId } });
      await this.prisma.loginEvent.create({
        data: { userId: request.userId, type: AuthEventType.LOGOUT },
      });
    }

    return this.prisma.signOutRequest.findUnique({
      where: { id },
      include: {
        user: { select: requesterSelect },
        decidedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }
}
