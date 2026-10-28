import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { SyncedEmailsService } from "./synced-emails.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";
import { SendDirectEmailDto } from "./dto/send-email.dto";
import type { EmailDirection } from "@prisma/client";

@Controller("synced-emails")
export class SyncedEmailsController {
  constructor(private readonly service: SyncedEmailsService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query("contactId") contactId?: string,
    @Query("dealId") dealId?: string,
    @Query("direction") direction?: EmailDirection,
    @Query("search") search?: string,
  ) {
    return this.service.list(user, { contactId, dealId, direction, search });
  }

  @Post("sync")
  syncNow(@CurrentUser() user: RequestUser) {
    return this.service.syncNow(user);
  }

  @Post("send")
  send(
    @CurrentUser() user: RequestUser,
    @Body() dto: SendDirectEmailDto,
  ) {
    return this.service.sendDirectEmail(user, dto);
  }

  @Patch(":id/read")
  markRead(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.markRead(id, user);
  }

  @Delete(":id")
  delete(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.delete(id, user);
  }
}

