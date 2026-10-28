import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { TaskListsService } from "./task-lists.service";
import { CreateTaskListDto } from "./dto/create-task-list.dto";
import { UpdateTaskListDto } from "./dto/update-task-list.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("task-lists")
export class TaskListsController {
  constructor(private readonly taskListsService: TaskListsService) {}

  @Get()
  findAllForProject(@Query("projectId") projectId: string) {
    return this.taskListsService.findAllForProject(projectId);
  }

  @Post()
  create(@Body() dto: CreateTaskListDto, @CurrentUser() user: RequestUser) {
    return this.taskListsService.create(dto, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateTaskListDto, @CurrentUser() user: RequestUser) {
    return this.taskListsService.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.taskListsService.remove(id, user);
  }
}
