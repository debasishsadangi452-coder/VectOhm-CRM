import { Body, Controller, Delete, Get, Put } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { JustCallConnectionService } from "./justcall-connection.service";
import { ConnectJustCallDto } from "./dto/connect-justcall.dto";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("telephony/connection")
export class JustCallConnectionController {
  constructor(private readonly connectionService: JustCallConnectionService) {}

  // Status only -- never returns the key/secret. Open to any authed user so
  // the CallButton/GlobalCallWidget can tell whether calling will work.
  @Get()
  getStatus() {
    return this.connectionService.getStatus();
  }

  @Roles(RoleName.ADMIN, RoleName.MANAGER)
  @Put()
  connect(@Body() dto: ConnectJustCallDto, @CurrentUser() user: RequestUser) {
    return this.connectionService.connect(dto.apiKey, dto.apiSecret, dto.webhookSecret, user.id);
  }

  @Roles(RoleName.ADMIN, RoleName.MANAGER)
  @Delete()
  async disconnect() {
    await this.connectionService.disconnect();
    return { connected: false };
  }
}
