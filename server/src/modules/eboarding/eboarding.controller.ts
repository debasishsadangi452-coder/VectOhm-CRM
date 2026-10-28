import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { EboardingService } from "./eboarding.service";
import { CreateEboardingDto } from "./dto/create-eboarding.dto";
import { UpdateEboardingDto } from "./dto/update-eboarding.dto";
import { UpdateEboardingStatusDto } from "./dto/update-eboarding-status.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Department } from "../../common/decorators/department.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Department("Recruitment")
@Controller("eboarding")
export class EboardingController {
  constructor(private readonly eboardingService: EboardingService) {}

  @Get()
  findAll() {
    return this.eboardingService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.eboardingService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateEboardingDto, @CurrentUser() user: RequestUser) {
    return this.eboardingService.create(dto, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateEboardingDto, @CurrentUser() user: RequestUser) {
    return this.eboardingService.update(id, dto, user);
  }

  @Patch(":id/status")
  updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateEboardingStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.eboardingService.updateStatus(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.eboardingService.remove(id, user);
  }
}
