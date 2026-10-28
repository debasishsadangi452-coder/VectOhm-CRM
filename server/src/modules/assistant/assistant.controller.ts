import { Body, Controller, Delete, Get, HttpCode, Param, Post } from "@nestjs/common";
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { AssistantService } from "./assistant.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

export class AssistantChatDto {
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;
}

// Open to every signed-in user: what the assistant can actually do is decided
// per person from their role and department (see assistant-tools.ts).
@Controller("assistant")
export class AssistantController {
  constructor(private readonly service: AssistantService) {}

  @Get("capabilities")
  capabilities(@CurrentUser() user: RequestUser) {
    return this.service.capabilities(user);
  }

  @Get("conversations")
  list(@CurrentUser() user: RequestUser) {
    return this.service.listConversations(user);
  }

  @Get("conversations/:id")
  get(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.getConversation(id, user);
  }

  @Delete("conversations/:id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.deleteConversation(id, user);
  }

  @Post("chat")
  @HttpCode(200)
  chat(@Body() dto: AssistantChatDto, @CurrentUser() user: RequestUser) {
    return this.service.chat(user, dto);
  }

  @Post("actions/:id/confirm")
  @HttpCode(200)
  confirm(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.confirm(id, user);
  }

  @Post("actions/:id/cancel")
  @HttpCode(200)
  cancel(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.cancel(id, user);
  }
}
