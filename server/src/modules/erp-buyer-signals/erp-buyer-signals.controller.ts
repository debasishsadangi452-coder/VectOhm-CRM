import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { Roles } from "../../common/decorators/roles.decorator";
import { UpdateErpBuyerSignalStatusDto } from "./dto/update-erp-buyer-signal-status.dto";
import { ErpBuyerSignalsService } from "./erp-buyer-signals.service";

// All routes need a login (global JWT guard).
@Controller("erp-buyer-signals")
export class ErpBuyerSignalsController {
  constructor(private readonly service: ErpBuyerSignalsService) {}

  @Get()
  list(
    @Query("stage") stage?: string,
    @Query("status") status?: string,
    @Query("country") country?: string,
    @Query("search") search?: string,
    @Query("take") take?: string,
    @Query("skip") skip?: string,
  ) {
    return this.service.list({
      stage,
      status,
      country,
      search,
      take: take ? Math.min(Math.max(parseInt(take, 10) || 50, 1), 200) : 50,
      skip: skip ? Math.max(parseInt(skip, 10) || 0, 0) : 0,
    });
  }

  @Get("stats")
  stats() {
    return this.service.stats();
  }

  @Get("companies")
  companies() {
    return this.service.companies();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Patch(":id/status")
  updateStatus(@Param("id") id: string, @Body() dto: UpdateErpBuyerSignalStatusDto) {
    return this.service.updateStatus(id, dto.status);
  }

  @Roles(RoleName.ADMIN, RoleName.MANAGER)
  @Post("refresh")
  refresh() {
    return this.service.refresh();
  }
}
