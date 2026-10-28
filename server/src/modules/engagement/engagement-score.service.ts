import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

// Classification bands from the Engagement Intelligence spec. Tier is
// derived from score on every update rather than stored independently, so
// the two can never drift out of sync.
const TIER_BANDS: Array<{ min: number; tier: string }> = [
  { min: 150, tier: "SALES_READY" },
  { min: 70, tier: "HOT" },
  { min: 30, tier: "WARM" },
  { min: 0, tier: "COLD" },
];

export function tierForScore(score: number): string {
  return TIER_BANDS.find((band) => score >= band.min)?.tier ?? "COLD";
}

@Injectable()
export class EngagementScoreService {
  constructor(private readonly prisma: PrismaService) {}

  // Atomic increment (never a read-modify-write) so concurrent events for
  // the same contact can't clobber each other, same reasoning as
  // BulkEmailRecipient.openCount's conditional-update pattern. A zero delta
  // (event types not in the scoring table, e.g. TASK_COMPLETED) is a no-op
  // -- those still get an EngagementEvent row for the timeline, just no
  // score effect.
  async applyDelta(contactId: string, delta: number): Promise<void> {
    if (!delta) {
      return;
    }
    const updated = await this.prisma.contact.update({
      where: { id: contactId },
      data: { engagementScore: { increment: delta } },
      select: { engagementScore: true },
    });
    const score = Math.max(0, updated.engagementScore);
    await this.prisma.contact.update({
      where: { id: contactId },
      data: { engagementScore: score, engagementTier: tierForScore(score) },
    });
  }
}
