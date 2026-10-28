import { PartialType, OmitType } from "@nestjs/mapped-types";
import { CreateSeoMarketingCampaignDto } from "./create-seo-marketing-campaign.dto";

export class UpdateSeoMarketingCampaignDto extends PartialType(
  OmitType(CreateSeoMarketingCampaignDto, ["departmentId"] as const),
) {}
