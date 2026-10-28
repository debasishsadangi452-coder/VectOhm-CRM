import { Injectable, Logger, Optional } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { EnrollmentStatus, SendStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { EmailSuppressionService } from "../email-suppression/email-suppression.service";
import { EmailConnectionsService } from "../email-connections/email-connections.service";
import { EmailOAuthService } from "../email-oauth/email-oauth.service";
import { EmailSyncEngineService } from "../email-oauth/email-sync-engine.service";
import { renderMergeFields } from "../../common/utils/merge-fields";
import { composeEmailHtml } from "../../common/utils/email-body";
import { buildUnsubscribeUrl } from "../../common/utils/unsubscribe-token";
import { appendTrackingFooter } from "../../common/utils/email-tracking";
import { rewriteLinksForTracking } from "../../common/utils/rewrite-links";
import { sendEmail, sendFailureMessage } from "../../common/utils/mailer";
import { EngagementEventsService } from "../engagement/engagement-events.service";
import { randomUUID } from "node:crypto";

// Periodically advances every ACTIVE enrollment whose nextSendAt is due:
// sends the current step's template (merge-fielded + an unsubscribe footer),
// logs a SequenceSend, and either advances to the next step or completes the
// enrollment. Suppressed/unsubscribed addresses are skipped and stopped
// rather than sent to. Runs independently per enrollment -- one failure
// never blocks the rest of the batch.
const dueEnrollmentInclude = {
  contact: { include: { company: { select: { name: true } } } },
  // Whoever enrolled the contact is the sender, so theirs is the signature
  // appended when a step's template asks for one.
  enrolledBy: { select: { emailSignatureHtml: true } },
} satisfies Prisma.SequenceEnrollmentInclude;

type DueEnrollment = Prisma.SequenceEnrollmentGetPayload<{ include: typeof dueEnrollmentInclude }>;

@Injectable()
export class SequenceEngineService {
  private readonly logger = new Logger(SequenceEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly suppression: EmailSuppressionService,
    private readonly emailConnections: EmailConnectionsService,
    private readonly emailOAuth: EmailOAuthService,
    private readonly config: ConfigService,
    private readonly engagementEvents: EngagementEventsService,
    @Optional() private readonly emailSyncEngine?: EmailSyncEngineService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron() {
    await this.runOnce();
  }

  // Also callable directly (Admin-triggered "run now" endpoint, and used by
  // tests) so nobody has to wait up to 5 minutes to see the engine work.
  async runOnce(): Promise<{ processed: number }> {
    const due = await this.prisma.sequenceEnrollment.findMany({
      where: {
        status: EnrollmentStatus.ACTIVE,
        nextSendAt: { lte: new Date() },
        sequence: { status: "ACTIVE" },
      },
      include: dueEnrollmentInclude,
    });

    for (const enrollment of due) {
      try {
        await this.processEnrollment(enrollment);
      } catch (err) {
        this.logger.error(
          `Enrollment ${enrollment.id} threw during processing: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return { processed: due.length };
  }

  private async processEnrollment(enrollment: DueEnrollment) {
    // Step at the enrollment's current order; if it was deleted since
    // scheduling, fall back to the next surviving step.
    let step = await this.prisma.sequenceStep.findFirst({
      where: { sequenceId: enrollment.sequenceId, order: enrollment.currentStepOrder },
      include: { template: true },
    });
    if (!step) {
      step = await this.prisma.sequenceStep.findFirst({
        where: { sequenceId: enrollment.sequenceId, order: { gte: enrollment.currentStepOrder } },
        orderBy: { order: "asc" },
        include: { template: true },
      });
    }
    if (!step) {
      await this.prisma.sequenceEnrollment.update({
        where: { id: enrollment.id },
        data: { status: EnrollmentStatus.COMPLETED },
      });
      await this.engagementEvents.record({
        type: "SEQUENCE_COMPLETED",
        contactId: enrollment.contactId,
        sequenceId: enrollment.sequenceId,
        ownerId: enrollment.enrolledById,
      });
      return;
    }

    const email = enrollment.contact.email;
    if (!email) {
      await this.prisma.sequenceEnrollment.update({
        where: { id: enrollment.id },
        data: { status: EnrollmentStatus.STOPPED, stoppedReason: "Contact has no email address" },
      });
      return;
    }

    if (await this.suppression.isSuppressed(email)) {
      await this.prisma.sequenceEnrollment.update({
        where: { id: enrollment.id },
        data: { status: EnrollmentStatus.STOPPED, stoppedReason: "Email address is suppressed" },
      });
      return;
    }

    const mergeData = {
      firstName: enrollment.contact.firstName,
      lastName: enrollment.contact.lastName,
      title: enrollment.contact.title,
      companyName: enrollment.contact.company?.name ?? null,
    };
    const subject = renderMergeFields(step.template.subject, mergeData);
    // Same plain-text-to-HTML pass as the bulk engine, so a template's line
    // breaks survive whichever engine sends it.
    const body = composeEmailHtml(
      renderMergeFields(step.template.bodyHtml, mergeData),
      step.template.appendSignature ? enrollment.enrolledBy?.emailSignatureHtml : null,
    );
    const appUrl =
      this.config.get<string>("APP_URL") ??
      this.config.get<string>("CORS_ORIGIN") ??
      "http://localhost:8080";
    const unsubscribeUrl = buildUnsubscribeUrl(email, appUrl);
    const sendId = randomUUID();
    const trackingUrl = `${appUrl.replace(/\/$/, "")}/api/tracking/open/sequence/${sendId}`;
    const clickTrackingUrl = `${appUrl.replace(/\/$/, "")}/api/tracking/click/sequence/${sendId}`;
    const bodyWithClickTracking = rewriteLinksForTracking(body, clickTrackingUrl);
    const html = appendTrackingFooter(bodyWithClickTracking, { unsubscribeUrl, trackingUrl });

    // Reserve the row (and its id, embedded in the tracking URL above)
    // BEFORE the email is actually sent. Creating it only after sendMail()
    // returned meant a fast mail-client image prefetch (or even the
    // recipient) could fetch the tracking pixel before this row existed --
    // trackSequenceOpen would find nothing and the open was silently
    // dropped forever. The row now always exists by the time the email can
    // possibly be delivered.
    await this.prisma.sequenceSend.create({
      data: {
        id: sendId,
        enrollmentId: enrollment.id,
        stepId: step.id,
        status: SendStatus.PENDING,
      },
    });

    // Sends from whoever enrolled this contact when their SMTP mailbox is
    // connected -- same reasoning as the bulk-email engine. Falls back to
    // the shared HTTP sender (see EmailConnectionsService.requireSendable)
    // when it isn't. A failure either way is a real failure here too (not
    // silently skipped), so it's visible in Activity and retried on the
    // next tick like any other delivery failure.
    let failed: boolean;
    let errorMessage: string | null;
    let providerMessageId: string | null = null;
    let threadId: string | null = null;
    let sendableFrom = "crm@zoho.com";
    try {
      const sendable = await this.emailConnections.requireSendable(enrollment.enrolledById);
      sendableFrom = "from" in sendable ? sendable.from : sendable.replyTo;
      if (sendable.mode === "smtp") {
        await sendable.transporter.sendMail({ from: sendable.from, to: email, subject, html });
      } else if (sendable.mode === "oauth") {
        const sent = await this.emailOAuth.sendMail(sendable.provider, sendable.accessToken, {
          to: email,
          subject,
          html,
          from: sendable.from,
        });
        if (sent) {
          providerMessageId = sent.messageId ?? null;
          threadId = sent.threadId ?? null;
        }
      } else {
        const result = await sendEmail({ to: email, subject, html, replyTo: sendable.replyTo });
        if (!result.delivered) {
          throw new Error(sendFailureMessage(result));
        }
      }
      failed = false;
      errorMessage = null;
    } catch (err) {
      failed = true;
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    await this.prisma.sequenceSend.update({
      where: { id: sendId },
      data: {
        status: failed ? SendStatus.FAILED : SendStatus.SENT,
        errorMessage,
        providerMessageId,
        threadId,
      },
    });

    if (failed) {
      // Leave nextSendAt as-is so the next engine tick retries this same step.
      return;
    }

    if (this.emailSyncEngine) {
      await this.emailSyncEngine.recordSentEmail({
        userId: enrollment.enrolledById,
        fromAddress: sendableFrom,
        toAddresses: [email],
        subject,
        bodyHtml: html,
        providerMessageId,
        threadId,
        contactId: enrollment.contactId,
      }).catch(() => undefined);
    }

    await this.engagementEvents.record({
      type: "EMAIL_SENT",
      contactId: enrollment.contactId,
      sequenceId: enrollment.sequenceId,
      recipientId: sendId,
      ownerId: enrollment.enrolledById,
    });

    const nextStep = await this.prisma.sequenceStep.findFirst({
      where: { sequenceId: enrollment.sequenceId, order: { gt: step.order } },
      orderBy: { order: "asc" },
    });

    if (nextStep) {
      await this.prisma.sequenceEnrollment.update({
        where: { id: enrollment.id },
        data: {
          currentStepOrder: nextStep.order,
          nextSendAt: addDays(new Date(), nextStep.delayDays),
        },
      });
    } else {
      await this.prisma.sequenceEnrollment.update({
        where: { id: enrollment.id },
        data: { status: EnrollmentStatus.COMPLETED },
      });
      await this.engagementEvents.record({
        type: "SEQUENCE_COMPLETED",
        contactId: enrollment.contactId,
        sequenceId: enrollment.sequenceId,
        ownerId: enrollment.enrolledById,
      });
    }
  }
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
