import { Controller, Get, Param, Query, Res, Logger } from "@nestjs/common";
import { Response } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import { Public } from "../../common/decorators/public.decorator";
import { EngagementEventsService } from "../engagement/engagement-events.service";

// 1x1 transparent GIF buffer
const TRACKING_PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

@Controller("tracking")
export class TrackingController {
  private readonly logger = new Logger(TrackingController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engagementEvents: EngagementEventsService,
  ) {}

  @Public()
  @Get("open/bulk/:recipientId")
  async trackBulkOpen(
    @Param("recipientId") recipientId: string,
    @Res() res: Response
  ) {
    try {
      const recipient = await this.prisma.bulkEmailRecipient.findUnique({
        where: { id: recipientId },
        select: { contactId: true, campaign: { select: { id: true, name: true, creatorId: true } } }
      });

      if (recipient) {
        // Conditional update (WHERE openedAt IS NULL) rather than a
        // read-then-write -- under concurrent pixel fetches (mail-client
        // prescanning + the recipient actually opening it), Postgres
        // serializes these on the row lock and only one update's WHERE
        // clause still matches after the lock is released, so `count` here
        // is a race-safe "was this truly the first open" signal.
        const firstOpen = await this.prisma.bulkEmailRecipient.updateMany({
          where: { id: recipientId, openedAt: null },
          data: { openedAt: new Date() },
        });
        await this.prisma.bulkEmailRecipient.update({
          where: { id: recipientId },
          data: { openCount: { increment: 1 } },
        });

        // Record + notify the campaign's sender (not a nonexistent contact
        // "owner" -- Contacts are a shared team resource with no
        // owner/assignee concept in this schema) on the recipient's first
        // open only.
        if (firstOpen.count > 0 && recipient.contactId) {
          const contact = await this.prisma.contact.findUnique({
            where: { id: recipient.contactId },
            select: { firstName: true, lastName: true }
          });
          if (contact) {
            const name = `${contact.firstName} ${contact.lastName}`;
            await this.engagementEvents.record({
              type: "EMAIL_OPENED",
              contactId: recipient.contactId,
              campaignId: recipient.campaign.id,
              recipientId,
              ownerId: recipient.campaign.creatorId,
              notify: {
                title: "Email Opened",
                message: `${name} opened your email from campaign "${recipient.campaign.name}"`,
                link: "/crm",
              },
            });
          }
        }
      }
    } catch (err) {
      this.logger.error(`Failed to track bulk open for ${recipientId}: ${err instanceof Error ? err.message : String(err)}`);
    }

    this.sendPixel(res);
  }

  @Public()
  @Get("open/sequence/:sendId")
  async trackSequenceOpen(
    @Param("sendId") sendId: string,
    @Res() res: Response
  ) {
    try {
      const send = await this.prisma.sequenceSend.findUnique({
        where: { id: sendId },
        select: {
          enrollment: {
            select: {
              contactId: true,
              enrolledById: true,
              sequenceId: true,
              sequence: { select: { name: true, departmentId: true } },
            },
          },
        },
      });

      if (send) {
        // Same race-safe conditional-update pattern as trackBulkOpen above.
        const firstOpen = await this.prisma.sequenceSend.updateMany({
          where: { id: sendId, openedAt: null },
          data: { openedAt: new Date() },
        });
        await this.prisma.sequenceSend.update({
          where: { id: sendId },
          data: { openCount: { increment: 1 } },
        });

        if (firstOpen.count > 0) {
          const contact = await this.prisma.contact.findUnique({
            where: { id: send.enrollment.contactId },
            select: { firstName: true, lastName: true }
          });
          if (contact) {
            const name = `${contact.firstName} ${contact.lastName}`;
            await this.engagementEvents.record({
              type: "EMAIL_OPENED",
              contactId: send.enrollment.contactId,
              sequenceId: send.enrollment.sequenceId,
              recipientId: sendId,
              ownerId: send.enrollment.enrolledById,
              departmentId: send.enrollment.sequence.departmentId,
              notify: {
                title: "Sequence Email Opened",
                message: `${name} opened step in sequence "${send.enrollment.sequence.name}"`,
                link: "/crm",
              },
            });
          }
        }
      }
    } catch (err) {
      this.logger.error(`Failed to track sequence open for ${sendId}: ${err instanceof Error ? err.message : String(err)}`);
    }

    this.sendPixel(res);
  }

  // Click-tracking redirects. `url` is the real destination, embedded by
  // rewrite-links.ts at send time. Always redirects somewhere even on error
  // (falls back to the app root) -- this link is live in a recipient's
  // inbox, so it must never dead-end them on a broken tracking pixel bug.
  @Public()
  @Get("click/bulk/:recipientId")
  async trackBulkClick(
    @Param("recipientId") recipientId: string,
    @Query("url") url: string | undefined,
    @Res() res: Response
  ) {
    try {
      const recipient = await this.prisma.bulkEmailRecipient.findUnique({
        where: { id: recipientId },
        select: { contactId: true, campaign: { select: { id: true, creatorId: true } } }
      });
      if (recipient) {
        await this.prisma.bulkEmailRecipient.updateMany({
          where: { id: recipientId, clickedAt: null },
          data: { clickedAt: new Date() },
        });
        await this.prisma.bulkEmailRecipient.update({
          where: { id: recipientId },
          data: { clickCount: { increment: 1 } },
        });
        await this.engagementEvents.record({
          type: "EMAIL_CLICKED",
          contactId: recipient.contactId,
          campaignId: recipient.campaign.id,
          recipientId,
          ownerId: recipient.campaign.creatorId,
          metadata: { url: url ?? null },
        });
      }
    } catch (err) {
      this.logger.error(`Failed to track bulk click for ${recipientId}: ${err instanceof Error ? err.message : String(err)}`);
    }
    this.redirectToDestination(res, url);
  }

  @Public()
  @Get("click/sequence/:sendId")
  async trackSequenceClick(
    @Param("sendId") sendId: string,
    @Query("url") url: string | undefined,
    @Res() res: Response
  ) {
    try {
      const send = await this.prisma.sequenceSend.findUnique({
        where: { id: sendId },
        select: {
          enrollment: { select: { contactId: true, enrolledById: true, sequenceId: true } },
        },
      });
      if (send) {
        await this.prisma.sequenceSend.updateMany({
          where: { id: sendId, clickedAt: null },
          data: { clickedAt: new Date() },
        });
        await this.prisma.sequenceSend.update({
          where: { id: sendId },
          data: { clickCount: { increment: 1 } },
        });
        await this.engagementEvents.record({
          type: "EMAIL_CLICKED",
          contactId: send.enrollment.contactId,
          sequenceId: send.enrollment.sequenceId,
          recipientId: sendId,
          ownerId: send.enrollment.enrolledById,
          metadata: { url: url ?? null },
        });
      }
    } catch (err) {
      this.logger.error(`Failed to track sequence click for ${sendId}: ${err instanceof Error ? err.message : String(err)}`);
    }
    this.redirectToDestination(res, url);
  }

  private redirectToDestination(res: Response, url: string | undefined) {
    if (url && /^https?:\/\//i.test(url)) {
      res.redirect(302, url);
      return;
    }
    res.redirect(302, "/");
  }

  private sendPixel(res: Response) {
    res.setHeader("Content-Type", "image/gif");
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, max-age=0"
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.status(200).send(TRACKING_PIXEL);
  }
}
