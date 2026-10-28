import { PartialType, OmitType } from "@nestjs/mapped-types";
import { CreateSeoContentBriefDto } from "./create-seo-content-brief.dto";

export class UpdateSeoContentBriefDto extends PartialType(
  OmitType(CreateSeoContentBriefDto, ["departmentId"] as const),
) {}
