import { Body, Controller, Get, Patch } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { AppSettingsService } from "./app-settings.service";
import { UpdateAppSettingsDto } from "./dto/update-app-settings.dto";
import { Roles } from "../../common/decorators/roles.decorator";

@Controller("app-settings")
export class AppSettingsController {
  constructor(private readonly appSettingsService: AppSettingsService) {}

  // Open to any authenticated user -- the Dashboard hero reads this for
  // everyone, not just Admins.
  @Get()
  get() {
    return this.appSettingsService.get();
  }

  @Roles(RoleName.ADMIN, RoleName.MANAGER)
  @Patch()
  update(@Body() dto: UpdateAppSettingsDto) {
    return this.appSettingsService.update(dto);
  }
}
