import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ActivitiesService } from "./activities.service";
import { CreateActivityDto } from "./dto/create-activity.dto";
import { UpdateActivityDto } from "./dto/update-activity.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Department } from "../../common/decorators/department.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Department("Sales")
@Controller("activities")
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  findAll(@Query("dealId") dealId?: string) {
    return this.activitiesService.findAll({ dealId });
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.activitiesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateActivityDto, @CurrentUser() user: RequestUser) {
    return this.activitiesService.create(dto, user.id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateActivityDto, @CurrentUser() user: RequestUser) {
    return this.activitiesService.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.activitiesService.remove(id, user);
  }
}
