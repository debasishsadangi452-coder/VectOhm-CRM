import { IsInt, IsOptional, Min } from "class-validator";

export class UpdateDepartmentSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyTarget?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  dealApprovalThreshold?: number;
}
