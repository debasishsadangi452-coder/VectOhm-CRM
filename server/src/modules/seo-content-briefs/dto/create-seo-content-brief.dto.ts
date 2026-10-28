import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from "class-validator";
import { ContentBriefStatus, SlaStatus } from "@prisma/client";

export class CreateSeoContentBriefDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  targetKeyword!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  secondaryKeywords?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  targetWordCount?: number;

  @IsOptional()
  @IsString()
  outlineJson?: string;

  @IsOptional()
  @IsEnum(ContentBriefStatus)
  status?: ContentBriefStatus;

  @IsOptional()
  @IsEnum(SlaStatus)
  slaStatus?: SlaStatus;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsDateString()
  publishDate?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsUUID()
  reviewerId?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
