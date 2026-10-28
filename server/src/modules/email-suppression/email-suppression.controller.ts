import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { EmailSuppressionService } from "./email-suppression.service";
import { AddSuppressionDto } from "./dto/add-suppression.dto";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("email-suppressions")
export class EmailSuppressionController {
  constructor(private readonly emailSuppressionService: EmailSuppressionService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.emailSuppressionService.list(user);
  }

  @Post()
  add(@Body() dto: AddSuppressionDto, @CurrentUser() user: RequestUser) {
    return this.emailSuppressionService.add(dto.email, user);
  }

  @Roles(RoleName.ADMIN)
  @Delete(":id")
  async remove(@Param("id") id: string) {
    await this.emailSuppressionService.remove(id);
    return { removed: true };
  }

  // Hit by the link in every outgoing outreach email -- no auth, verified by
  // HMAC token instead (see unsubscribe-token.ts).
  @Public()
  @Get("unsubscribe")
  async unsubscribe(@Query("email") email: string, @Query("token") token: string) {
    await this.emailSuppressionService.unsubscribeViaToken(email, token);
    return { unsubscribed: true };
  }
}
