import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ProjectStatus } from "@prisma/client";
import { ProjectsService } from "./projects.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { AddMemberDto } from "./dto/add-member.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("projects")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll(
    @CurrentUser() user: RequestUser,
    @Query("status") status?: ProjectStatus,
    @Query("ownerId") ownerId?: string,
    @Query("departmentId") departmentId?: string,
  ) {
    return this.projectsService.findAll({ status, ownerId, departmentId }, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.projectsService.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: RequestUser) {
    return this.projectsService.create(dto, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateProjectDto, @CurrentUser() user: RequestUser) {
    return this.projectsService.update(id, dto, user);
  }

  @Delete(":id")
  remove(
    @Param("id") id: string,
    @Query("archiveOnly") archiveOnly: string,
    @CurrentUser() user: RequestUser,
  ) {
    if (archiveOnly === "true") {
      return this.projectsService.archive(id, user);
    }
    return this.projectsService.remove(id, user);
  }

  @Post(":id/members")
  addMember(@Param("id") id: string, @Body() dto: AddMemberDto, @CurrentUser() user: RequestUser) {
    return this.projectsService.addMember(id, dto.userId, user);
  }

  @Delete(":id/members/:userId")
  removeMember(
    @Param("id") id: string,
    @Param("userId") userId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.projectsService.removeMember(id, userId, user);
  }
}
