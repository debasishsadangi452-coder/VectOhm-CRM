import { IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength } from "class-validator";

export class CreateSeoAuditDto {
  @IsString()
  @MinLength(1)
  url!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number;

  @IsString()
  issues!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
