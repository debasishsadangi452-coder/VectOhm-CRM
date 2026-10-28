import { Body, Controller, Delete, Get, Put } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { ApolloConnectionService } from "./apollo-connection.service";
import { ConnectApolloDto } from "./dto/connect-apollo.dto";
import { Roles } from "../../common/decorators/roles.decorator";
import { Department } from "../../common/decorators/department.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Department("Sales")
@Controller("apollo/connection")
export class ApolloConnectionController {
  constructor(private readonly apolloConnectionService: ApolloConnectionService) {}

  // Status only -- never returns the key. Open to any authed user so the
  // outreach UI can tell whether search/import will work.
  @Get()
  getStatus() {
    return this.apolloConnectionService.getStatus();
  }

  @Roles(RoleName.ADMIN)
  @Put()
  connect(@Body() dto: ConnectApolloDto, @CurrentUser() user: RequestUser) {
    return this.apolloConnectionService.connect(dto.apiKey, user.id);
  }

  @Roles(RoleName.ADMIN)
  @Delete()
  async disconnect() {
    await this.apolloConnectionService.disconnect();
    return { connected: false };
  }
}
