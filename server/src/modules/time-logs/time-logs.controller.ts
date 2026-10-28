import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { TimeLogStatus } from "@prisma/client";
import { TimeLogsService } from "./time-logs.service";
import { CreateTimeLogDto } from "./dto/create-time-log.dto";
import { UpdateTimeLogDto } from "./dto/update-time-log.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("time-logs")
export class TimeLogsController {
  constructor(private readonly timeLogsService: TimeLogsService) {}

  @Get()
  findAll(
    @CurrentUser() user: RequestUser,
    @Query("taskId") taskId?: string,
    @Query("userId") userId?: string,
    @Query("projectId") projectId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("mine") mine?: string,
    @Query("status") status?: TimeLogStatus,
  ) {
    return this.timeLogsService.findAll({ taskId, userId, projectId, from, to, mine: mine === "true", status }, user);
  }

  @Post()
  create(@Body() dto: CreateTimeLogDto, @CurrentUser() user: RequestUser) {
    return this.timeLogsService.create(dto, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateTimeLogDto, @CurrentUser() user: RequestUser) {
    return this.timeLogsService.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.timeLogsService.remove(id, user);
  }
}
