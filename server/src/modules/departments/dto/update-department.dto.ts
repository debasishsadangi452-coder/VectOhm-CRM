import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from "class-validator";

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsUUID()
  headId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyTarget?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  dealApprovalThreshold?: number;
}
