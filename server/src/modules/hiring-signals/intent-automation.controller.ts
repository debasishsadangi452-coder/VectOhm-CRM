import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { IntentLeadOutcome, IntentOutreachStatus } from "@prisma/client";
import { IntentAutomationService } from "./intent-automation.service";
import {
  CreateIntentAutomationDto,
  UpdateIntentAutomationDto,
  UpdateOutreachDraftDto,
} from "./dto/intent-automation.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("intent-automations")
export class IntentAutomationController {
  constructor(private readonly service: IntentAutomationService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.service.list(user);
  }

  @Post()
  create(@Body() dto: CreateIntentAutomationDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user);
  }

  // Declared before ":id" routes so "outreach" isn't parsed as an automation id.
  @Get("outreach")
  listOutreach(
    @CurrentUser() user: RequestUser,
    @Query("automationId") automationId?: string,
    @Query("status") status?: IntentOutreachStatus,
  ) {
    return this.service.listOutreach(user, { automationId, status });
  }

  @Patch("outreach/:outreachId")
  updateDraft(
    @Param("outreachId") outreachId: string,
    @Body() dto: UpdateOutreachDraftDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updateDraft(outreachId, dto, user);
  }

  @Post("outreach/:outreachId/approve")
  approve(@Param("outreachId") outreachId: string, @CurrentUser() user: RequestUser) {
    return this.service.approve(outreachId, user);
  }

  @Post("outreach/:outreachId/reject")
  reject(@Param("outreachId") outreachId: string, @CurrentUser() user: RequestUser) {
    return this.service.reject(outreachId, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateIntentAutomationDto, @CurrentUser() user: RequestUser) {
    return this.service.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, user);
  }

  @Get(":id/runs")
  runs(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.listRuns(id, user);
  }

  @Get(":id/leads")
  leads(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Query("runId") runId?: string,
    @Query("outcome") outcome?: IntentLeadOutcome,
  ) {
    return this.service.listLeads(id, user, { runId, outcome });
  }

  @Post(":id/run")
  run(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.runNow(id, user);
  }

  @Post(":id/approve-all")
  approveAll(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.approveAll(id, user);
  }
}
