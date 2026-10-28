import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { InterviewStatus } from "@prisma/client";
import { InterviewsService } from "./interviews.service";
import { CreateInterviewDto } from "./dto/create-interview.dto";
import { UpdateInterviewDto } from "./dto/update-interview.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Department } from "../../common/decorators/department.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Department("Recruitment")
@Controller("interviews")
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Get()
  findAll(
    @CurrentUser() user: RequestUser,
    @Query("candidateId") candidateId?: string,
    @Query("interviewerId") interviewerId?: string,
    @Query("status") status?: InterviewStatus,
    @Query("mine") mine?: string,
    @Query("upcoming") upcoming?: string,
  ) {
    return this.interviewsService.findAll(
      {
        candidateId,
        interviewerId: mine === "true" ? user.id : interviewerId,
        status,
        upcoming: upcoming === "true",
      },
      user,
    );
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.interviewsService.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateInterviewDto, @CurrentUser() user: RequestUser) {
    return this.interviewsService.create(dto, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateInterviewDto, @CurrentUser() user: RequestUser) {
    return this.interviewsService.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.interviewsService.remove(id, user);
  }
}
