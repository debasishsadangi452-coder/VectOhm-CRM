import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from "@nestjs/common";
import { SeoAuditsService } from "./seo-audits.service";
import { CreateSeoAuditDto } from "./dto/create-seo-audit.dto";
import { UpdateSeoAuditDto } from "./dto/update-seo-audit.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("seo-audits")
export class SeoAuditsController {
  constructor(private readonly seoAuditsService: SeoAuditsService) {}

  @Post()
  create(@Body() dto: CreateSeoAuditDto, @CurrentUser() user: RequestUser) {
    return this.seoAuditsService.create(dto, user);
  }

  @Get()
  findAll(@Query("departmentId") departmentId: string | undefined, @CurrentUser() user: RequestUser) {
    return this.seoAuditsService.findAll(departmentId, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.seoAuditsService.findOne(id, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateSeoAuditDto, @CurrentUser() user: RequestUser) {
    return this.seoAuditsService.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.seoAuditsService.remove(id, user);
  }
}
