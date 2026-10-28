import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { PhoneNumbersService } from "./phone-numbers.service";
import { CreatePhoneNumberDto } from "./dto/create-phone-number.dto";
import { UpdatePhoneNumberDto } from "./dto/update-phone-number.dto";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("telephony/numbers")
export class PhoneNumbersController {
  constructor(private readonly phoneNumbersService: PhoneNumbersService) {}

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.phoneNumbersService.findAll(user);
  }

  @Roles(RoleName.ADMIN)
  @Post()
  create(@Body() dto: CreatePhoneNumberDto) {
    return this.phoneNumbersService.create(dto);
  }

  @Roles(RoleName.ADMIN)
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdatePhoneNumberDto) {
    return this.phoneNumbersService.update(id, dto);
  }

  @Roles(RoleName.ADMIN)
  @Delete(":id")
  async remove(@Param("id") id: string) {
    await this.phoneNumbersService.remove(id);
    return { removed: true };
  }
}
