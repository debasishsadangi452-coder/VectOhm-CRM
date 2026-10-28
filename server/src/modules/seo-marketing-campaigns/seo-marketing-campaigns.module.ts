import { Module } from "@nestjs/common";
import { SeoMarketingCampaignsService } from "./seo-marketing-campaigns.service";
import { SeoMarketingCampaignsController } from "./seo-marketing-campaigns.controller";

@Module({
  controllers: [SeoMarketingCampaignsController],
  providers: [SeoMarketingCampaignsService],
})
export class SeoMarketingCampaignsModule {}
