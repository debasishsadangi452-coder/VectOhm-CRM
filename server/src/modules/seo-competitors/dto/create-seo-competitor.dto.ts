import { IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from "class-validator";

export class CreateSeoCompetitorDto {
  @IsString()
  @MinLength(1)
  domain!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  da?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  traffic?: number;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
