import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from "@nestjs/common";
import { SeoKeywordsService } from "./seo-keywords.service";
import { CreateSeoKeywordDto } from "./dto/create-seo-keyword.dto";
import { UpdateSeoKeywordDto } from "./dto/update-seo-keyword.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("seo-keywords")
export class SeoKeywordsController {
  constructor(private readonly seoKeywordsService: SeoKeywordsService) {}

  @Post()
  create(@Body() dto: CreateSeoKeywordDto, @CurrentUser() user: RequestUser) {
    return this.seoKeywordsService.create(dto, user);
  }

  @Get()
  findAll(
    @Query("departmentId") departmentId: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    return this.seoKeywordsService.findAll(departmentId, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.seoKeywordsService.findOne(id, user);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateSeoKeywordDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.seoKeywordsService.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.seoKeywordsService.remove(id, user);
  }
}
