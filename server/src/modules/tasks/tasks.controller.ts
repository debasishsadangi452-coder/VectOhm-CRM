import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { TaskPriority, TaskStatus } from "@prisma/client";
import { TasksService } from "./tasks.service";
import { TaskCommunicationService } from "./task-communication.service";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { SendTaskMessageDto } from "./dto/send-task-message.dto";
import { RequestTaskUpdateDto } from "./dto/request-task-update.dto";
import { SubmitTaskUpdateDto } from "./dto/submit-task-update.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("tasks")
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly taskCommunicationService: TaskCommunicationService,
  ) {}

  @Get()
  findAll(
    @CurrentUser() user: RequestUser,
    @Query("status") status?: TaskStatus,
    @Query("priority") priority?: TaskPriority,
    @Query("projectId") projectId?: string,
    @Query("assigneeId") assigneeId?: string,
    @Query("mine") mine?: string,
    @Query("departmentId") departmentId?: string,
    @Query("taskListId") taskListId?: string,
  ) {
    return this.tasksService.findAll(
      {
        status,
        priority,
        projectId,
        assigneeId: mine === "true" ? user.id : assigneeId,
        departmentId,
        taskListId,
      },
      user,
    );
  }

  @Get(":id/messages")
  getMessages(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.taskCommunicationService.getMessages(id, user);
  }

  @Post(":id/messages")
  sendMessage(
    @Param("id") id: string,
    @Body() dto: SendTaskMessageDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.taskCommunicationService.sendMessage(id, dto, user);
  }

  @Post(":id/request-update")
  requestUpdate(
    @Param("id") id: string,
    @Body() dto: RequestTaskUpdateDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.taskCommunicationService.requestUpdate(id, dto, user);
  }

  @Post(":id/submit-update")
  submitUpdate(
    @Param("id") id: string,
    @Body() dto: SubmitTaskUpdateDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.taskCommunicationService.submitUpdate(id, dto, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.tasksService.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: RequestUser) {
    return this.tasksService.create(dto, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateTaskDto, @CurrentUser() user: RequestUser) {
    return this.tasksService.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.tasksService.remove(id, user);
  }
}
