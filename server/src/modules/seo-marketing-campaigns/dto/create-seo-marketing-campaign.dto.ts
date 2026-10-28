import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from "class-validator";

const CAMPAIGN_STATUSES = ["ACTIVE", "PAUSED", "COMPLETED"] as const;

export class CreateSeoMarketingCampaignDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budget?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  spent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  targetLeads?: number;

  @IsOptional()
  @IsIn(CAMPAIGN_STATUSES)
  status?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
