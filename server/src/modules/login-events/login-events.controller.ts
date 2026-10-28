import { Controller, ForbiddenException, Get, Query } from "@nestjs/common";
import { LoginEventsService } from "./login-events.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";
import { canManageDirectory } from "../../common/utils/directory-access";

// Login/logout audit trail. Visible only to those who can manage the directory
// (Admin + HR) -- the same authority that owns the employee records.
@Controller("login-events")
export class LoginEventsController {
  constructor(private readonly service: LoginEventsService) {}

  private assertCanView(user: RequestUser) {
    if (!canManageDirectory(user)) {
      throw new ForbiddenException("You do not have permission to view login activity");
    }
  }

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query("userId") userId?: string,
    @Query("limit") limit?: string,
  ) {
    this.assertCanView(user);
    return this.service.list({
      userId: userId || undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("last-logins")
  lastLogins(@CurrentUser() user: RequestUser) {
    this.assertCanView(user);
    return this.service.lastLogins();
  }
}
