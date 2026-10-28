import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { DealStage, RoleName } from "@prisma/client";
import { DealsService } from "./deals.service";
import { DealFollowUpsService } from "./deal-follow-ups.service";
import { CreateDealDto } from "./dto/create-deal.dto";
import { UpdateDealDto } from "./dto/update-deal.dto";
import { Roles } from "../../common/decorators/roles.decorator";
import { Department } from "../../common/decorators/department.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Department("Sales")
@Controller("deals")
export class DealsController {
  constructor(
    private readonly dealsService: DealsService,
    private readonly followUpsEngine: DealFollowUpsService,
  ) {}

  // Admin-only manual trigger, so a due reminder can be verified/forced
  // without waiting up to an hour -- same convention as the Bulk Email and
  // Sequence engines' "run now" endpoints.
  @Roles(RoleName.ADMIN)
  @Post("follow-ups/engine/run")
  runFollowUpsEngine() {
    return this.followUpsEngine.runOnce();
  }

  @Get()
  findAll(
    @CurrentUser() user: RequestUser,
    @Query("stage") stage?: DealStage,
    @Query("ownerId") ownerId?: string,
    @Query("companyId") companyId?: string,
    @Query("mine") mine?: string,
  ) {
    return this.dealsService.findAll(
      {
        stage,
        companyId,
        ownerId: mine === "true" ? user.id : ownerId,
      },
      user,
    );
  }

  // Must come before @Get(":id") -- otherwise "follow-ups" matches the :id
  // wildcard and hits findOne("follow-ups") instead.
  @Get("follow-ups")
  findFollowUps(@CurrentUser() user: RequestUser) {
    return this.dealsService.findFollowUps(user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.dealsService.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateDealDto, @CurrentUser() user: RequestUser) {
    return this.dealsService.create(dto, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateDealDto, @CurrentUser() user: RequestUser) {
    return this.dealsService.update(id, dto, user);
  }

  @Delete(":id")
  archive(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.dealsService.archive(id, user);
  }

  @Post(":id/approve")
  approve(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.dealsService.approve(id, user);
  }

  @Post(":id/reject")
  reject(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.dealsService.reject(id, user);
  }
}
