import { IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from "class-validator";

export class CreateSeoKeywordDto {
  @IsString()
  @MinLength(1)
  term!: string;

  @IsOptional()
  @IsString()
  searchIntent?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  volume?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  difficulty?: number;

  @IsOptional()
  @IsInt()
  currentRank?: number;

  @IsOptional()
  @IsInt()
  targetRank?: number;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
