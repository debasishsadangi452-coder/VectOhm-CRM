import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { SignOutRequestsService } from "./signout-requests.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

class CreateSignOutRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

// Locked-in users ask here to sign out; an Admin approves or denies.
@Controller("signout-requests")
export class SignOutRequestsController {
  constructor(private readonly service: SignOutRequestsService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateSignOutRequestDto) {
    return this.service.create(user, dto.reason);
  }

  @Get("mine")
  mine(@CurrentUser() user: RequestUser) {
    return this.service.mine(user);
  }

  @Post(":id/ack")
  acknowledge(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.service.acknowledge(user, id);
  }

  @Get()
  list(@CurrentUser() user: RequestUser, @Query("status") status?: string) {
    return this.service.list(user, status);
  }

  @Post(":id/approve")
  approve(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.service.decide(user, id, true);
  }

  @Post(":id/deny")
  deny(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.service.decide(user, id, false);
  }
}
