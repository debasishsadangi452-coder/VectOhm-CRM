import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { FollowUpTaskStatus, RoleName } from "@prisma/client";
import { FollowUpTasksService } from "./follow-up-tasks.service";
import { FollowUpAutomationService } from "./follow-up-automation.service";
import { SendFollowUpDto } from "./dto/send-follow-up.dto";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("follow-ups")
export class FollowUpTasksController {
  constructor(
    private readonly followUpTasks: FollowUpTasksService,
    private readonly automationEngine: FollowUpAutomationService,
  ) {}

  // Admin-only manual trigger, so a scheduled follow-up can be verified
  // without waiting up to 30 minutes -- same convention as the Bulk Email,
  // Sequence, and Deal Follow-Up engines' "run now" endpoints.
  @Roles(RoleName.ADMIN)
  @Post("engine/run")
  runEngine() {
    return this.automationEngine.runOnce();
  }

  @Get()
  findAll(@CurrentUser() user: RequestUser, @Query("status") status?: FollowUpTaskStatus) {
    return this.followUpTasks.findAll({ status }, user);
  }

  // Manual mode's "Create Follow-Up" -> opens an AI-assisted draft for the
  // rep to edit before sending.
  @Post(":id/generate-draft")
  generateDraft(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.followUpTasks.generateDraft(id, user);
  }

  @Post(":id/send")
  send(@Param("id") id: string, @Body() dto: SendFollowUpDto, @CurrentUser() user: RequestUser) {
    return this.followUpTasks.send(id, dto, user);
  }

  @Patch(":id/dismiss")
  dismiss(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.followUpTasks.dismiss(id, user);
  }
}
