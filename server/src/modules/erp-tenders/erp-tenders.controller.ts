import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { Roles } from "../../common/decorators/roles.decorator";
import { UpdateErpTenderStatusDto } from "./dto/update-erp-tender-status.dto";
import { ErpTendersService } from "./erp-tenders.service";

// All routes need a login (global JWT guard).
@Controller("erp-tenders")
export class ErpTendersController {
  constructor(private readonly service: ErpTendersService) {}

  @Get()
  list(
    @Query("status") status?: string,
    @Query("country") country?: string,
    @Query("openOnly") openOnly?: string,
    @Query("search") search?: string,
    @Query("take") take?: string,
    @Query("skip") skip?: string,
  ) {
    return this.service.list({
      status,
      country,
      openOnly: openOnly === "true",
      search,
      take: take ? Math.min(Math.max(parseInt(take, 10) || 50, 1), 200) : 50,
      skip: skip ? Math.max(parseInt(skip, 10) || 0, 0) : 0,
    });
  }

  @Get("stats")
  stats() {
    return this.service.stats();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Patch(":id/status")
  updateStatus(@Param("id") id: string, @Body() dto: UpdateErpTenderStatusDto) {
    return this.service.updateStatus(id, dto.status);
  }

  @Roles(RoleName.ADMIN, RoleName.MANAGER)
  @Post("refresh")
  refresh() {
    return this.service.refresh();
  }
}
