import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { JobPostingStatus } from "@prisma/client";
import { JobPostingsService } from "./job-postings.service";
import { CreateJobPostingDto } from "./dto/create-job-posting.dto";
import { UpdateJobPostingDto } from "./dto/update-job-posting.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Department } from "../../common/decorators/department.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Department("Recruitment")
@Controller("job-postings")
export class JobPostingsController {
  constructor(private readonly jobPostingsService: JobPostingsService) {}

  @Get()
  findAll(
    @CurrentUser() user: RequestUser,
    @Query("status") status?: JobPostingStatus,
    @Query("hiringDepartmentId") hiringDepartmentId?: string,
    @Query("departmentId") departmentId?: string,
  ) {
    return this.jobPostingsService.findAll({ status, hiringDepartmentId, departmentId }, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.jobPostingsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateJobPostingDto, @CurrentUser() user: RequestUser) {
    return this.jobPostingsService.create(dto, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateJobPostingDto, @CurrentUser() user: RequestUser) {
    return this.jobPostingsService.update(id, dto, user);
  }

  // Permanently delete for Admin or ?permanent=true; otherwise soft-close.
  @Delete(":id")
  deleteOrClose(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Query("permanent") permanent?: string,
  ) {
    if (permanent === "true" || user.role.name === "ADMIN") {
      return this.jobPostingsService.delete(id, user);
    }
    return this.jobPostingsService.close(id, user);
  }
}
