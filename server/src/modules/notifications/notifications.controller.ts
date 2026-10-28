import { Body, Controller, Get, Param, Patch } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.notificationsService.findAllForUser(user.id);
  }

  @Get("unread-count")
  unreadCount(@CurrentUser() user: RequestUser) {
    return this.notificationsService.countUnread(user.id).then((count) => ({ count }));
  }

  @Patch("read-all")
  markAllRead(@CurrentUser() user: RequestUser) {
    return this.notificationsService.markAllRead(user.id);
  }

  @Patch("read-by-link")
  markReadByLink(@Body("linkPrefix") linkPrefix: string, @CurrentUser() user: RequestUser) {
    return this.notificationsService.markReadByLink(linkPrefix || "", user.id);
  }

  @Patch(":id/read")
  markRead(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.notificationsService.markRead(id, user.id);
  }
}
