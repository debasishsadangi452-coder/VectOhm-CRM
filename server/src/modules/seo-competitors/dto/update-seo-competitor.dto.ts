import { PartialType, OmitType } from "@nestjs/mapped-types";
import { CreateSeoCompetitorDto } from "./create-seo-competitor.dto";

export class UpdateSeoCompetitorDto extends PartialType(OmitType(CreateSeoCompetitorDto, ["departmentId"] as const)) {}
