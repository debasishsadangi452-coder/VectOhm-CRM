import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { IsInt, Max, Min } from "class-validator";
import { LateStartRequestsService, MAX_LATE_START_MIN } from "./late-start-requests.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

class CreateLateStartRequestDto {
  @IsInt()
  @Min(1)
  @Max(MAX_LATE_START_MIN)
  expectedLateMin!: number;
}

// Jivan says ahead of the shift how late he will be; the owner approves or denies.
@Controller("late-start-requests")
export class LateStartRequestsController {
  constructor(private readonly service: LateStartRequestsService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateLateStartRequestDto) {
    return this.service.create(user, dto.expectedLateMin);
  }

  @Get("today")
  today(@CurrentUser() user: RequestUser) {
    return this.service.today(user);
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
