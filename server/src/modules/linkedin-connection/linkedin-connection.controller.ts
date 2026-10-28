import { Body, Controller, Delete, Get, Patch, Post, Query } from "@nestjs/common";
import { LinkedInConnectionService } from "./linkedin-connection.service";
import { ConnectLinkedInDto } from "./dto/connect-linkedin.dto";
import { UpdateLinkedInLimitsDto } from "./dto/update-linkedin-limits.dto";
import { SendLinkedInInviteDto } from "./dto/send-linkedin-invite.dto";
import { SendLinkedInMessageDto } from "./dto/send-linkedin-message.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("linkedin-connection")
export class LinkedInConnectionController {
  constructor(private readonly service: LinkedInConnectionService) {}

  @Get("me")
  getStatus(@CurrentUser() user: RequestUser) {
    return this.service.getStatus(user);
  }

  @Post("connect")
  connect(@Body() dto: ConnectLinkedInDto, @CurrentUser() user: RequestUser) {
    return this.service.connect(user, dto);
  }

  @Post("test")
  test(@CurrentUser() user: RequestUser) {
    return this.service.test(user);
  }

  @Delete("disconnect")
  disconnect(@CurrentUser() user: RequestUser) {
    return this.service.disconnect(user);
  }

  @Patch("limits")
  updateLimits(@Body() dto: UpdateLinkedInLimitsDto, @CurrentUser() user: RequestUser) {
    return this.service.updateLimits(user, dto);
  }

  @Post("invite")
  sendInvite(@Body() dto: SendLinkedInInviteDto, @CurrentUser() user: RequestUser) {
    return this.service.sendInvite(user, dto);
  }

  @Post("message")
  sendMessage(@Body() dto: SendLinkedInMessageDto, @CurrentUser() user: RequestUser) {
    return this.service.sendMessage(user, dto);
  }

  @Get("actions")
  getRecentActions(@CurrentUser() user: RequestUser, @Query("limit") limit?: string) {
    return this.service.getRecentActions(user, limit ? parseInt(limit, 10) : 20);
  }

  @Get("chats")
  getChats(@CurrentUser() user: RequestUser, @Query("limit") limit?: string) {
    return this.service.getChats(user, limit ? parseInt(limit, 10) : 20);
  }
}
