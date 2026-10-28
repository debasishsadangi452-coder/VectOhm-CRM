import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { VendorsService } from "./vendors.service";
import { CreateVendorDto } from "./dto/create-vendor.dto";
import { UpdateVendorDto } from "./dto/update-vendor.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Department } from "../../common/decorators/department.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Department("Recruitment")
@Controller("vendors")
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get()
  findAll() {
    return this.vendorsService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.vendorsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateVendorDto, @CurrentUser() user: RequestUser) {
    return this.vendorsService.create(dto, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateVendorDto, @CurrentUser() user: RequestUser) {
    return this.vendorsService.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.vendorsService.remove(id, user);
  }
}
