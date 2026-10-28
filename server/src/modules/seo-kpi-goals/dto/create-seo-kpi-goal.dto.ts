import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateSeoKpiGoalDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  metricType!: string;

  @IsNumber()
  targetValue!: number;

  @IsOptional()
  @IsNumber()
  currentValue?: number;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
