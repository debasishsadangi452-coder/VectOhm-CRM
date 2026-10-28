import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { EmailConnectionsService } from "./email-connections.service";
import { ConnectEmailDto } from "./dto/connect-email.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("email-connections")
export class EmailConnectionsController {
  constructor(private readonly service: EmailConnectionsService) {}

  @Get("me")
  getStatus(@CurrentUser() user: RequestUser) {
    return this.service.getStatus(user);
  }

  // Raw TCP reachability to a fixed set of known mail providers, used to
  // tell a network-level block apart from an account-level one when
  // Connect/Test keeps timing out.
  @Get("network-diagnostic")
  networkDiagnostic(@CurrentUser() user: RequestUser) {
    return this.service.networkDiagnostic(user);
  }

  @Post()
  connect(@Body() dto: ConnectEmailDto, @CurrentUser() user: RequestUser) {
    return this.service.connect(user, dto);
  }

  @Post("set-default")
  setDefault(@Body("connectionId") connectionId: string, @CurrentUser() user: RequestUser) {
    return this.service.setDefaultConnection(user, connectionId);
  }

  @Post("test")
  test(
    @Body("connectionId") bodyConnectionId: string | undefined,
    @Query("connectionId") queryConnectionId: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    const connectionId = bodyConnectionId || queryConnectionId;
    return this.service.test(user, connectionId);
  }

  @Delete(":id")
  disconnectById(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.disconnect(user, id);
  }

  @Delete()
  disconnect(
    @Body("connectionId") bodyConnectionId: string | undefined,
    @Query("connectionId") queryConnectionId: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    const connectionId = bodyConnectionId || queryConnectionId;
    return this.service.disconnect(user, connectionId);
  }
}
