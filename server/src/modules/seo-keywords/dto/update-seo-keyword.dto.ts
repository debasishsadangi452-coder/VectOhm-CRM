import { PartialType, OmitType } from "@nestjs/mapped-types";
import { CreateSeoKeywordDto } from "./create-seo-keyword.dto";

export class UpdateSeoKeywordDto extends PartialType(
  OmitType(CreateSeoKeywordDto, ["departmentId"] as const),
) {}
