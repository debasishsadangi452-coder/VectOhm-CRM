import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { SprintsService } from "./sprints.service";
import { CreateSprintDto } from "./dto/create-sprint.dto";
import { UpdateSprintDto } from "./dto/update-sprint.dto";
import { AssignTasksDto } from "./dto/assign-tasks.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("sprints")
export class SprintsController {
  constructor(private readonly sprintsService: SprintsService) {}

  @Get()
  findAll(@CurrentUser() user: RequestUser, @Query("projectId") projectId?: string) {
    return this.sprintsService.findAll(user, projectId);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.sprintsService.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateSprintDto, @CurrentUser() user: RequestUser) {
    return this.sprintsService.create(dto, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateSprintDto, @CurrentUser() user: RequestUser) {
    return this.sprintsService.update(id, dto, user);
  }

  @Post(":id/tasks")
  assignTasks(
    @Param("id") id: string,
    @Body() dto: AssignTasksDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.sprintsService.assignTasks(id, dto.taskIds, user);
  }
}
