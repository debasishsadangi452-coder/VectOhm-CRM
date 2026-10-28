import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ActivityMonitoringService } from "./activity-monitoring.service";
import { CreateActivityPingDto } from "./dto/create-activity-ping.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("activity-monitoring")
export class ActivityMonitoringController {
  constructor(private readonly service: ActivityMonitoringService) {}

  // Sent by the desktop agent, authenticated as the employee whose idle
  // time this is -- userId always comes from the token, never the body.
  @Post("pings")
  create(@Body() dto: CreateActivityPingDto, @CurrentUser() user: RequestUser) {
    return this.service.create(user, dto.idleSeconds, dto.keystrokeCount, dto.clickCount);
  }

  // Sent by the desktop agent when the employee confirms Quit (after being
  // told HR and Admin will be notified). Recording is always on while signed
  // in, so this fires whether or not they're clocked in.
  @Post("agent-quit")
  agentQuit(@CurrentUser() user: RequestUser) {
    return this.service.reportAgentQuit(user);
  }

  // Sent by the desktop agent when the employee confirms Sign out from the
  // tray menu (same warning/notification treatment as Quit, since both stop
  // screen recording). Never sent for a forced/automatic sign-out.
  @Post("agent-sign-out")
  agentSignOut(@CurrentUser() user: RequestUser) {
    return this.service.reportAgentSignOut(user);
  }

  @Get("summary")
  summary(
    @CurrentUser() user: RequestUser,
    @Query("userId") userId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.service.summary(user, { userId, from, to });
  }

  // Per-day breakdown for one employee -- unlike summary(), always
  // single-user (a multi-employee daily grid over a date range would be an
  // unusable wall of data), so all three params are required.
  @Get("daily")
  daily(
    @CurrentUser() user: RequestUser,
    @Query("userId") userId: string,
    @Query("from") from: string,
    @Query("to") to: string,
  ) {
    return this.service.dailyBreakdown(user, userId, from, to);
  }

  @Get("timeline")
  timeline(
    @CurrentUser() user: RequestUser,
    @Query("userId") userId: string,
    @Query("from") from: string,
    @Query("to") to: string,
  ) {
    return this.service.timeline(user, userId, from, to);
  }
}
