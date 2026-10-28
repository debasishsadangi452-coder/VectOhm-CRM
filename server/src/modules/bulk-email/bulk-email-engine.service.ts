import { Injectable, Logger, Optional } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { BulkSendStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { EmailSuppressionService } from "../email-suppression/email-suppression.service";
import { EmailConnectionsService } from "../email-connections/email-connections.service";
import { EmailOAuthService } from "../email-oauth/email-oauth.service";
import { EmailSyncEngineService } from "../email-oauth/email-sync-engine.service";
import { inferCompanyFromEmail, renderMergeFields } from "../../common/utils/merge-fields";
import { composeEmailHtml, isPlainOrSimpleHtml, simpleHtmlToPlainText } from "../../common/utils/email-body";
import { buildUnsubscribeUrl } from "../../common/utils/unsubscribe-token";
import { appendTrackingFooter } from "../../common/utils/email-tracking";
import { rewriteLinksForTracking } from "../../common/utils/rewrite-links";
import { sendEmail, sendFailureMessage } from "../../common/utils/mailer";
import { EngagementEventsService } from "../engagement/engagement-events.service";
import { EmailAiService } from "../email-ai/email-ai.service";

// Throttled the same way as the Sequence engine (sequences/sequence-engine.service.ts):
// a periodic tick processes a capped batch of PENDING recipients rather than
// firing an entire campaign at once, so a large blast doesn't trip a
// provider's rate limits or read as a spam burst.
const BATCH_SIZE = 50;


const pendingInclude = {
  campaign: {
    include: {
      template: true,
      // Needed to append the sender's own signature -- see composeEmailHtml.
      creator: { select: { emailSignatureHtml: true } },
    },
  },
  contact: {
    select: {
      firstName: true,
      lastName: true,
      title: true,
      company: { select: { name: true } },
    },
  },
} satisfies Prisma.BulkEmailRecipientInclude;

type PendingRecipient = Prisma.BulkEmailRecipientGetPayload<{ include: typeof pendingInclude }>;

@Injectable()
export class BulkEmailEngineService {
  private readonly logger = new Logger(BulkEmailEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly suppression: EmailSuppressionService,
    private readonly emailConnections: EmailConnectionsService,
    private readonly emailOAuth: EmailOAuthService,
    private readonly config: ConfigService,
    private readonly engagementEvents: EngagementEventsService,
    @Optional() private readonly emailSyncEngine?: EmailSyncEngineService,
    @Optional() private readonly emailAi?: EmailAiService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron() {
    await this.runOnce();
  }

  // Also callable directly (Admin-triggered "run now" endpoint) so nobody
  // has to wait up to 5 minutes to see a campaign actually go out.
  async runOnce(): Promise<{ processed: number }> {
    const pending = await this.prisma.bulkEmailRecipient.findMany({
      where: { status: BulkSendStatus.PENDING },
      include: pendingInclude,
      orderBy: { createdAt: "asc" },
      take: BATCH_SIZE,
    });

    for (const recipient of pending) {
      try {
        await this.processRecipient(recipient);
      } catch (err) {
        this.logger.error(
          `Recipient ${recipient.id} threw during processing: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return { processed: pending.length };
  }

  private async processRecipient(recipient: PendingRecipient) {
    if (await this.suppression.isSuppressed(recipient.email)) {
      await this.prisma.bulkEmailRecipient.update({
        where: { id: recipient.id },
        data: { status: BulkSendStatus.SKIPPED, errorMessage: "Email address is suppressed" },
      });
      return;
    }

    // Raw pasted emails with no matching CRM contact get blank merge
    // fields rather than a raw {{firstName}} placeholder in the sent email.
    const mergeData = {
      firstName: recipient.contact?.firstName ?? "",
      lastName: recipient.contact?.lastName ?? "",
      title: recipient.contact?.title ?? null,
      companyName:
        recipient.contact?.company?.name ??
        inferCompanyFromEmail(recipient.email) ??
        null,
      email: recipient.email,
    };
    // A campaign carries either a saved template or its own inline one-off
    // subject/body (see BulkEmailService.resolveContent) -- both render
    // through the same merge-field pass, so personalization behaves
    // identically either way.
    const rawSubject = recipient.campaign.template?.subject ?? recipient.campaign.subject;
    const rawBody = recipient.campaign.template?.bodyHtml ?? recipient.campaign.bodyHtml;
    if (!rawSubject || !rawBody) {
      await this.prisma.bulkEmailRecipient.update({
        where: { id: recipient.id },
        data: {
          status: BulkSendStatus.FAILED,
          errorMessage: "Campaign has no email content -- its template may have been deleted",
          sentAt: new Date(),
        },
      });
      return;
    }
    let subject = renderMergeFields(rawSubject, mergeData);
    // Merge fields first, then formatting -- so a value containing a newline
    // becomes a line break rather than disappearing into the markup.
    let merged = renderMergeFields(rawBody, mergeData);

    // Optional: have the AI tailor this recipient's copy. It works on plain text, so a body with real markup
    // (links, images, tables) is left alone; a plain or paragraph-only body is fine. If the AI is unavailable
    // or returns something unsafe, the original email goes out unchanged rather than the recipient failing.
    if (recipient.campaign.aiPersonalize && this.emailAi && isPlainOrSimpleHtml(merged)) {
      const tailored = await this.emailAi.personalizeForSend(
        {
          baseSubject: subject,
          baseBody: simpleHtmlToPlainText(merged),
          recipient: {
            firstName: mergeData.firstName,
            lastName: mergeData.lastName,
            title: mergeData.title,
            companyName: mergeData.companyName,
          },
          instructions: recipient.campaign.aiInstructions,
        },
        recipient.campaign.creatorId,
      );
      if (tailored) {
        subject = tailored.subject;
        merged = tailored.body;
      }
    }
    const appendSignature =
      recipient.campaign.template?.appendSignature ?? recipient.campaign.appendSignature;
    const body = composeEmailHtml(
      merged,
      appendSignature ? recipient.campaign.creator.emailSignatureHtml : null,
    );
    const appUrl =
      this.config.get<string>("APP_URL") ??
      this.config.get<string>("CORS_ORIGIN") ??
      "http://localhost:8080";
    const unsubscribeUrl = buildUnsubscribeUrl(recipient.email, appUrl);
    const trackingUrl = `${appUrl.replace(/\/$/, "")}/api/tracking/open/bulk/${recipient.id}`;
    const clickTrackingUrl = `${appUrl.replace(/\/$/, "")}/api/tracking/click/bulk/${recipient.id}`;
    const bodyWithClickTracking = rewriteLinksForTracking(body, clickTrackingUrl);
    const html = appendTrackingFooter(bodyWithClickTracking, { unsubscribeUrl, trackingUrl });

    // Sends from the campaign creator's own connected mailbox when available
    // -- recipients see (and can reply to) the actual salesperson. Falls
    // back to the shared HTTP sender (see EmailConnectionsService.
    // requireSendable) when SMTP isn't connected/available. Both "not
    // connected" and a real delivery failure land the recipient on FAILED
    // with the underlying reason.
    try {
      const sendable = await this.emailConnections.requireSendable(
        recipient.campaign.creatorId,
        recipient.campaign.emailConnectionId,
      );
      let providerMessageId: string | null = null;
      let threadId: string | null = null;

      if (sendable.mode === "smtp") {
        const info = await sendable.transporter.sendMail({
          from: sendable.from,
          to: recipient.email,
          subject,
          html,
        });
        providerMessageId = (info as any)?.messageId ?? null;
      } else if (sendable.mode === "oauth") {
        const sent = await this.emailOAuth.sendMail(sendable.provider, sendable.accessToken, {
          to: recipient.email,
          subject,
          html,
          from: sendable.from,
        });
        if (sent) {
          providerMessageId = sent.messageId ?? null;
          threadId = sent.threadId ?? null;
        }
      } else {
        const result = await sendEmail({
          to: recipient.email,
          subject,
          html,
          replyTo: sendable.replyTo,
        });
        if (!result.delivered) {
          throw new Error(sendFailureMessage(result));
        }
      }
      await this.prisma.bulkEmailRecipient.update({
        where: { id: recipient.id },
        data: {
          status: BulkSendStatus.SENT,
          errorMessage: null,
          sentAt: new Date(),
          providerMessageId,
          threadId,
        },
      });
      if (this.emailSyncEngine) {
        const fromAddress = "from" in sendable ? sendable.from : sendable.replyTo;
        await this.emailSyncEngine.recordSentEmail({
          userId: recipient.campaign.creatorId,
          fromAddress,
          toAddresses: [recipient.email],
          subject,
          bodyHtml: html,
          providerMessageId,
          threadId,
          contactId: recipient.contactId,
        }).catch(() => undefined);
      }
      if (recipient.contactId) {
        await this.engagementEvents.record({
          type: "EMAIL_SENT",
          contactId: recipient.contactId,
          campaignId: recipient.campaign.id,
          recipientId: recipient.id,
          ownerId: recipient.campaign.creatorId,
        });
      }
    } catch (err) {
      await this.prisma.bulkEmailRecipient.update({
        where: { id: recipient.id },
        data: {
          status: BulkSendStatus.FAILED,
          errorMessage: err instanceof Error ? err.message : String(err),
          sentAt: new Date(),
        },
      });
    }
  }
}
