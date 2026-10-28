import { PartialType, OmitType } from "@nestjs/mapped-types";
import { CreateSeoBacklinkDto } from "./create-seo-backlink.dto";

export class UpdateSeoBacklinkDto extends PartialType(
  OmitType(CreateSeoBacklinkDto, ["departmentId"] as const),
) {}
