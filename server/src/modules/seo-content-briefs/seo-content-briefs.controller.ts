import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from "@nestjs/common";
import { SeoContentBriefsService } from "./seo-content-briefs.service";
import { CreateSeoContentBriefDto } from "./dto/create-seo-content-brief.dto";
import { UpdateSeoContentBriefDto } from "./dto/update-seo-content-brief.dto";
import { CreateContentBriefQaCheckDto } from "./dto/create-content-brief-qa-check.dto";
import { UpdateContentBriefQaCheckDto } from "./dto/update-content-brief-qa-check.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("seo-content-briefs")
export class SeoContentBriefsController {
  constructor(private readonly seoContentBriefsService: SeoContentBriefsService) {}

  @Post()
  create(@Body() dto: CreateSeoContentBriefDto, @CurrentUser() user: RequestUser) {
    return this.seoContentBriefsService.create(dto, user);
  }

  @Get()
  findAll(
    @Query("departmentId") departmentId: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    return this.seoContentBriefsService.findAll(departmentId, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.seoContentBriefsService.findOne(id, user);
  }

  @Post(":id/generate")
  generateDraft(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.seoContentBriefsService.generateDraft(id, user);
  }

  @Post(":id/qa-checks")
  addQaCheck(
    @Param("id") id: string,
    @Body() dto: CreateContentBriefQaCheckDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.seoContentBriefsService.addQaCheck(id, dto, user);
  }

  @Patch("qa-checks/:checkId")
  toggleQaCheck(
    @Param("checkId") checkId: string,
    @Body() dto: UpdateContentBriefQaCheckDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.seoContentBriefsService.toggleQaCheck(checkId, dto, user);
  }

  @Delete("qa-checks/:checkId")
  removeQaCheck(@Param("checkId") checkId: string, @CurrentUser() user: RequestUser) {
    return this.seoContentBriefsService.removeQaCheck(checkId, user);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateSeoContentBriefDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.seoContentBriefsService.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.seoContentBriefsService.remove(id, user);
  }
}
