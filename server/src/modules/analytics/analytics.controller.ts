import { Controller, Get } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("summary")
  getSummary(@CurrentUser() user: RequestUser) {
    return this.analyticsService.getSummary(user);
  }
}
