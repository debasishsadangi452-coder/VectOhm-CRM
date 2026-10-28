import { IsArray, IsOptional, IsString } from "class-validator";

export class EnrichIntentCompaniesDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  companyNames?: string[];

  @IsString()
  @IsOptional()
  autoEnrollSequenceId?: string;

  @IsString()
  @IsOptional()
  searchRecordId?: string;
}
