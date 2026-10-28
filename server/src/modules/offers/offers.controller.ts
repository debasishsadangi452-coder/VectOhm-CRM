import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { OfferStatus } from "@prisma/client";
import { OffersService } from "./offers.service";
import { CreateOfferDto } from "./dto/create-offer.dto";
import { UpdateOfferDto } from "./dto/update-offer.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Department } from "../../common/decorators/department.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Department("Recruitment")
@Controller("offers")
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Get()
  findAll(
    @CurrentUser() user: RequestUser,
    @Query("candidateId") candidateId?: string,
    @Query("status") status?: OfferStatus,
    @Query("departmentId") departmentId?: string,
  ) {
    return this.offersService.findAll({ candidateId, status, departmentId }, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.offersService.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateOfferDto, @CurrentUser() user: RequestUser) {
    return this.offersService.create(dto, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateOfferDto, @CurrentUser() user: RequestUser) {
    return this.offersService.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.offersService.remove(id, user);
  }
}
