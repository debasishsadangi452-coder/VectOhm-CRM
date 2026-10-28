import { Injectable } from "@nestjs/common";
import { NotificationType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsGateway } from "./notifications.gateway";

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  /** Create a notification for a specific user. Called by other services. */
  async create(input: CreateNotificationInput) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link,
      },
    });
    // Every notification in the app now pushes live -- a single
    // integration point rather than wiring each of the ~15 call sites
    // (LeaveRequests, Tasks, Bugs, Engagement, ...) individually. The
    // notification bell's existing 30s poll (use-notifications.ts) stays as
    // the fallback if a socket is disconnected.
    this.gateway.emitToUser(input.userId, "notification", notification);
    return notification;
  }

  /**
   * Create the same notification for every user in a department -- e.g.
   * broadcasting a CompanyGrowthSignal to the whole Sales team rather than
   * a single owner. Loops the existing single-user create() rather than a
   * bulk insert, so every recipient still gets the same DB-row-plus-live-
   * socket-push behavior (including per-user gateway delivery) that every
   * other call site already relies on.
   */
  async notifyDepartment(departmentName: string, input: Omit<CreateNotificationInput, "userId">) {
    const users = await this.prisma.user.findMany({
      where: { department: { name: departmentName } },
      select: { id: true },
    });
    return Promise.all(users.map((u) => this.create({ ...input, userId: u.id })));
  }

  /** List all notifications for the requesting user, newest first. */
  findAllForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  /** Count unread notifications for the requesting user. */
  countUnread(userId: string) {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  /** Mark a single notification as read. Silently ignores wrong owner. */
  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  /** Mark ALL unread notifications for a user as read. */
  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  /** Mark unread notifications for a specific panel/link as read. */
  async markReadByLink(linkPrefix: string, userId: string) {
    if (!linkPrefix) return { count: 0 };

    const unread = await this.prisma.notification.findMany({
      where: {
        userId,
        isRead: false,
      },
      select: { id: true, link: true },
    });

    const matchingIds = unread
      .filter((n) => n.link && (n.link === linkPrefix || n.link.startsWith(linkPrefix) || linkPrefix.startsWith(n.link)))
      .map((n) => n.id);

    if (matchingIds.length === 0) {
      return { count: 0 };
    }

    const result = await this.prisma.notification.updateMany({
      where: {
        id: { in: matchingIds },
        userId,
      },
      data: { isRead: true },
    });

    this.gateway.emitToUser(userId, "notifications_read", { linkPrefix, ids: matchingIds });
    return result;
  }
}
