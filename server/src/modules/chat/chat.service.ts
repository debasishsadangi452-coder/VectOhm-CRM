import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { NotificationType, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateChannelDto } from "./dto/create-channel.dto";
import { CreateGroupDto } from "./dto/create-group.dto";
import { UpdateGroupDto } from "./dto/update-group.dto";
import type { RequestUser } from "../../common/types/request-user.type";
import { NotificationsService } from "../notifications/notifications.service";

const personSelect = { id: true, firstName: true, lastName: true, avatarUrl: true } as const;

const channelInclude = {
  department: { select: { id: true, name: true } },
  dmUser1: { select: personSelect },
  dmUser2: { select: personSelect },
  // Only groups have members; for other channels this is an empty list.
  members: {
    select: { userId: true, isAdmin: true, joinedAt: true, user: { select: personSelect } },
    orderBy: { joinedAt: "asc" },
  },
} as const;

const messageInclude = {
  sender: { select: personSelect },
} as const;

const MAX_MESSAGES = 200;

const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`.trim();

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // Every chat this person can see: public/department channels, their DMs and the groups they belong to.
  private accessibleChannels(user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const departmentId = user.department?.id;

    return this.prisma.chatChannel.findMany({
      where: {
        OR: [
          {
            isDM: false,
            isGroup: false,
            OR: [
              { departmentId: null },
              ...(departmentId ? [{ departmentId }] : []),
              ...(isAdmin ? [{}] : []), // Admin sees all department channels (never private groups)
            ],
          },
          { isDM: true, OR: [{ dmUserId1: user.id }, { dmUserId2: user.id }] },
          { isGroup: true, members: { some: { userId: user.id } } },
        ],
      },
      include: channelInclude,
      orderBy: { updatedAt: "desc" },
    });
  }

  // The list the chat page shows: each chat with its latest message and this person's unread count.
  async findAllChannels(user: RequestUser) {
    const channels = await this.accessibleChannels(user);
    if (channels.length === 0) return [];

    const reads = await this.prisma.chatChannelRead.findMany({
      where: { userId: user.id, channelId: { in: channels.map((c) => c.id) } },
    });
    const lastReadByChannel = new Map(reads.map((r) => [r.channelId, r.lastReadAt]));

    return Promise.all(
      channels.map(async (channel) => {
        const [lastMessage, unreadCount] = await Promise.all([
          this.prisma.chatMessage.findFirst({
            where: { channelId: channel.id },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              content: true,
              createdAt: true,
              senderId: true,
              isSystem: true,
              sender: { select: personSelect },
            },
          }),
          this.prisma.chatMessage.count({
            where: {
              channelId: channel.id,
              senderId: { not: user.id },
              createdAt: { gt: lastReadByChannel.get(channel.id) ?? channel.createdAt },
            },
          }),
        ]);
        return { ...channel, lastMessage, unreadCount };
      }),
    );
  }

  async createChannel(dto: CreateChannelDto, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;

    // If locked to a department, verify user is in that department or is admin
    if (dto.departmentId) {
      const isDeptMember = user.department?.id === dto.departmentId;
      if (!isAdmin && !isDeptMember) {
        throw new ForbiddenException("You cannot create a channel for another department");
      }
    }

    return this.prisma.chatChannel.create({
      data: {
        name: dto.name,
        description: dto.description,
        isDM: false,
        departmentId: dto.departmentId ?? null,
      },
      include: channelInclude,
    });
  }

  async getOrCreateDM(recipientId: string, user: RequestUser) {
    if (recipientId === user.id) {
      throw new ForbiddenException("You cannot start a direct message with yourself");
    }

    // Assert recipient exists
    const recipient = await this.prisma.user.findUnique({ where: { id: recipientId } });
    if (!recipient) {
      throw new NotFoundException("Recipient user not found");
    }

    // Order IDs lexicographically for uniqueness
    const u1 = user.id < recipientId ? user.id : recipientId;
    const u2 = user.id < recipientId ? recipientId : user.id;

    let channel = await this.prisma.chatChannel.findUnique({
      where: {
        dmUserId1_dmUserId2: {
          dmUserId1: u1,
          dmUserId2: u2,
        },
      },
      include: channelInclude,
    });

    if (!channel) {
      channel = await this.prisma.chatChannel.create({
        data: {
          isDM: true,
          dmUserId1: u1,
          dmUserId2: u2,
        },
        include: channelInclude,
      });
    }

    return channel;
  }

  // ─── groups ────────────────────────────────────────────────────────────────

  /** A private group with any people the creator picks. The creator becomes its first group admin. */
  async createGroup(dto: CreateGroupDto, user: RequestUser) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException("Give the group a name.");

    const memberIds = Array.from(new Set(dto.memberIds)).filter((id) => id !== user.id);
    if (memberIds.length === 0) throw new BadRequestException("Pick at least one other person for the group.");

    const people = await this.activeUsers(memberIds);

    const channel = await this.prisma.chatChannel.create({
      data: {
        name,
        description: dto.description?.trim() || null,
        isDM: false,
        isGroup: true,
        createdById: user.id,
        members: {
          create: [{ userId: user.id, isAdmin: true }, ...people.map((p) => ({ userId: p.id, isAdmin: false }))],
        },
      },
      include: channelInclude,
    });

    await this.systemMessage(channel.id, user.id, `${fullName(user)} created the group "${name}"`);
    await this.notify(
      people.map((p) => p.id),
      `Added to "${name}"`,
      `${fullName(user)} added you to a group`,
    );
    return channel;
  }

  async updateGroup(channelId: string, dto: UpdateGroupDto, user: RequestUser) {
    const group = await this.getGroupAsAdmin(channelId, user);
    const name = dto.name?.trim();
    const description = dto.description?.trim();
    if (dto.name !== undefined && !name) throw new BadRequestException("The group name can't be empty.");

    const updated = await this.prisma.chatChannel.update({
      where: { id: channelId },
      data: {
        ...(name ? { name } : {}),
        ...(dto.description !== undefined ? { description: description || null } : {}),
      },
      include: channelInclude,
    });
    if (name && name !== group.name) {
      await this.systemMessage(channelId, user.id, `${fullName(user)} renamed the group to "${name}"`);
    }
    return updated;
  }

  async addGroupMembers(channelId: string, userIds: string[], user: RequestUser) {
    const group = await this.getGroupAsAdmin(channelId, user);
    const existing = new Set(group.members.map((m) => m.userId));
    const toAdd = Array.from(new Set(userIds)).filter((id) => !existing.has(id));
    if (toAdd.length === 0) throw new BadRequestException("Everyone you picked is already in the group.");

    const people = await this.activeUsers(toAdd);
    await this.prisma.chatChannelMember.createMany({
      data: people.map((p) => ({ channelId, userId: p.id, isAdmin: false })),
      skipDuplicates: true,
    });
    await this.systemMessage(channelId, user.id, `${fullName(user)} added ${people.map(fullName).join(", ")}`);
    await this.notify(
      people.map((p) => p.id),
      `Added to "${group.name}"`,
      `${fullName(user)} added you to a group`,
    );
    return this.prisma.chatChannel.findUniqueOrThrow({ where: { id: channelId }, include: channelInclude });
  }

  /**
   * Takes someone out of a group. Anyone can remove themselves (leave); removing another person
   * needs a group admin. If the last admin leaves, the longest-standing member becomes admin, and
   * an empty group is deleted.
   */
  async removeGroupMember(channelId: string, targetUserId: string, user: RequestUser) {
    const group = await this.getGroup(channelId);
    const me = group.members.find((m) => m.userId === user.id);
    if (!me) throw new ForbiddenException("You are not in this group.");
    const leaving = targetUserId === user.id;
    if (!leaving && !me.isAdmin) throw new ForbiddenException("Only a group admin can remove people.");

    const target = group.members.find((m) => m.userId === targetUserId);
    if (!target) throw new NotFoundException("That person is not in this group.");

    await this.prisma.chatChannelMember.delete({
      where: { channelId_userId: { channelId, userId: targetUserId } },
    });

    const remaining = group.members.filter((m) => m.userId !== targetUserId);
    if (remaining.length === 0) {
      await this.prisma.chatChannel.delete({ where: { id: channelId } });
      return { deleted: true };
    }
    if (target.isAdmin && !remaining.some((m) => m.isAdmin)) {
      await this.prisma.chatChannelMember.update({
        where: { channelId_userId: { channelId, userId: remaining[0].userId } },
        data: { isAdmin: true },
      });
    }

    const line = leaving
      ? `${fullName(user)} left`
      : `${fullName(user)} removed ${fullName(target.user)}`;
    await this.systemMessage(channelId, user.id, line);
    if (!leaving) {
      await this.notify([targetUserId], `Removed from "${group.name}"`, `${fullName(user)} removed you from the group`);
    }
    return { deleted: false };
  }

  private async getGroup(channelId: string) {
    const group = await this.prisma.chatChannel.findUnique({
      where: { id: channelId },
      include: { members: { include: { user: { select: personSelect } }, orderBy: { joinedAt: "asc" } } },
    });
    if (!group || !group.isGroup) throw new NotFoundException("Group not found");
    return group;
  }

  private async getGroupAsAdmin(channelId: string, user: RequestUser) {
    const group = await this.getGroup(channelId);
    const me = group.members.find((m) => m.userId === user.id);
    if (!me) throw new ForbiddenException("You are not in this group.");
    if (!me.isAdmin) throw new ForbiddenException("Only a group admin can do that.");
    return group;
  }

  private async activeUsers(ids: string[]) {
    const people = await this.prisma.user.findMany({
      where: { id: { in: ids }, isActive: true },
      select: personSelect,
    });
    if (people.length !== ids.length) {
      throw new BadRequestException("Some of the people you picked could not be found or are inactive.");
    }
    return people;
  }

  private systemMessage(channelId: string, actorId: string, content: string) {
    return this.prisma.chatMessage.create({
      data: { channelId, senderId: actorId, content, isSystem: true },
    });
  }

  private async notify(userIds: string[], title: string, message: string) {
    for (const userId of userIds) {
      await this.notifications
        .create({ userId, type: NotificationType.GENERAL, title, message, link: "/chat" })
        .catch(() => null);
    }
  }

  // ─── unread / read ─────────────────────────────────────────────────────────

  // Real-data backing for the sidebar's Team Chat badge: for every chat the user can access, count
  // messages from OTHERS created after their last-read marker for that chat (or the chat's own
  // createdAt if they've never read it), then sum.
  async getUnreadCount(user: RequestUser): Promise<number> {
    const channels = await this.accessibleChannels(user);
    if (channels.length === 0) return 0;

    const reads = await this.prisma.chatChannelRead.findMany({
      where: { userId: user.id, channelId: { in: channels.map((c) => c.id) } },
    });
    const lastReadByChannel = new Map(reads.map((r) => [r.channelId, r.lastReadAt]));

    const counts = await Promise.all(
      channels.map((channel) =>
        this.prisma.chatMessage.count({
          where: {
            channelId: channel.id,
            senderId: { not: user.id },
            createdAt: { gt: lastReadByChannel.get(channel.id) ?? channel.createdAt },
          },
        }),
      ),
    );
    return counts.reduce((sum, n) => sum + n, 0);
  }

  // Called when the user opens/views a channel -- marks everything up to
  // now as read for them.
  async markChannelRead(channelId: string, user: RequestUser): Promise<void> {
    const channel = await this.prisma.chatChannel.findUnique({ where: { id: channelId } });
    if (!channel) {
      throw new NotFoundException("Channel not found");
    }
    await this.assertCanAccess(channel, user);

    await this.prisma.chatChannelRead.upsert({
      where: { userId_channelId: { userId: user.id, channelId } },
      create: { userId: user.id, channelId, lastReadAt: new Date() },
      update: { lastReadAt: new Date() },
    });
  }

  // ─── messages ──────────────────────────────────────────────────────────────

  async findMessages(channelId: string, user: RequestUser, q?: string) {
    const channel = await this.prisma.chatChannel.findUnique({ where: { id: channelId } });
    if (!channel) {
      throw new NotFoundException("Channel not found");
    }

    await this.assertCanAccess(channel, user);

    const where: any = { channelId };
    if (q) {
      where.content = { contains: q, mode: "insensitive" };
    }

    // The most recent messages, shown oldest-first (newest at the bottom, like any chat app).
    const latest = await this.prisma.chatMessage.findMany({
      where,
      include: messageInclude,
      orderBy: { createdAt: "desc" },
      take: MAX_MESSAGES,
    });
    return latest.reverse();
  }

  async togglePinMessage(messageId: string, user: RequestUser) {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: { channel: true },
    });
    if (!message) {
      throw new NotFoundException("Message not found");
    }

    await this.assertCanAccess(message.channel, user);

    const pinnedAt = message.pinnedAt ? null : new Date();

    return this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { pinnedAt },
      include: messageInclude,
    });
  }

  async sendMessage(channelId: string, content: string, user: RequestUser, mentionIds: string[] = []) {
    const channel = await this.prisma.chatChannel.findUnique({ where: { id: channelId } });
    if (!channel) {
      throw new NotFoundException("Channel not found");
    }

    await this.assertCanAccess(channel, user);

    const message = await this.prisma.chatMessage.create({
      data: {
        content,
        channelId,
        senderId: user.id,
      },
      include: messageInclude,
    });

    // Touch the channel to update its updatedAt timestamp (helps list ordering)
    await this.prisma.chatChannel.update({
      where: { id: channelId },
      data: { updatedAt: new Date() },
    });

    // Auto mark sender as read
    await this.prisma.chatChannelRead.upsert({
      where: { userId_channelId: { userId: user.id, channelId } },
      create: { userId: user.id, channelId, lastReadAt: new Date() },
      update: { lastReadAt: new Date() },
    }).catch(() => null);

    // Send notifications to recipients
    try {
      const previewText = content.length > 80 ? content.slice(0, 80) + "..." : content;
      const sender = `${user.firstName} ${user.lastName}`;
      // Only people who can actually see this chat can be mentioned.
      const mentioned = new Set(mentionIds);
      const place = channel.isDM ? "" : channel.isGroup ? channel.name || "Group" : `#${channel.name || "Chat"}`;
      const send = async (recipientId: string, normalTitle: string) => {
        const isMention = mentioned.has(recipientId);
        await this.notifications.create({
          userId: recipientId,
          type: NotificationType.GENERAL,
          title: isMention
            ? `${sender} mentioned you${place ? ` in ${place}` : ""}`
            : normalTitle,
          message: previewText,
          link: "/chat",
        });
      };

      if (channel.isDM) {
        const recipientId = channel.dmUserId1 === user.id ? channel.dmUserId2 : channel.dmUserId1;
        if (recipientId) await send(recipientId, `Message from ${sender}`);
      } else if (channel.isGroup) {
        const members = await this.prisma.chatChannelMember.findMany({
          where: { channelId, userId: { not: user.id } },
          select: { userId: true },
        });
        for (const member of members) await send(member.userId, `${place} · ${sender}`);
      } else {
        const members = await this.prisma.user.findMany({
          where: {
            isActive: true,
            id: { not: user.id },
            ...(channel.departmentId ? { departmentId: channel.departmentId } : {}),
          },
          select: { id: true },
        });
        for (const member of members) await send(member.id, `${place} · ${sender}`);
      }
    } catch (err) {
      console.error("Failed to push chat notification:", err);
    }

    return message;
  }

  private async assertCanAccess(
    channel: {
      id: string;
      isDM: boolean;
      isGroup: boolean;
      departmentId: string | null;
      dmUserId1: string | null;
      dmUserId2: string | null;
    },
    user: RequestUser,
  ) {
    const isAdmin = user.role.name === RoleName.ADMIN;

    if (channel.isDM) {
      const isParticipant = channel.dmUserId1 === user.id || channel.dmUserId2 === user.id;
      if (!isParticipant) {
        throw new ForbiddenException("You do not have access to this direct message thread");
      }
    } else if (channel.isGroup) {
      // Private groups are for their members only, Admins included.
      const membership = await this.prisma.chatChannelMember.findUnique({
        where: { channelId_userId: { channelId: channel.id, userId: user.id } },
      });
      if (!membership) {
        throw new ForbiddenException("You are not a member of this group");
      }
    } else {
      if (channel.departmentId) {
        const isDeptMember = user.department?.id === channel.departmentId;
        if (!isAdmin && !isDeptMember) {
          throw new ForbiddenException("You do not have access to this department channel");
        }
      }
    }
  }
}
