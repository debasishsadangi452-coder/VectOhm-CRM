import { PartialType, OmitType } from "@nestjs/mapped-types";
import { CreateSeoKpiGoalDto } from "./create-seo-kpi-goal.dto";

export class UpdateSeoKpiGoalDto extends PartialType(
  OmitType(CreateSeoKpiGoalDto, ["departmentId"] as const),
) {}
