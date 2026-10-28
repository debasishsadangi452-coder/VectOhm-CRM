import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { LinkedInActionStatus, LinkedInActionType, LinkedInConnectionStatus, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { UnipileService } from "./unipile.service";
import type { RequestUser } from "../../common/types/request-user.type";
import { ConnectLinkedInDto } from "./dto/connect-linkedin.dto";
import { UpdateLinkedInLimitsDto } from "./dto/update-linkedin-limits.dto";
import { SendLinkedInInviteDto } from "./dto/send-linkedin-invite.dto";
import { SendLinkedInMessageDto } from "./dto/send-linkedin-message.dto";

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeExternalUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

@Injectable()
export class LinkedInConnectionService {
  private readonly logger = new Logger(LinkedInConnectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly unipile: UnipileService,
  ) {}

  async getStatus(user: RequestUser) {
    let conn = await this.prisma.userLinkedInConnection.findUnique({
      where: { userId: user.id },
    });

    const today = getTodayKey();

    // Auto-provision from the company Unipile account, for Admins only. It is one shared
    // LinkedIn account, so ordinary users must not be silently attached to it.
    if (!conn && user.role.name === RoleName.ADMIN && this.unipile.isConfigured()) {
      try {
        const unipileAccount = await this.unipile.getConnectedAccount();
        if (unipileAccount && unipileAccount.status === "OK") {
          const profile = unipileAccount.publicIdentifier
            ? await this.unipile.resolveProfile(unipileAccount.publicIdentifier, unipileAccount.id)
            : null;

          conn = await this.prisma.userLinkedInConnection.create({
            data: {
              userId: user.id,
              accountEmail: unipileAccount.email || profile?.email || user.email,
              accountName: unipileAccount.name || (profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : null),
              profileUrl: unipileAccount.publicIdentifier
                ? `https://www.linkedin.com/in/${unipileAccount.publicIdentifier}`
                : null,
              profilePicUrl: profile?.profile_pic_url || null,
              profileUrn: unipileAccount.id,
              // The Unipile key stays in the server env; never copy it into the database.
              accessToken: null,
              status: LinkedInConnectionStatus.CONNECTED,
              dailyInviteLimit: 20,
              dailyMessageLimit: 50,
              invitesSentToday: 0,
              messagesSentToday: 0,
              lastResetDate: today,
              lastSyncAt: new Date(),
            },
          });
          this.logger.log(`Auto-provisioned LinkedIn connection for user ${user.id} via Unipile account: ${unipileAccount.name}`);
        }
      } catch (err: any) {
        this.logger.warn(`Could not auto-provision from Unipile: ${err.message}`);
      }
    }

    if (!conn) {
      return {
        connected: false,
        status: LinkedInConnectionStatus.DISCONNECTED,
        connection: null,
      };
    }

    // Check daily usage rollover
    if (conn.lastResetDate !== today) {
      const refreshed = await this.prisma.userLinkedInConnection.update({
        where: { id: conn.id },
        data: {
          invitesSentToday: 0,
          messagesSentToday: 0,
          lastResetDate: today,
        },
      });
      return this.formatConnectionResponse(refreshed);
    }

    return this.formatConnectionResponse(conn);
  }

  async connect(user: RequestUser, dto: ConnectLinkedInDto) {
    const today = getTodayKey();

    let accountName = dto.accountName?.trim() || null;
    let profilePicUrl = dto.profilePicUrl?.trim() || null;
    let profileUrn = dto.profileUrn?.trim() || null;

    // Enrich from Unipile if publicIdentifier or profile URL is provided
    if (dto.profileUrl && this.unipile.isConfigured()) {
      try {
        const profile = await this.unipile.resolveProfile(dto.profileUrl);
        if (profile) {
          if (!accountName && (profile.first_name || profile.last_name)) {
            accountName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim();
          }
          if (!profilePicUrl && profile.profile_pic_url) {
            profilePicUrl = profile.profile_pic_url;
          }
          if (!profileUrn && profile.member_urn) {
            profileUrn = profile.member_urn;
          }
        }
      } catch (e: any) {
        this.logger.debug(`Could not enrich profile during connect: ${e.message}`);
      }
    }

    const conn = await this.prisma.userLinkedInConnection.upsert({
      where: { userId: user.id },
      update: {
        accountEmail: dto.accountEmail.trim().toLowerCase(),
        accountName,
        profileUrl: normalizeExternalUrl(dto.profileUrl),
        profilePicUrl,
        profileUrn,
        accessToken: dto.accessToken?.trim() || null,
        status: LinkedInConnectionStatus.CONNECTED,
        dailyInviteLimit: dto.dailyInviteLimit ?? 20,
        dailyMessageLimit: dto.dailyMessageLimit ?? 50,
        lastResetDate: today,
        lastSyncAt: new Date(),
      },
      create: {
        userId: user.id,
        accountEmail: dto.accountEmail.trim().toLowerCase(),
        accountName,
        profileUrl: normalizeExternalUrl(dto.profileUrl),
        profilePicUrl,
        profileUrn,
        accessToken: dto.accessToken?.trim() || null,
        status: LinkedInConnectionStatus.CONNECTED,
        dailyInviteLimit: dto.dailyInviteLimit ?? 20,
        dailyMessageLimit: dto.dailyMessageLimit ?? 50,
        invitesSentToday: 0,
        messagesSentToday: 0,
        lastResetDate: today,
        lastSyncAt: new Date(),
      },
    });

    this.logger.log(`User ${user.id} (${user.email}) connected LinkedIn account: ${conn.accountEmail}`);
    return this.formatConnectionResponse(conn);
  }

  async disconnect(user: RequestUser) {
    const conn = await this.prisma.userLinkedInConnection.findUnique({
      where: { userId: user.id },
    });

    if (!conn) {
      return { success: true, message: "No LinkedIn account was connected." };
    }

    await this.prisma.userLinkedInConnection.delete({
      where: { id: conn.id },
    });

    this.logger.log(`User ${user.id} disconnected LinkedIn account`);
    return { success: true, message: "LinkedIn account disconnected successfully." };
  }

  async test(user: RequestUser) {
    const conn = await this.prisma.userLinkedInConnection.findUnique({
      where: { userId: user.id },
    });

    if (!conn) {
      throw new NotFoundException("No connected LinkedIn account found.");
    }

    let valid = true;
    let message = `LinkedIn account (${conn.accountEmail}) is active and connected.`;

    if (this.unipile.isConfigured()) {
      const unipileAccount = await this.unipile.getConnectedAccount(conn.profileUrn || undefined);
      if (unipileAccount && unipileAccount.status === "OK") {
        message = `LinkedIn account (${unipileAccount.name || conn.accountEmail}) is active and verified via Unipile Engine.`;
        valid = true;
      } else if (unipileAccount && unipileAccount.status !== "OK") {
        valid = false;
        message = "Unipile reported an authentication warning on LinkedIn. Please check your account.";
      }
    } else if (conn.accessToken) {
      const token = conn.accessToken.trim();
      if (token.length < 10) {
        valid = false;
        message = "Session token appears too short or invalid.";
      } else {
        message = `LinkedIn account (${conn.accountEmail}) verified with active session.`;
      }
    }

    const updated = await this.prisma.userLinkedInConnection.update({
      where: { id: conn.id },
      data: {
        lastSyncAt: new Date(),
        status: valid ? LinkedInConnectionStatus.CONNECTED : LinkedInConnectionStatus.CHECKPOINT_REQUIRED,
      },
    });

    return {
      success: valid,
      message,
      ...this.formatConnectionResponse(updated),
    };
  }

  async updateLimits(user: RequestUser, dto: UpdateLinkedInLimitsDto) {
    const conn = await this.prisma.userLinkedInConnection.findUnique({
      where: { userId: user.id },
    });

    if (!conn) {
      throw new NotFoundException("No connected LinkedIn account found for your profile.");
    }

    const updated = await this.prisma.userLinkedInConnection.update({
      where: { id: conn.id },
      data: {
        ...(dto.dailyInviteLimit !== undefined && { dailyInviteLimit: dto.dailyInviteLimit }),
        ...(dto.dailyMessageLimit !== undefined && { dailyMessageLimit: dto.dailyMessageLimit }),
      },
    });

    return this.formatConnectionResponse(updated);
  }

  /**
   * Atomically takes one unit of today's invite/message quota. The limit check and the
   * increment are one statement, so concurrent requests cannot overshoot the daily limit.
   */
  private async reserveQuota(
    conn: { id: string; dailyInviteLimit: number; dailyMessageLimit: number; lastResetDate: string },
    kind: "invite" | "message",
  ) {
    const today = getTodayKey();
    if (conn.lastResetDate !== today) {
      await this.prisma.userLinkedInConnection.updateMany({
        where: { id: conn.id, lastResetDate: { not: today } },
        data: { invitesSentToday: 0, messagesSentToday: 0, lastResetDate: today },
      });
    }
    const field = kind === "invite" ? "invitesSentToday" : "messagesSentToday";
    const limit = kind === "invite" ? conn.dailyInviteLimit : conn.dailyMessageLimit;
    const { count } = await this.prisma.userLinkedInConnection.updateMany({
      where: { id: conn.id, [field]: { lt: limit } },
      data: { [field]: { increment: 1 } },
    });
    if (count === 0) {
      throw new BadRequestException(
        `Daily LinkedIn ${kind === "invite" ? "invitation" : "message"} limit reached (${limit}). It resets tomorrow to protect your account.`,
      );
    }
  }

  private async releaseQuota(connectionId: string, kind: "invite" | "message") {
    const field = kind === "invite" ? "invitesSentToday" : "messagesSentToday";
    await this.prisma.userLinkedInConnection.updateMany({
      where: { id: connectionId, [field]: { gt: 0 } },
      data: { [field]: { decrement: 1 } },
    });
  }

  /**
   * 1-Click Send Connection Request / Invite to a Lead or Candidate via Unipile.
   */
  async sendInvite(user: RequestUser, dto: SendLinkedInInviteDto) {
    const conn = await this.prisma.userLinkedInConnection.findUnique({
      where: { userId: user.id },
    });

    if (!conn || conn.status !== LinkedInConnectionStatus.CONNECTED) {
      throw new BadRequestException("You must connect your LinkedIn account first in Settings -> Account.");
    }

    const apiKey = conn.accessToken || this.unipile.getApiKey();
    const accountId = conn.profileUrn || this.unipile.getDefaultAccountId();

    if (!this.unipile.isConfigured(apiKey)) {
      throw new BadRequestException("Unipile engine is not configured in backend environment.");
    }

    await this.reserveQuota(conn, "invite");
    let res: Awaited<ReturnType<UnipileService["sendInvitation"]>>;
    try {
      res = await this.unipile.sendInvitation({
        targetUrlOrIdentifier: dto.targetUrl,
        message: dto.message,
        accountId,
        apiKey,
      });
    } catch (err) {
      await this.releaseQuota(conn.id, "invite");
      throw err;
    }

    if (!res.success) {
      await this.releaseQuota(conn.id, "invite");
      // Record failed action
      await this.prisma.linkedInAction.create({
        data: {
          connectionId: conn.id,
          targetUrl: dto.targetUrl,
          messageBody: dto.message || null,
          actionType: LinkedInActionType.CONNECTION_REQUEST,
          status: LinkedInActionStatus.FAILED,
          errorMessage: res.error || "Failed sending invitation",
          leadId: dto.leadId || null,
          candidateId: dto.candidateId || null,
          contactId: dto.contactId || null,
          executedAt: new Date(),
        },
      });

      throw new BadRequestException(res.error || "Failed to send LinkedIn connection request.");
    }

    // Record successful action and increment daily quota
    const action = await this.prisma.linkedInAction.create({
      data: {
        connectionId: conn.id,
        targetUrl: dto.targetUrl,
        messageBody: dto.message || null,
        actionType: LinkedInActionType.CONNECTION_REQUEST,
        status: LinkedInActionStatus.SENT,
        leadId: dto.leadId || null,
        candidateId: dto.candidateId || null,
        contactId: dto.contactId || null,
        executedAt: new Date(),
      },
    });

    const updatedConn = await this.prisma.userLinkedInConnection.update({
      where: { id: conn.id },
      data: {
        lastSyncAt: new Date(),
      },
    });

    return {
      success: true,
      message: `Connection request sent successfully to ${res.recipientName || "recipient"}!`,
      actionId: action.id,
      invitesSentToday: updatedConn.invitesSentToday,
      remainingInvites: Math.max(0, updatedConn.dailyInviteLimit - updatedConn.invitesSentToday),
    };
  }

  /**
   * 1-Click Send Direct Message to a LinkedIn Connection / Lead via Unipile.
   */
  async sendMessage(user: RequestUser, dto: SendLinkedInMessageDto) {
    const conn = await this.prisma.userLinkedInConnection.findUnique({
      where: { userId: user.id },
    });

    if (!conn || conn.status !== LinkedInConnectionStatus.CONNECTED) {
      throw new BadRequestException("You must connect your LinkedIn account first in Settings -> Account.");
    }

    const apiKey = conn.accessToken || this.unipile.getApiKey();
    const accountId = conn.profileUrn || this.unipile.getDefaultAccountId();

    if (!this.unipile.isConfigured(apiKey)) {
      throw new BadRequestException("Unipile engine is not configured in backend environment.");
    }

    await this.reserveQuota(conn, "message");
    let res: Awaited<ReturnType<UnipileService["sendMessage"]>>;
    try {
      res = await this.unipile.sendMessage({
        targetUrlOrIdentifier: dto.targetUrl,
        text: dto.message,
        accountId,
        apiKey,
      });
    } catch (err) {
      await this.releaseQuota(conn.id, "message");
      throw err;
    }

    if (!res.success) {
      await this.releaseQuota(conn.id, "message");
      await this.prisma.linkedInAction.create({
        data: {
          connectionId: conn.id,
          targetUrl: dto.targetUrl,
          messageBody: dto.message,
          actionType: LinkedInActionType.DIRECT_MESSAGE,
          status: LinkedInActionStatus.FAILED,
          errorMessage: res.error || "Failed sending message",
          leadId: dto.leadId || null,
          candidateId: dto.candidateId || null,
          contactId: dto.contactId || null,
          executedAt: new Date(),
        },
      });

      throw new BadRequestException(res.error || "Failed to send LinkedIn direct message.");
    }

    // Record action and message
    const action = await this.prisma.linkedInAction.create({
      data: {
        connectionId: conn.id,
        targetUrl: dto.targetUrl,
        messageBody: dto.message,
        actionType: LinkedInActionType.DIRECT_MESSAGE,
        status: LinkedInActionStatus.SENT,
        leadId: dto.leadId || null,
        candidateId: dto.candidateId || null,
        contactId: dto.contactId || null,
        executedAt: new Date(),
      },
    });

    await this.prisma.linkedInMessage.create({
      data: {
        connectionId: conn.id,
        conversationId: res.chatId || `local-${action.id}`,
        senderUrn: conn.profileUrn || "urn:li:user",
        senderName: conn.accountName || user.firstName || "Me",
        senderPicUrl: conn.profilePicUrl,
        recipientUrn: res.recipientId || dto.targetUrl,
        content: dto.message,
        sentAt: new Date(),
        isOutbound: true,
        read: true,
        candidateId: dto.candidateId || null,
        contactId: dto.contactId || null,
      },
    });

    const updatedConn = await this.prisma.userLinkedInConnection.update({
      where: { id: conn.id },
      data: {
        lastSyncAt: new Date(),
      },
    });

    return {
      success: true,
      message: `Message sent successfully to ${res.recipientName || "recipient"}!`,
      chatId: res.chatId,
      actionId: action.id,
      messagesSentToday: updatedConn.messagesSentToday,
      remainingMessages: Math.max(0, updatedConn.dailyMessageLimit - updatedConn.messagesSentToday),
    };
  }

  /**
   * Fetches recent automated actions for the current user's connection.
   */
  async getRecentActions(user: RequestUser, limit = 20) {
    const conn = await this.prisma.userLinkedInConnection.findUnique({
      where: { userId: user.id },
    });

    if (!conn) return [];

    return this.prisma.linkedInAction.findMany({
      where: { connectionId: conn.id },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  /**
   * Fetches recent LinkedIn chats via Unipile.
   */
  async getChats(user: RequestUser, limit = 20) {
    const conn = await this.prisma.userLinkedInConnection.findUnique({
      where: { userId: user.id },
    });

    if (!conn || !this.unipile.isConfigured()) return [];

    return this.unipile.getChats(conn.profileUrn || undefined, limit, conn.accessToken || undefined);
  }

  private formatConnectionResponse(conn: {
    id: string;
    accountEmail: string;
    accountName: string | null;
    profileUrl: string | null;
    profilePicUrl: string | null;
    profileUrn: string | null;
    status: LinkedInConnectionStatus;
    dailyInviteLimit: number;
    dailyMessageLimit: number;
    invitesSentToday: number;
    messagesSentToday: number;
    lastResetDate: string;
    lastSyncAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      connected: conn.status === LinkedInConnectionStatus.CONNECTED,
      status: conn.status,
      connection: {
        id: conn.id,
        accountEmail: conn.accountEmail,
        accountName: conn.accountName,
        profileUrl: conn.profileUrl,
        profilePicUrl: conn.profilePicUrl,
        profileUrn: conn.profileUrn,
        dailyInviteLimit: conn.dailyInviteLimit,
        dailyMessageLimit: conn.dailyMessageLimit,
        invitesSentToday: conn.invitesSentToday,
        messagesSentToday: conn.messagesSentToday,
        remainingInvitesToday: Math.max(0, conn.dailyInviteLimit - conn.invitesSentToday),
        remainingMessagesToday: Math.max(0, conn.dailyMessageLimit - conn.messagesSentToday),
        lastSyncAt: conn.lastSyncAt,
        createdAt: conn.createdAt,
      },
    };
  }
}
