import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from "@nestjs/common";
import { SeoBacklinksService } from "./seo-backlinks.service";
import { CreateSeoBacklinkDto } from "./dto/create-seo-backlink.dto";
import { UpdateSeoBacklinkDto } from "./dto/update-seo-backlink.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("seo-backlinks")
export class SeoBacklinksController {
  constructor(private readonly seoBacklinksService: SeoBacklinksService) {}

  @Post()
  create(@Body() dto: CreateSeoBacklinkDto, @CurrentUser() user: RequestUser) {
    return this.seoBacklinksService.create(dto, user);
  }

  @Get()
  findAll(
    @Query("departmentId") departmentId: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    return this.seoBacklinksService.findAll(departmentId, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.seoBacklinksService.findOne(id, user);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateSeoBacklinkDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.seoBacklinksService.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.seoBacklinksService.remove(id, user);
  }
}
