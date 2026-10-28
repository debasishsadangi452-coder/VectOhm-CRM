import { Controller, Get } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

import { Department } from "../../common/decorators/department.decorator";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Department("Sales")
  @Get("sales")
  getSalesStats(@CurrentUser() user: RequestUser) {
    return this.dashboardService.getSalesStats(user);
  }

  @Department("Development")
  @Get("dev")
  getDevStats(@CurrentUser() user: RequestUser) {
    return this.dashboardService.getDevStats(user);
  }

  @Department("Recruitment")
  @Get("recruitment")
  getRecruitmentStats(@CurrentUser() user: RequestUser) {
    return this.dashboardService.getRecruitmentStats(user);
  }
}
