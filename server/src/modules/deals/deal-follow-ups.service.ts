import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { DealStage, NotificationType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { EmailConnectionsService } from "../email-connections/email-connections.service";
import { EmailOAuthService } from "../email-oauth/email-oauth.service";
import { NotificationsService } from "../notifications/notifications.service";
import { sendEmail, sendFailureMessage } from "../../common/utils/mailer";

const dueInclude = {
  owner: { select: { id: true, firstName: true, lastName: true, email: true } },
} as const;

@Injectable()
export class DealFollowUpsService {
  private readonly logger = new Logger(DealFollowUpsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailConnections: EmailConnectionsService,
    private readonly emailOAuth: EmailOAuthService,
    private readonly notifications: NotificationsService,
  ) {}

  // Hourly, not the outreach engines' 5-minute interval -- this is a nag
  // check, not a send queue.
  @Cron(CronExpression.EVERY_HOUR)
  async handleCron() {
    await this.runOnce();
  }

  // Also callable directly (Admin-triggered "run now" endpoint) so a
  // reminder can be verified without waiting up to an hour.
  async runOnce(): Promise<{ processed: number }> {
    const due = await this.prisma.deal.findMany({
      where: {
        followUpAt: { lte: new Date() },
        followUpNotifiedAt: null,
        stage: { notIn: [DealStage.WON, DealStage.LOST, DealStage.ARCHIVED] },
      },
      include: dueInclude,
    });

    for (const deal of due) {
      try {
        await this.notifyOwner(deal);
      } catch (err) {
        this.logger.error(
          `Deal ${deal.id} follow-up notify threw: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return { processed: due.length };
  }

  private async notifyOwner(deal: {
    id: string;
    title: string;
    ownerId: string;
    owner: { id: string; firstName: string; lastName: string; email: string };
  }) {
    await this.notifications.create({
      userId: deal.ownerId,
      type: NotificationType.FOLLOW_UP_DUE,
      title: "Follow-up due",
      message: `"${deal.title}" is due for a follow-up.`,
      link: `/deals/${deal.id}`,
    });

    // Best-effort -- same two-tier send path the outreach engines use. A
    // send failure shouldn't stop the in-app notification from having
    // already landed, so it's caught (and logged) separately rather than
    // rolling back the notification above.
    try {
      const sendable = await this.emailConnections.requireSendable(deal.ownerId);
      const subject = `Follow-up due: ${deal.title}`;
      const html = `<p>Hi ${deal.owner.firstName},</p><p>Your follow-up reminder for <strong>${deal.title}</strong> is due.</p>`;
      if (sendable.mode === "smtp") {
        await sendable.transporter.sendMail({
          from: sendable.from,
          to: deal.owner.email,
          subject,
          html,
        });
      } else if (sendable.mode === "oauth") {
        await this.emailOAuth.sendMail(sendable.provider, sendable.accessToken, {
          to: deal.owner.email,
          subject,
          html,
          from: sendable.from,
        });
      } else {
        const result = await sendEmail({
          to: deal.owner.email,
          subject,
          html,
          replyTo: sendable.replyTo,
        });
        if (!result.delivered) {
          throw new Error(sendFailureMessage(result));
        }
      }
    } catch (err) {
      this.logger.error(
        `Deal ${deal.id} follow-up email to ${deal.owner.email} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    await this.prisma.deal.update({
      where: { id: deal.id },
      data: { followUpNotifiedAt: new Date() },
    });
  }
}
