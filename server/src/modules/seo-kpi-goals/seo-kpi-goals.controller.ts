import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from "@nestjs/common";
import { SeoKpiGoalsService } from "./seo-kpi-goals.service";
import { CreateSeoKpiGoalDto } from "./dto/create-seo-kpi-goal.dto";
import { UpdateSeoKpiGoalDto } from "./dto/update-seo-kpi-goal.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("seo-kpi-goals")
export class SeoKpiGoalsController {
  constructor(private readonly seoKpiGoalsService: SeoKpiGoalsService) {}

  @Post()
  create(@Body() dto: CreateSeoKpiGoalDto, @CurrentUser() user: RequestUser) {
    return this.seoKpiGoalsService.create(dto, user);
  }

  @Get()
  findAll(
    @Query("departmentId") departmentId: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    return this.seoKpiGoalsService.findAll(departmentId, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.seoKpiGoalsService.findOne(id, user);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateSeoKpiGoalDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.seoKpiGoalsService.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.seoKpiGoalsService.remove(id, user);
  }
}
