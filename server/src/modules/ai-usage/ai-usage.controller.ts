import {
  Controller,
  Get,
  Query,
  UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { AiUsageService, AiUsageSummary } from "./ai-usage.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("ai-usage")
@UseGuards(JwtAuthGuard)
export class AiUsageController {
  constructor(private readonly aiUsageService: AiUsageService) {}

  @Get("summary")
  async getSummary(
    @CurrentUser() user: RequestUser,
    @Query("range") range?: "today" | "7d" | "30d" | "all",
  ): Promise<AiUsageSummary> {
    const roleName = user.role.name;
    const deptName = (user.department?.name || "").toLowerCase().trim();
    const isDevTeam = deptName.includes("dev") || deptName.includes("engineering");
    const isAuthorized = roleName === RoleName.ADMIN || roleName === RoleName.MANAGER || isDevTeam;

    if (!isAuthorized) {
      throw new ForbiddenException(
        "Access denied. Only Admins, Managers, and Development team members are permitted to view AI token usage and costs.",
      );
    }

    return this.aiUsageService.getSummary(range || "30d");
  }
}
