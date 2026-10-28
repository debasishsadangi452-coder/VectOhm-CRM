import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { EmailConnectionType, EmailDirection } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { EmailOAuthService } from "./email-oauth.service";
import { EngagementEventsService } from "../engagement/engagement-events.service";
import { decryptSecret } from "../../common/utils/token-crypto";
import Imap from "imap";
import { simpleParser } from "mailparser";
import * as nodemailer from "nodemailer";

// Polling sync (v1) rather than push (Gmail Pub/Sub watch / Graph
// subscriptions) -- push needs a GCP Pub/Sub topic + IAM setup beyond just
// the OAuth app, plus its own renewal cron (Gmail watches expire after 7
// days, Graph subscriptions after ~3), for latency gains that don't matter
// much for a synced-inbox view. See the approved plan for the full
// reasoning; push sync is a clean v2 that slots into modules/webhooks
// without touching this model.

const BACKFILL_DAYS = 30;
const BATCH_SIZE = 25; // connections processed per tick, not messages

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailMessage {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: { headers?: GmailHeader[] };
}

interface GraphMessage {
  id: string;
  conversationId?: string;
  subject?: string;
  bodyPreview?: string;
  receivedDateTime?: string;
  sentDateTime?: string;
  from?: { emailAddress?: { address?: string } };
  toRecipients?: { emailAddress?: { address?: string } }[];
  ccRecipients?: { emailAddress?: { address?: string } }[];
  "@removed"?: unknown;
}

interface MicrosoftCursor {
  inboxDelta?: string;
  sentDelta?: string;
}

