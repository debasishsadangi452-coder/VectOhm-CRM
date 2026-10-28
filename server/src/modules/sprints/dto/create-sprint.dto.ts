import { IsISO8601, IsIn, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateSprintDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsISO8601()
  startDate!: string;

  @IsISO8601()
  endDate!: string;

  @IsString()
  @IsIn(["PLANNING", "ACTIVE", "COMPLETED"])
  status!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;
}
