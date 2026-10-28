import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from "@nestjs/common";
import { SeoCompetitorsService } from "./seo-competitors.service";
import { CreateSeoCompetitorDto } from "./dto/create-seo-competitor.dto";
import { UpdateSeoCompetitorDto } from "./dto/update-seo-competitor.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("seo-competitors")
export class SeoCompetitorsController {
  constructor(private readonly seoCompetitorsService: SeoCompetitorsService) {}

  @Post()
  create(@Body() dto: CreateSeoCompetitorDto, @CurrentUser() user: RequestUser) {
    return this.seoCompetitorsService.create(dto, user);
  }

  @Get()
  findAll(@Query("departmentId") departmentId: string | undefined, @CurrentUser() user: RequestUser) {
    return this.seoCompetitorsService.findAll(departmentId, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.seoCompetitorsService.findOne(id, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateSeoCompetitorDto, @CurrentUser() user: RequestUser) {
    return this.seoCompetitorsService.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.seoCompetitorsService.remove(id, user);
  }
}