@Injectable()
export class EmailSyncEngineService {
  private readonly logger = new Logger(EmailSyncEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauth: EmailOAuthService,
    private readonly engagementEvents: EngagementEventsService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron() {
    await this.runOnce();
  }

  async runOnce(): Promise<{ processed: number }> {
    const connections = await this.prisma.userEmailConnection.findMany({
      where: {
        connectionType: {
          in: [
            EmailConnectionType.OAUTH_GOOGLE,
            EmailConnectionType.OAUTH_MICROSOFT,
            EmailConnectionType.SMTP,
          ],
        },
        verified: true,
      },
      take: BATCH_SIZE,
    });

    for (const connection of connections) {
      try {
        if (connection.connectionType === EmailConnectionType.OAUTH_GOOGLE) {
          await this.syncGoogle(connection);
        } else if (connection.connectionType === EmailConnectionType.OAUTH_MICROSOFT) {
          await this.syncMicrosoft(connection);
        } else if (connection.connectionType === EmailConnectionType.SMTP) {
          await this.syncImap(connection);
        }
      } catch (err) {
        this.logger.error(
          `Sync failed for connection ${connection.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return { processed: connections.length };
  }

  async syncConnection(connection: any): Promise<{ processed: number; syncedCount: number }> {
    let syncedCount = 0;
    if (connection.connectionType === EmailConnectionType.OAUTH_GOOGLE) {
      await this.syncGoogle(connection);
    } else if (connection.connectionType === EmailConnectionType.OAUTH_MICROSOFT) {
      await this.syncMicrosoft(connection);
    } else if (connection.connectionType === EmailConnectionType.SMTP) {
      syncedCount = await this.syncImap(connection);
    }
    return { processed: 1, syncedCount };
  }

  async syncImap(connection: {
    id: string;
    smtpHost: string | null;
    smtpUsername: string | null;
    fromEmail: string | null;
    encryptedPassword: string | null;
    passwordIv: string | null;
    passwordAuthTag: string | null;
  }): Promise<number> {
    if (
      !connection.encryptedPassword ||
      !connection.passwordIv ||
      !connection.passwordAuthTag
    ) {
      return 0;
    }

    let password: string;
    try {
      password = decryptSecret({
        ciphertext: connection.encryptedPassword,
        iv: connection.passwordIv,
        authTag: connection.passwordAuthTag,
      });
    } catch {
      this.logger.error(`Could not decrypt password for connection ${connection.id}`);
      return 0;
    }

    const username = connection.smtpUsername || connection.fromEmail;
    if (!username || !password) return 0;

    let imapHost = "imap.zoho.in";
    const host = (connection.smtpHost ?? "").toLowerCase();
    if (host.includes("zoho.com")) {
      imapHost = "imap.zoho.com";
    } else if (host.includes("zoho.in")) {
      imapHost = "imap.zoho.in";
    } else if (host.includes("gmail.com")) {
      imapHost = "imap.gmail.com";
    } else if (host.includes("office365.com") || host.includes("outlook.com")) {
      imapHost = "outlook.office365.com";
    } else if (host.includes("yahoo.com")) {
      imapHost = "imap.mail.yahoo.com";
    } else if (host.startsWith("smtp.")) {
      imapHost = host.replace(/^smtp\./i, "imap.");
    } else if (host) {
      imapHost = host;
    }

    let syncedCount = 0;
    let syncError: string | null = null;

    await new Promise<void>((resolve) => {
      let settled = false;
      let imapInstance: InstanceType<typeof Imap> | null = null;

      const finish = () => {
        if (!settled) {
          settled = true;
          try {
            if (imapInstance && imapInstance.state !== "disconnected") {
              imapInstance.end();
            }
          } catch {
            // ignore
          }
          resolve();
        }
      };

      const timer = setTimeout(() => {
        this.logger.warn(`IMAP sync timed out for connection ${connection.id}`);
        syncError = "Connection timed out reaching Zoho IMAP server. Please try again.";
        finish();
      }, 25000);

      try {
        const imap = new Imap({
          user: username,
          password,
          host: imapHost,
          port: 993,
          tls: true,
          tlsOptions: { rejectUnauthorized: false },
          authTimeout: 10000,
          connTimeout: 10000,
        });
        imapInstance = imap;

        imap.once("ready", async () => {
          const fetchBoxMessages = (boxName: string, direction: EmailDirection): Promise<number> => {
            return new Promise((boxResolve) => {
              imap.openBox(boxName, false, (err, box) => {
                if (err) {
                  this.logger.warn(`Could not open ${boxName} for ${connection.id}: ${err.message}`);
                  boxResolve(0);
                  return;
                }

                const totalMessages = box.messages.total;
                if (totalMessages === 0) {
                  boxResolve(0);
                  return;
                }

                const start = Math.max(1, totalMessages - 49);
                const fetchRange = `${start}:${totalMessages}`;
                const fetcher = imap.seq.fetch(fetchRange, { bodies: "", struct: true });
                const processPromises: Promise<void>[] = [];
                let boxSynced = 0;

                fetcher.on("message", (msg, seqno) => {
                  let buffer = "";
                  let uid = String(seqno);

                  msg.on("attributes", (attrs) => {
                    if (attrs.uid) uid = String(attrs.uid);
                  });

                  msg.on("body", (stream) => {
                    stream.on("data", (chunk: Buffer) => {
                      buffer += chunk.toString("utf8");
                    });
                  });

                  const p = new Promise<void>((msgResolve) => {
                    msg.once("end", async () => {
                      try {
                        const parsed = await simpleParser(buffer);
                        const fromAddress = parsed.from?.value?.[0]?.address ?? "";
                        const toAddresses = (parsed.to ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]) : [])
                          .flatMap((t) => (t.value ? t.value.map((v) => v.address) : []))
                          .filter((a): a is string => !!a);
                        const ccAddresses = (parsed.cc ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc]) : [])
                          .flatMap((t) => (t.value ? t.value.map((v) => v.address) : []))
                          .filter((a): a is string => !!a);

                        const providerMessageId = parsed.messageId || `imap-${connection.id}-${boxName.toLowerCase()}-${uid}`;
                        const rawText = parsed.text || (typeof parsed.html === "string" ? parsed.html.replace(/<[^>]+>/g, " ") : "");
                        const bodyHtml = typeof parsed.html === "string" ? parsed.html : null;
                        const bodyPreview = rawText.trim();

                        // Skip empty ghost / corrupted messages with no subject and no body content
                        if ((!parsed.subject || parsed.subject.trim() === "" || parsed.subject === "(No Subject)") && !bodyPreview && !bodyHtml) {
                          msgResolve();
                          return;
                        }

                        await this.upsertSyncedEmail({
                          connectionId: connection.id,
                          providerMessageId,
                          threadId: parsed.inReplyTo || parsed.messageId || undefined,
                          direction,
                          fromAddress,
                          toAddresses,
                          ccAddresses,
                          subject: parsed.subject ?? "(No Subject)",
                          bodyPreview,
                          bodyHtml,
                          occurredAt: parsed.date ?? new Date(),
                        });
                        boxSynced++;
                      } catch (parseErr) {
                        this.logger.warn(`Failed parsing email ${seqno} in ${boxName}: ${parseErr}`);
                      }
                      msgResolve();
                    });
                  });

                  processPromises.push(p);
                });

                fetcher.once("error", (fErr) => {
                  this.logger.warn(`IMAP fetcher error in ${boxName}: ${fErr}`);
                  boxResolve(boxSynced);
                });

                fetcher.once("end", async () => {
                  try {
                    await Promise.all(processPromises);
                  } catch (pErr) {
                    this.logger.warn(`Error resolving message promises in ${boxName}: ${pErr}`);
                  }
                  boxResolve(boxSynced);
                });
              });
            });
          };

          try {
            // 1. Sync INBOX for incoming emails
            const inboxCount = await fetchBoxMessages("INBOX", EmailDirection.RECEIVED);
            syncedCount += inboxCount;

            // 2. Discover and sync Sent folder for outbound emails (Zoho standard is "Sent")
            let sentBoxName: string | null = null;
            await new Promise<void>((boxesResolve) => {
              imap.getBoxes((err, boxes) => {
                if (!err && boxes) {
                  const findSent = (boxTree: any, prefix = ""): string | null => {
                    for (const key of Object.keys(boxTree)) {
                      const fullPath = prefix ? `${prefix}/${key}` : key;
                      const attribs: string[] = boxTree[key]?.attribs || [];
                      if (
                        attribs.some((a) => a.toLowerCase().includes("sent")) ||
                        key.toLowerCase() === "sent" ||
                        key.toLowerCase() === "sent items" ||
                        key.toLowerCase() === "sent messages"
                      ) {
                        return fullPath;
                      }
                      if (boxTree[key]?.children) {
                        const found = findSent(boxTree[key].children, fullPath);
                        if (found) return found;
                      }
                    }
                    return null;
                  };
                  sentBoxName = findSent(boxes);
                }
                boxesResolve();
              });
            });

            if (!sentBoxName) {
              sentBoxName = "Sent"; // default in Zoho Mail
            }

            const sentCount = await fetchBoxMessages(sentBoxName, EmailDirection.SENT);
            syncedCount += sentCount;
          } catch (syncErr) {
            this.logger.warn(`IMAP sync error for ${connection.id}: ${syncErr}`);
          } finally {
            clearTimeout(timer);
            finish();
          }
        });

        imap.once("error", (err: Error) => {
          this.logger.warn(`IMAP error for ${connection.id}: ${err.message}`);
          const msg = err.message || "";
          if (
            msg.includes("AUTHENTICATIONFAILED") ||
            msg.toLowerCase().includes("disabled") ||
            msg.toLowerCase().includes("denied")
          ) {
            syncError =
              "Zoho rejected IMAP authentication. Please verify that 'IMAP Access' is turned ON in Zoho Mail Settings (Mail Accounts -> IMAP Access) and that you are using a Zoho App Password.";
          } else {
            syncError = `IMAP error: ${msg}`;
          }
          clearTimeout(timer);
          finish();
        });

        imap.connect();
      } catch (connErr) {
        this.logger.warn(`Failed creating IMAP connection: ${connErr}`);
        syncError = `Failed creating IMAP connection: ${connErr instanceof Error ? connErr.message : String(connErr)}`;
        clearTimeout(timer);
        finish();
      }
    });

    if (syncError) {
      throw new BadRequestException(syncError);
    }

    try {
      await this.prisma.userEmailConnection.update({
        where: { id: connection.id },
        data: { lastSyncedAt: new Date() },
      });
    } catch {
      // ignore
    }

    return syncedCount;
  }

  // --- Gmail: a single historyId cursor covers the whole mailbox ---

  private async syncGoogle(
    connection: Parameters<EmailOAuthService["resolveAccessToken"]>[0] & {
      id: string;
      providerAccountEmail: string | null;
      syncCursor: string | null;
    },
  ) {
    const accessToken = await this.oauth.resolveAccessToken(connection);

    if (!connection.syncCursor) {
      await this.backfillGoogle(connection.id, accessToken, connection.providerAccountEmail);
      return;
    }

    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${connection.syncCursor}&historyTypes=messageAdded`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (res.status === 404) {
      // historyId too old / expired -- Gmail's own guidance is to fall back
      // to a fresh backfill rather than error out.
      await this.backfillGoogle(connection.id, accessToken, connection.providerAccountEmail);
      return;
    }
    if (!res.ok) {
      this.logger.error(
        `Gmail history.list failed (${res.status}) for connection ${connection.id}`,
      );
      return;
    }
    const body = (await res.json()) as {
      history?: { messagesAdded?: { message: { id: string } }[] }[];
      historyId?: string;
    };
    const messageIds = new Set<string>();
    for (const h of body.history ?? []) {
      for (const added of h.messagesAdded ?? []) {
        messageIds.add(added.message.id);
      }
    }
    for (const id of messageIds) {
      await this.ingestGoogleMessage(
        connection.id,
        accessToken,
        id,
        connection.providerAccountEmail,
      );
    }

    await this.prisma.userEmailConnection.update({
      where: { id: connection.id },
      data: { syncCursor: body.historyId ?? connection.syncCursor, lastSyncedAt: new Date() },
    });
  }

  private async backfillGoogle(
    connectionId: string,
    accessToken: string,
    accountEmail: string | null,
  ) {
    const afterEpoch = Math.floor((Date.now() - BACKFILL_DAYS * 24 * 60 * 60 * 1000) / 1000);
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=after:${afterEpoch}&maxResults=100`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!listRes.ok) {
      this.logger.error(
        `Gmail messages.list (backfill) failed (${listRes.status}) for connection ${connectionId}`,
      );
      return;
    }
    const list = (await listRes.json()) as { messages?: { id: string }[] };
    for (const m of list.messages ?? []) {
      await this.ingestGoogleMessage(connectionId, accessToken, m.id, accountEmail);
    }

    const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = profileRes.ok ? ((await profileRes.json()) as { historyId?: string }) : {};
    await this.prisma.userEmailConnection.update({
      where: { id: connectionId },
      data: { syncCursor: profile.historyId ?? null, lastSyncedAt: new Date() },
    });
  }

  private async ingestGoogleMessage(
    connectionId: string,
    accessToken: string,
    messageId: string,
    accountEmail: string | null,
  ) {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return;
    const msg = (await res.json()) as GmailMessage;
    const headers = msg.payload?.headers ?? [];
    const header = (name: string) =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

    const direction = msg.labelIds?.includes("SENT")
      ? EmailDirection.SENT
      : EmailDirection.RECEIVED;
    const fromAddress = extractAddress(header("From")) || accountEmail || "";
    const toAddresses = extractAddresses(header("To"));
    const ccAddresses = extractAddresses(header("Cc"));

    await this.upsertSyncedEmail({
      connectionId,
      providerMessageId: msg.id,
      threadId: msg.threadId,
      direction,
      fromAddress,
      toAddresses,
      ccAddresses,
      subject: header("Subject"),
      bodyPreview: msg.snippet ?? "",
      occurredAt: msg.internalDate ? new Date(Number(msg.internalDate)) : new Date(),
    });
  }

  // --- Microsoft Graph: delta is folder-scoped, so Inbox and Sent Items
  // each carry their own cursor packed into syncCursor as JSON ---

  private async syncMicrosoft(
    connection: Parameters<EmailOAuthService["resolveAccessToken"]>[0] & {
      id: string;
      syncCursor: string | null;
    },
  ) {
    const accessToken = await this.oauth.resolveAccessToken(connection);
    const cursor: MicrosoftCursor = connection.syncCursor
      ? safeJsonParse(connection.syncCursor)
      : {};

    const [inboxResult, sentResult] = await Promise.all([
      this.syncGraphFolder(
        accessToken,
        "inbox",
        cursor.inboxDelta,
        EmailDirection.RECEIVED,
        connection.id,
      ),
      this.syncGraphFolder(
        accessToken,
        "sentitems",
        cursor.sentDelta,
        EmailDirection.SENT,
        connection.id,
      ),
    ]);

    const nextCursor: MicrosoftCursor = {
      inboxDelta: inboxResult ?? cursor.inboxDelta,
      sentDelta: sentResult ?? cursor.sentDelta,
    };
    await this.prisma.userEmailConnection.update({
      where: { id: connection.id },
      data: { syncCursor: JSON.stringify(nextCursor), lastSyncedAt: new Date() },
    });
  }

  // Returns the new delta link (to persist) or undefined on failure.
  private async syncGraphFolder(
    accessToken: string,
    folder: "inbox" | "sentitems",
    existingDeltaLink: string | undefined,
    direction: EmailDirection,
    connectionId: string,
  ): Promise<string | undefined> {
    let url =
      existingDeltaLink ??
      `https://graph.microsoft.com/v1.0/me/mailFolders/${folder}/messages/delta?$select=subject,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,conversationId` +
        (existingDeltaLink
          ? ""
          : `&$filter=receivedDateTime ge ${new Date(Date.now() - BACKFILL_DAYS * 24 * 60 * 60 * 1000).toISOString()}`);

    let deltaLink: string | undefined;
    // Graph paginates via @odata.nextLink until the final page carries
    // @odata.deltaLink -- follow the whole chain in one tick so a large
    // backfill doesn't silently stall mid-way.

    while (true) {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (res.status === 410) {
        // Delta token expired -- Graph's guidance is to restart without a
        // token (a fresh backfill for this folder).
        return this.syncGraphFolder(accessToken, folder, undefined, direction, connectionId);
      }
      if (!res.ok) {
        this.logger.error(
          `Graph ${folder} delta failed (${res.status}) for connection ${connectionId}`,
        );
        return undefined;
      }
      const body = (await res.json()) as {
        value?: GraphMessage[];
        "@odata.nextLink"?: string;
        "@odata.deltaLink"?: string;
      };
      for (const m of body.value ?? []) {
        if (m["@removed"]) continue;
        await this.upsertSyncedEmail({
          connectionId,
          providerMessageId: m.id,
          threadId: m.conversationId,
          direction,
          fromAddress: m.from?.emailAddress?.address ?? "",
          toAddresses: (m.toRecipients ?? [])
            .map((r) => r.emailAddress?.address)
            .filter((a): a is string => !!a),
          ccAddresses: (m.ccRecipients ?? [])
            .map((r) => r.emailAddress?.address)
            .filter((a): a is string => !!a),
          subject: m.subject ?? "",
          bodyPreview: m.bodyPreview ?? "",
          occurredAt: new Date(m.receivedDateTime ?? m.sentDateTime ?? Date.now()),
        });
      }
      if (body["@odata.deltaLink"]) {
        deltaLink = body["@odata.deltaLink"];
        break;
      }
      if (body["@odata.nextLink"]) {
        url = body["@odata.nextLink"];
        continue;
      }
      break;
    }
    return deltaLink;
  }

  // --- Shared: idempotent upsert + Contact/Deal address-match linkage ---

  private async upsertSyncedEmail(input: {
    connectionId: string;
    providerMessageId: string;
    threadId?: string;
    direction: EmailDirection;
    fromAddress: string;
    toAddresses: string[];
    ccAddresses: string[];
    subject: string;
    bodyPreview: string;
    bodyHtml?: string | null;
    occurredAt: Date;
  }) {
    // Match by the "other party": whoever isn't the connection's own
    // mailbox. For RECEIVED that's the sender; for SENT that's the
    // recipient(s). Leaves dealId unset -- inferring which of a contact's
    // several deals an email is "about" from an address match alone risks
    // silent misattribution (see the approved plan).
    const otherPartyAddresses =
      input.direction === EmailDirection.RECEIVED ? [input.fromAddress] : input.toAddresses;
    const contact =
      otherPartyAddresses.length > 0
        ? await this.prisma.contact.findFirst({
            where: { email: { in: otherPartyAddresses.filter(Boolean), mode: "insensitive" } },
            select: { id: true },
          })
        : null;

    await this.prisma.syncedEmail.upsert({
      where: {
        connectionId_providerMessageId: {
          connectionId: input.connectionId,
          providerMessageId: input.providerMessageId,
        },
      },
      create: {
        connectionId: input.connectionId,
        providerMessageId: input.providerMessageId,
        threadId: input.threadId,
        direction: input.direction,
        fromAddress: input.fromAddress,
        toAddresses: input.toAddresses,
        ccAddresses: input.ccAddresses,
        subject: input.subject,
        bodyPreview: input.bodyPreview,
        bodyHtml: input.bodyHtml ?? null,
        occurredAt: input.occurredAt,
        contactId: contact?.id,
      },
      // Re-syncing updates body content if it was previously truncated or missing HTML
      update: {
        contactId: contact?.id,
        bodyPreview: input.bodyPreview,
        bodyHtml: input.bodyHtml ?? null,
      },
    });

    if (input.direction === EmailDirection.RECEIVED && input.threadId) {
      const bulkMatch = await this.prisma.bulkEmailRecipient.findFirst({
        where: { threadId: input.threadId },
        include: { campaign: true },
      });
      if (bulkMatch) {
        const existingEvent = await this.prisma.engagementEvent.findFirst({
          where: { type: "EMAIL_REPLIED", recipientId: bulkMatch.id },
        });
        if (!existingEvent) {
          await this.engagementEvents.record({
            type: "EMAIL_REPLIED",
            contactId: contact?.id ?? bulkMatch.contactId ?? undefined,
            campaignId: bulkMatch.campaignId,
            recipientId: bulkMatch.id,
            ownerId: bulkMatch.campaign.creatorId,
            notify: {
              title: "Email Replied",
              message: `Recipient replied to bulk email campaign "${bulkMatch.campaign.name}"`,
            },
          });
        }
      } else {
        const seqMatch = await this.prisma.sequenceSend.findFirst({
          where: { threadId: input.threadId },
          include: { enrollment: { include: { sequence: true } } },
        });
        if (seqMatch) {
          const existingEvent = await this.prisma.engagementEvent.findFirst({
            where: { type: "EMAIL_REPLIED", recipientId: seqMatch.id },
          });
          if (!existingEvent) {
            await this.engagementEvents.record({
              type: "EMAIL_REPLIED",
              contactId: contact?.id ?? seqMatch.enrollment.contactId,
              sequenceId: seqMatch.enrollment.sequenceId,
              recipientId: seqMatch.id,
              ownerId: seqMatch.enrollment.enrolledById,
              notify: {
                title: "Sequence Email Replied",
                message: `Recipient replied to sequence "${seqMatch.enrollment.sequence.name}"`,
              },
            });
          }
        }
      }
    }
  }

  /**
   * Directly record an outbound email sent by CRM (via bulk campaigns, sequences, follow-ups, or direct mail)
   * into SyncedEmail with direction = SENT. This guarantees it immediately appears in the Sent mails panel.
   */
  async recordSentEmail(input: {
    userId: string;
    fromAddress: string;
    toAddresses: string[];
    ccAddresses?: string[];
    subject: string;
    bodyHtml?: string | null;
    bodyText?: string | null;
    providerMessageId?: string | null;
    threadId?: string | null;
    contactId?: string | null;
    dealId?: string | null;
  }) {
    let connection = await this.prisma.userEmailConnection.findFirst({
      where: { userId: input.userId },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    });
    if (!connection) {
      connection = await this.prisma.userEmailConnection.findFirst({
        where: { verified: true },
        orderBy: { updatedAt: "desc" },
      });
    }
    if (!connection) return null;

    const rawText = input.bodyText || (input.bodyHtml ? input.bodyHtml.replace(/<[^>]+>/g, " ") : "");
    const bodyPreview = rawText.trim().slice(0, 500);
    const providerMessageId =
      input.providerMessageId || `sent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    return this.upsertSyncedEmail({
      connectionId: connection.id,
      providerMessageId,
      threadId: input.threadId ?? undefined,
      direction: EmailDirection.SENT,
      fromAddress: input.fromAddress,
      toAddresses: input.toAddresses,
      ccAddresses: input.ccAddresses ?? [],
      subject: input.subject || "(No Subject)",
      bodyPreview,
      bodyHtml: input.bodyHtml ?? null,
      occurredAt: new Date(),
    });
  }

  /**
   * Appends an outbound email into the connected mailbox's IMAP "Sent" folder.
   * This guarantees that any email sent from the CRM also shows up directly in the
   * connected mail ID's native platform (e.g. Zoho Mail web/mobile interface).
   */
  async appendSentMessage(
    userId: string,
    mail: {
      from: string;
      to: string;
      cc?: string;
      subject: string;
      html?: string | null;
      text?: string | null;
      messageId?: string;
    },
  ): Promise<boolean> {
    let connection = await this.prisma.userEmailConnection.findFirst({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    });
    if (!connection) {
      connection = await this.prisma.userEmailConnection.findFirst({
        where: { verified: true },
        orderBy: { updatedAt: "desc" },
      });
    }
    if (!connection || connection.connectionType !== EmailConnectionType.SMTP) {
      return false;
    }

    if (
      !connection.encryptedPassword ||
      !connection.passwordIv ||
      !connection.passwordAuthTag
    ) {
      return false;
    }

    const password = decryptSecret({
      ciphertext: connection.encryptedPassword,
      iv: connection.passwordIv,
      authTag: connection.passwordAuthTag,
    });
    const username = connection.smtpUsername || connection.fromEmail;
    if (!username || !password) return false;

    let imapHost = "imap.zoho.in";
    const host = (connection.smtpHost ?? "").toLowerCase();
    if (host.includes("zoho.com")) {
      imapHost = "imap.zoho.com";
    } else if (host.includes("zoho.in")) {
      imapHost = "imap.zoho.in";
    } else if (host.includes("gmail.com")) {
      imapHost = "imap.gmail.com";
    } else if (host.includes("office365.com") || host.includes("outlook.com")) {
      imapHost = "outlook.office365.com";
    } else if (host.includes("yahoo.com")) {
      imapHost = "imap.mail.yahoo.com";
    } else if (host.startsWith("smtp.")) {
      imapHost = host.replace(/^smtp\./i, "imap.");
    } else if (host) {
      imapHost = host;
    }

    try {
      // Compile RFC822 MIME message
      const streamTransport = nodemailer.createTransport({
        streamTransport: true,
        buffer: true,
      });
      const compiled = await streamTransport.sendMail({
        from: mail.from,
        to: mail.to,
        cc: mail.cc,
        subject: mail.subject,
        text: mail.text || undefined,
        html: mail.html || undefined,
        messageId: mail.messageId,
        date: new Date(),
      });
      const rawBuffer = compiled.message;

      return new Promise<boolean>((resolve) => {
        let settled = false;
        let imapInstance: InstanceType<typeof Imap> | null = null;

        const finish = (res: boolean) => {
          if (!settled) {
            settled = true;
            try {
              if (imapInstance && imapInstance.state !== "disconnected") {
                imapInstance.end();
              }
            } catch {
              // ignore
            }
            resolve(res);
          }
        };

        const timer = setTimeout(() => {
          this.logger.warn(`IMAP append timed out for connection ${connection.id}`);
          finish(false);
        }, 15000);

        try {
          const imap = new Imap({
            user: username,
            password,
            host: imapHost,
            port: 993,
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
            authTimeout: 8000,
            connTimeout: 8000,
          });
          imapInstance = imap;

          imap.once("ready", () => {
            imap.getBoxes((err, boxes) => {
              let sentBox = "Sent";
              if (!err && boxes) {
                const findSent = (boxTree: any, prefix = ""): string | null => {
                  for (const key of Object.keys(boxTree)) {
                    const fullPath = prefix ? `${prefix}/${key}` : key;
                    const attribs: string[] = boxTree[key]?.attribs || [];
                    if (
                      attribs.some((a) => a.toLowerCase().includes("sent")) ||
                      key.toLowerCase() === "sent" ||
                      key.toLowerCase() === "sent items" ||
                      key.toLowerCase() === "sent messages"
                    ) {
                      return fullPath;
                    }
                    if (boxTree[key]?.children) {
                      const found = findSent(boxTree[key].children, fullPath);
                      if (found) return found;
                    }
                  }
                  return null;
                };
                sentBox = findSent(boxes) || "Sent";
              }

              imap.append(
                rawBuffer,
                { mailbox: sentBox, flags: ["\\Seen"], date: new Date() },
                (appendErr) => {
                  clearTimeout(timer);
                  if (appendErr) {
                    this.logger.warn(`IMAP append error for ${connection.id}: ${appendErr.message}`);
                    finish(false);
                  } else {
                    this.logger.log(`Appended sent email to platform "${sentBox}" folder for ${connection.id}`);
                    finish(true);
                  }
                },
              );
            });
          });

          imap.once("error", (err) => {
            clearTimeout(timer);
            this.logger.warn(`IMAP append connection error: ${err.message}`);
            finish(false);
          });

          imap.connect();
        } catch (err) {
          clearTimeout(timer);
          this.logger.warn(`Failed to connect IMAP for append: ${err}`);
          finish(false);
        }
      });
    } catch (err) {
      this.logger.warn(`Failed compiling RFC822 email for append: ${err}`);
      return false;
    }
  }
}

function extractAddress(headerValue: string): string {
  const match = /<([^>]+)>/.exec(headerValue);
  return (match ? match[1] : headerValue).trim();
}

function extractAddresses(headerValue: string): string[] {
  if (!headerValue) return [];
  return headerValue
    .split(",")
    .map((part) => extractAddress(part))
    .filter(Boolean);
}

function safeJsonParse(value: string): MicrosoftCursor {
  try {
    return JSON.parse(value) as MicrosoftCursor;
  } catch {
    return {};
  }
}
