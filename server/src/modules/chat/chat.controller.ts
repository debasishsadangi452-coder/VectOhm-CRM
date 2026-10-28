import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ChatService } from "./chat.service";
import { CreateChannelDto } from "./dto/create-channel.dto";
import { SendMessageDto } from "./dto/send-message.dto";
import { GetOrCreateDmDto } from "./dto/get-or-create-dm.dto";
import { CreateGroupDto } from "./dto/create-group.dto";
import { AddGroupMembersDto } from "./dto/add-group-members.dto";
import { UpdateGroupDto } from "./dto/update-group.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("chat")
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get("channels")
  findAllChannels(@CurrentUser() user: RequestUser) {
    return this.chatService.findAllChannels(user);
  }

  @Get("unread-count")
  getUnreadCount(@CurrentUser() user: RequestUser) {
    return this.chatService.getUnreadCount(user).then((count) => ({ count }));
  }

  @Post("channels/:id/read")
  markChannelRead(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.chatService.markChannelRead(id, user);
  }

  @Post("channels")
  createChannel(@Body() dto: CreateChannelDto, @CurrentUser() user: RequestUser) {
    return this.chatService.createChannel(dto, user);
  }

  @Post("groups")
  createGroup(@Body() dto: CreateGroupDto, @CurrentUser() user: RequestUser) {
    return this.chatService.createGroup(dto, user);
  }

  @Patch("groups/:id")
  updateGroup(@Param("id") id: string, @Body() dto: UpdateGroupDto, @CurrentUser() user: RequestUser) {
    return this.chatService.updateGroup(id, dto, user);
  }

  @Post("groups/:id/members")
  addGroupMembers(@Param("id") id: string, @Body() dto: AddGroupMembersDto, @CurrentUser() user: RequestUser) {
    return this.chatService.addGroupMembers(id, dto.userIds, user);
  }

  // Removing yourself is "leave group"; removing someone else needs a group admin.
  @Delete("groups/:id/members/:userId")
  removeGroupMember(@Param("id") id: string, @Param("userId") userId: string, @CurrentUser() user: RequestUser) {
    return this.chatService.removeGroupMember(id, userId, user);
  }

  @Post("dms")
  getOrCreateDM(@Body() dto: GetOrCreateDmDto, @CurrentUser() user: RequestUser) {
    return this.chatService.getOrCreateDM(dto.recipientId, user);
  }

  @Get("channels/:id/messages")
  findMessages(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Query("q") q?: string,
  ) {
    return this.chatService.findMessages(id, user, q);
  }

  @Patch("messages/:id/pin")
  togglePinMessage(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.chatService.togglePinMessage(id, user);
  }

  @Post("channels/:id/messages")
  sendMessage(
    @Param("id") id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.chatService.sendMessage(id, dto.content, user, dto.mentionIds);
  }
}
