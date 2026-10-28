import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { EmailDirection, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { EmailSyncEngineService } from "../email-oauth/email-sync-engine.service";
import { EmailConnectionsService } from "../email-connections/email-connections.service";
import { EmailOAuthService } from "../email-oauth/email-oauth.service";
import type { RequestUser } from "../../common/types/request-user.type";
import { SendDirectEmailDto } from "./dto/send-email.dto";
import { sendEmail, sendFailureMessage } from "../../common/utils/mailer";

@Injectable()
export class SyncedEmailsService {
  private readonly logger = new Logger(SyncedEmailsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly syncEngine: EmailSyncEngineService,
    private readonly emailConnections: EmailConnectionsService,
    private readonly emailOAuth: EmailOAuthService,
  ) {}

  async list(
    user: RequestUser,
    filters: {
      contactId?: string;
      dealId?: string;
      direction?: EmailDirection;
      search?: string;
    },
  ) {
    let connection = await this.prisma.userEmailConnection.findFirst({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    });

    // If the requesting user doesn't have a personal mailbox connected,
    // allow Admins and Managers to inspect the active CRM company connection (e.g. Zoho)
    if (
      !connection &&
      (user.role.name === RoleName.ADMIN || user.role.name === RoleName.MANAGER)
    ) {
      connection = await this.prisma.userEmailConnection.findFirst({
        where: { verified: true },
        orderBy: { updatedAt: "desc" },
      });
    }

    if (!connection) return [];

    // Automatically purge any empty ghost records (emails with no subject and no body content, or obsolete bulk-send placeholders)
    if (filters.direction === EmailDirection.SENT) {
      await this.prisma.syncedEmail
        .deleteMany({
          where: {
            connectionId: connection.id,
            direction: EmailDirection.SENT,
            OR: [
              { providerMessageId: { startsWith: "bulk-send-" } },
              {
                AND: [
                  { OR: [{ subject: "(No Subject)" }, { subject: "" }] },
                  { bodyPreview: "" },
                  { OR: [{ bodyHtml: "" }, { bodyHtml: null }] },
                ],
              },
            ],
          },
        })
        .catch(() => undefined);
    }

    const where: any = {
      connectionId: connection.id,
      contactId: filters.contactId,
      dealId: filters.dealId,
      ...(filters.direction ? { direction: filters.direction } : {}),
      NOT: [
        {
          AND: [
            { OR: [{ subject: "(No Subject)" }, { subject: "" }] },
            { bodyPreview: "" },
            { OR: [{ bodyHtml: "" }, { bodyHtml: null }] },
          ],
        },
      ],
    };

    if (filters.search?.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { subject: { contains: q, mode: "insensitive" } },
        { toAddresses: { has: q } },
        { fromAddress: { contains: q, mode: "insensitive" } },
        { bodyPreview: { contains: q, mode: "insensitive" } },
      ];
    }

    const emails = await this.prisma.syncedEmail.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            company: { select: { name: true } },
          },
        },
        deal: {
          select: { id: true, title: true },
        },
      },
      take: 200,
    });

    // Deduplicate sent emails sent to the same recipient with identical or empty content
    const seen = new Map<string, typeof emails[0]>();
    const deduplicated: typeof emails = [];

    for (const email of emails) {
      const recipientKey = (email.toAddresses?.[0] || "").toLowerCase().trim();
      const subjectKey = (email.subject || "").toLowerCase().trim();
      const timeBucket = Math.floor(new Date(email.occurredAt).getTime() / 60000); // 1-minute bucket
      const dedupeKey = `${recipientKey}|${subjectKey}|${timeBucket}`;

      const existing = seen.get(dedupeKey);
      if (!existing) {
        seen.set(dedupeKey, email);
        deduplicated.push(email);
      } else {
        // Keep the record with richer body content
        const existingLen = (existing.bodyHtml?.length || 0) + (existing.bodyPreview?.length || 0);
        const currentLen = (email.bodyHtml?.length || 0) + (email.bodyPreview?.length || 0);
        if (currentLen > existingLen) {
          const idx = deduplicated.indexOf(existing);
          if (idx !== -1) {
            deduplicated[idx] = email;
            seen.set(dedupeKey, email);
          }
        }
      }
    }

    return deduplicated;
  }

  async sendDirectEmail(user: RequestUser, dto: SendDirectEmailDto) {
    const sendable = await this.emailConnections.requireSendable(user.id);
    const to = dto.to.trim();
    if (!to) {
      throw new BadRequestException("Recipient email address is required");
    }

    const toAddresses = to.split(",").map((s) => s.trim()).filter(Boolean);
    const ccAddresses = dto.cc ? dto.cc.map((s) => s.trim()).filter(Boolean) : [];
    const html = dto.bodyHtml || `<p>${(dto.bodyText || "").replace(/\n/g, "<br/>")}</p>`;
    let providerMessageId: string | undefined;

    if (sendable.mode === "smtp") {
      const info = await sendable.transporter.sendMail({
        from: sendable.from,
        to: toAddresses.join(", "),
        cc: ccAddresses.length > 0 ? ccAddresses.join(", ") : undefined,
        subject: dto.subject,
        html,
        text: dto.bodyText,
      });
      providerMessageId = (info as any)?.messageId;

      // Append to the connected mail ID's platform (Zoho Mail Sent folder)
      await this.syncEngine
        .appendSentMessage(user.id, {
          from: sendable.from,
          to: toAddresses.join(", "),
          cc: ccAddresses.length > 0 ? ccAddresses.join(", ") : undefined,
          subject: dto.subject,
          html,
          text: dto.bodyText,
          messageId: providerMessageId,
        })
        .catch((appendErr) => {
          this.logger.warn(`Failed to append sent message to platform Sent folder: ${appendErr}`);
        });
    } else if (sendable.mode === "oauth") {
      const sent = await this.emailOAuth.sendMail(sendable.provider, sendable.accessToken, {
        to: toAddresses.join(", "),
        subject: dto.subject,
        html,
        from: sendable.from,
      });
      providerMessageId = sent?.messageId;
    } else {
      const result = await sendEmail({
        to: toAddresses.join(", "),
        subject: dto.subject,
        html,
        replyTo: sendable.replyTo,
      });
      if (!result.delivered) {
        throw new Error(sendFailureMessage(result));
      }
    }

    // Record into SyncedEmail so it is immediately visible in the "Sent" panel
    return this.syncEngine.recordSentEmail({
      userId: user.id,
      fromAddress: "from" in sendable ? sendable.from : sendable.replyTo,
      toAddresses,
      ccAddresses,
      subject: dto.subject,
      bodyHtml: html,
      bodyText: dto.bodyText,
      providerMessageId,
      contactId: dto.contactId,
      dealId: dto.dealId,
    });
  }

  async syncNow(user: RequestUser) {
    let connection = await this.prisma.userEmailConnection.findFirst({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    });
    if (
      !connection &&
      (user.role.name === RoleName.ADMIN || user.role.name === RoleName.MANAGER)
    ) {
      connection = await this.prisma.userEmailConnection.findFirst({
        where: { verified: true },
        orderBy: { updatedAt: "desc" },
      });
    }
    if (!connection) {
      throw new BadRequestException("No mailbox connected yet");
    }
    return this.syncEngine.syncConnection(connection);
  }

  async markRead(id: string, user: RequestUser) {
    const message = await this.prisma.syncedEmail.findUnique({
      where: { id },
      include: { connection: { select: { userId: true } } },
    });
    if (!message) {
      throw new NotFoundException("Message not found");
    }
    if (
      message.connection.userId !== user.id &&
      user.role.name !== RoleName.ADMIN &&
      user.role.name !== RoleName.MANAGER
    ) {
      throw new ForbiddenException("This isn't your connected mailbox");
    }
    return this.prisma.syncedEmail.update({ where: { id }, data: { isRead: true } });
  }

  async delete(id: string, user: RequestUser) {
    const message = await this.prisma.syncedEmail.findUnique({
      where: { id },
      include: { connection: { select: { userId: true } } },
    });
    if (!message) {
      throw new NotFoundException("Message not found");
    }
    if (
      message.connection.userId !== user.id &&
      user.role.name !== RoleName.ADMIN &&
      user.role.name !== RoleName.MANAGER
    ) {
      throw new ForbiddenException("This isn't your connected mailbox");
    }
    await this.prisma.syncedEmail.delete({ where: { id } });
    return { success: true };
  }
}

