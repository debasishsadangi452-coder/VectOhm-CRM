import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { BulkEmailService } from "./bulk-email.service";
import { BulkEmailEngineService } from "./bulk-email-engine.service";
import { CreateBulkEmailDto } from "./dto/create-bulk-email.dto";
import { Roles } from "../../common/decorators/roles.decorator";
import { Department } from "../../common/decorators/department.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Department("Sales", "Recruitment")
@Controller("bulk-email")
export class BulkEmailController {
  constructor(
    private readonly bulkEmailService: BulkEmailService,
    private readonly engine: BulkEmailEngineService,
  ) {}

  // Manual trigger so a queued campaign can start sending immediately
  // without waiting up to 5 minutes for the next background cron tick.
  @Post("engine/run")
  runEngine() {
    return this.engine.runOnce();
  }

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.bulkEmailService.findAll(user);
  }

  @Get("follow-ups")
  findFollowUps(@CurrentUser() user: RequestUser) {
    return this.bulkEmailService.findFollowUps(user);
  }

  @Patch("follow-ups/:id/dismiss")
  dismissFollowUp(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.bulkEmailService.dismissFollowUp(id, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.bulkEmailService.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateBulkEmailDto, @CurrentUser() user: RequestUser) {
    return this.bulkEmailService.create(dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.bulkEmailService.remove(id, user);
  }

  @Post(":id/retry-failed")
  retryFailed(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.bulkEmailService.retryFailed(id, user);
  }

  @Post(":id/cancel-pending")
  cancelPending(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.bulkEmailService.cancelPending(id, user);
  }
}

