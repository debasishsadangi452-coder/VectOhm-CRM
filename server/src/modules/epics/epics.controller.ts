import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from "@nestjs/common";
import { EpicsService } from "./epics.service";
import { CreateEpicDto } from "./dto/create-epic.dto";
import { UpdateEpicDto } from "./dto/update-epic.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("epics")
export class EpicsController {
  constructor(private readonly epicsService: EpicsService) {}

  @Post()
  create(@Body() dto: CreateEpicDto, @CurrentUser() user: RequestUser) {
    return this.epicsService.create(dto, user);
  }

  @Get()
  findAll(@Query("departmentId") departmentId: string | undefined, @CurrentUser() user: RequestUser) {
    return this.epicsService.findAll(departmentId, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.epicsService.findOne(id, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateEpicDto, @CurrentUser() user: RequestUser) {
    return this.epicsService.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.epicsService.remove(id, user);
  }
}
