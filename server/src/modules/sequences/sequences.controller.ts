import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { SequencesService } from "./sequences.service";
import { SequenceEngineService } from "./sequence-engine.service";
import { CreateSequenceDto } from "./dto/create-sequence.dto";
import { UpdateSequenceDto } from "./dto/update-sequence.dto";
import { CreateSequenceStepDto } from "./dto/create-sequence-step.dto";
import { UpdateSequenceStepDto } from "./dto/update-sequence-step.dto";
import { EnrollContactsDto } from "./dto/enroll-contacts.dto";
import { StopEnrollmentDto } from "./dto/stop-enrollment.dto";
import { Roles } from "../../common/decorators/roles.decorator";
import { Department } from "../../common/decorators/department.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Department("Sales")
@Controller("sequences")
export class SequencesController {
  constructor(
    private readonly sequencesService: SequencesService,
    private readonly engine: SequenceEngineService,
  ) {}

  // Must come before ":id" -- otherwise "activity" would be parsed as an id.
  @Get("activity")
  activity(@CurrentUser() user: RequestUser) {
    return this.sequencesService.recentActivity(user);
  }

  // Admin-only manual trigger, so a scheduled send can be verified/forced
  // without waiting up to 5 minutes for the next cron tick.
  @Roles(RoleName.ADMIN)
  @Post("engine/run")
  runEngine() {
    return this.engine.runOnce();
  }

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.sequencesService.findAll(user);
  }

  // Must come before ":id" for the same reason as "activity" above.
  @Get("follow-ups")
  findFollowUps(@CurrentUser() user: RequestUser) {
    return this.sequencesService.findFollowUps(user);
  }

  @Patch("follow-ups/:id/dismiss")
  dismissFollowUp(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.sequencesService.dismissFollowUp(id, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.sequencesService.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateSequenceDto, @CurrentUser() user: RequestUser) {
    return this.sequencesService.create(dto, user);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateSequenceDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.sequencesService.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.sequencesService.remove(id, user);
  }

  @Post(":id/steps")
  addStep(
    @Param("id") id: string,
    @Body() dto: CreateSequenceStepDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.sequencesService.addStep(id, dto, user);
  }

  @Patch(":id/steps/:stepId")
  updateStep(
    @Param("id") id: string,
    @Param("stepId") stepId: string,
    @Body() dto: UpdateSequenceStepDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.sequencesService.updateStep(id, stepId, dto, user);
  }

  @Delete(":id/steps/:stepId")
  removeStep(
    @Param("id") id: string,
    @Param("stepId") stepId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.sequencesService.removeStep(id, stepId, user);
  }

  @Post(":id/enroll")
  enroll(
    @Param("id") id: string,
    @Body() dto: EnrollContactsDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.sequencesService.enroll(id, dto, user);
  }

  @Post(":id/enrollments/:enrollmentId/stop")
  stopEnrollment(
    @Param("id") id: string,
    @Param("enrollmentId") enrollmentId: string,
    @Body() dto: StopEnrollmentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.sequencesService.stopEnrollment(id, enrollmentId, dto.reason, user);
  }
}
