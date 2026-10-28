import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { TaskUpdatesService } from "./task-updates.service";
import { CreateTaskUpdateDto } from "./dto/create-task-update.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("task-updates")
export class TaskUpdatesController {
  constructor(private readonly taskUpdatesService: TaskUpdatesService) {}

  @Get()
  findAllForTask(@Query("taskId") taskId: string, @CurrentUser() user: RequestUser) {
    return this.taskUpdatesService.findAllForTask(taskId, user);
  }

  @Get("for-sprint")
  findForSprint(@Query("sprintId") sprintId: string, @CurrentUser() user: RequestUser) {
    return this.taskUpdatesService.findForSprint(sprintId, user);
  }

  @Get("for-project")
  findForProject(@Query("projectId") projectId: string, @CurrentUser() user: RequestUser) {
    return this.taskUpdatesService.findForProject(projectId, user);
  }

  @Get("for-department")
  findForDepartment(
    @Query("departmentId") departmentId: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    return this.taskUpdatesService.findForDepartment(departmentId, user);
  }

  @Post()
  create(@Body() dto: CreateTaskUpdateDto, @CurrentUser() user: RequestUser) {
    return this.taskUpdatesService.create(dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.taskUpdatesService.remove(id, user);
  }
}
