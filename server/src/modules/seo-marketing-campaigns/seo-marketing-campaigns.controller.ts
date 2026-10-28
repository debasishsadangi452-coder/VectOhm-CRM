import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from "@nestjs/common";
import { SeoMarketingCampaignsService } from "./seo-marketing-campaigns.service";
import { CreateSeoMarketingCampaignDto } from "./dto/create-seo-marketing-campaign.dto";
import { UpdateSeoMarketingCampaignDto } from "./dto/update-seo-marketing-campaign.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("seo-marketing-campaigns")
export class SeoMarketingCampaignsController {
  constructor(private readonly seoMarketingCampaignsService: SeoMarketingCampaignsService) {}

  @Post()
  create(@Body() dto: CreateSeoMarketingCampaignDto, @CurrentUser() user: RequestUser) {
    return this.seoMarketingCampaignsService.create(dto, user);
  }

  @Get()
  findAll(
    @Query("departmentId") departmentId: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    return this.seoMarketingCampaignsService.findAll(departmentId, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.seoMarketingCampaignsService.findOne(id, user);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateSeoMarketingCampaignDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.seoMarketingCampaignsService.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.seoMarketingCampaignsService.remove(id, user);
  }
}
