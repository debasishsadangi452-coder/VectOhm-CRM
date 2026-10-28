import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { IsString, Matches, MaxLength, MinLength } from "class-validator";
import { AttendanceAdjustmentsService } from "./attendance-adjustments.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

class CreateAdjustmentRequestDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  forDate!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(300)
  reason!: string;
}

// A person asks an Admin to record a day they did not clock in; another Admin
// approves or denies. Approved entries are flagged on the attendance page.
@Controller("attendance-adjustments")
export class AttendanceAdjustmentsController {
  constructor(private readonly service: AttendanceAdjustmentsService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateAdjustmentRequestDto) {
    return this.service.create(user, dto.forDate, dto.reason);
  }

  @Get("mine")
  mine(@CurrentUser() user: RequestUser) {
    return this.service.mine(user);
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
