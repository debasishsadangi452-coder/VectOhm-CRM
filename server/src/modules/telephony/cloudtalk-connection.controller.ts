import { Body, Controller, Delete, Get, Put } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { CloudTalkConnectionService } from "./cloudtalk-connection.service";
import { ConnectCloudTalkDto } from "./dto/connect-cloudtalk.dto";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("telephony/cloudtalk/connection")
export class CloudTalkConnectionController {
  constructor(private readonly connectionService: CloudTalkConnectionService) {}

  @Get()
  getStatus() {
    return this.connectionService.getStatus();
  }

  @Roles(RoleName.ADMIN, RoleName.MANAGER)
  @Put()
  connect(@Body() dto: ConnectCloudTalkDto, @CurrentUser() user: RequestUser) {
    return this.connectionService.connect(dto.apiKeyId, dto.apiKeySecret, dto.webhookSecret, user.id);
  }

  @Roles(RoleName.ADMIN, RoleName.MANAGER)
  @Delete()
  async disconnect() {
    await this.connectionService.disconnect();
    return { connected: false };
  }
}
