import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { SuppressionReason } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { verifyUnsubscribeToken } from "../../common/utils/unsubscribe-token";
import { canUseSalesOutreach } from "../../common/utils/sales-access";
import type { RequestUser } from "../../common/types/request-user.type";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class EmailSuppressionService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: RequestUser) {
    this.assertCanView(user);
    return this.prisma.emailSuppression.findMany({ orderBy: { createdAt: "desc" } });
  }

  add(email: string, user: RequestUser) {
    this.assertCanView(user);
    return this.prisma.emailSuppression.upsert({
      where: { email: normalizeEmail(email) },
      create: { email: normalizeEmail(email), reason: SuppressionReason.MANUAL },
      update: {},
    });
  }

  // Admin-only: removing a real unsubscribe (not just a manual/bounced entry
  // added by mistake) without the recipient's consent would defeat the point
  // of an unsubscribe list, so this is deliberately not open to all of Sales.
  async remove(id: string): Promise<void> {
    await this.prisma.emailSuppression.delete({ where: { id } });
  }

  // Called by the Sequence send engine (once built) before every send.
  async isSuppressed(email: string): Promise<boolean> {
    const row = await this.prisma.emailSuppression.findUnique({
      where: { email: normalizeEmail(email) },
      select: { id: true },
    });
    return !!row;
  }

  // Public endpoint (no auth) -- verifies the HMAC token before recording the
  // unsubscribe, so this can't be used to suppress an arbitrary address.
  async unsubscribeViaToken(email: string, token: string): Promise<void> {
    if (!email || !token || !verifyUnsubscribeToken(email, token)) {
      throw new BadRequestException("This unsubscribe link is invalid or has expired.");
    }
    await this.prisma.emailSuppression.upsert({
      where: { email: normalizeEmail(email) },
      create: { email: normalizeEmail(email), reason: SuppressionReason.UNSUBSCRIBED },
      update: { reason: SuppressionReason.UNSUBSCRIBED },
    });
  }

  private assertCanView(user: RequestUser) {
    if (!canUseSalesOutreach(user)) {
      throw new ForbiddenException("Access denied");
    }
  }
}
