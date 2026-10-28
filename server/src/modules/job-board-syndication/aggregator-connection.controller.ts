import { Body, Controller, Delete, Get, Put } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { AggregatorConnectionService } from "./aggregator-connection.service";
import { ConnectAggregatorDto } from "./dto/connect-aggregator.dto";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";
import { Department } from "../../common/decorators/department.decorator";

@Department("Recruitment")
@Controller("job-distribution-aggregator")
export class AggregatorConnectionController {
  constructor(private readonly connection: AggregatorConnectionService) {}

  // Status only -- never returns the key. Same reasoning as
  // JobBoardConnectionController.getAllStatuses.
  @Get()
  getStatus() {
    return this.connection.getStatus();
  }

  // @Roles filters out plain employees; the service's assertCanManage() adds
  // the finer-grained check that a MANAGER must actually belong to
  // Recruitment, which @Roles alone can't express.
  @Roles(RoleName.ADMIN, RoleName.MANAGER)
  @Put()
  connect(@Body() dto: ConnectAggregatorDto, @CurrentUser() user: RequestUser) {
    return this.connection.connect(dto, user);
  }

  @Roles(RoleName.ADMIN, RoleName.MANAGER)
  @Delete()
  async disconnect(@CurrentUser() user: RequestUser) {
    await this.connection.disconnect(user);
    return { connected: false };
  }
}
