import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { PartialType } from "@nestjs/mapped-types";
import { NEWS_SIGNAL_CATEGORIES } from "../news-signal.util";

export const INTENT_SOURCES = ["HIRING", "NEWS", "BOTH"] as const;
export const INTENT_FREQUENCIES = ["DAILY", "WEEKDAYS", "WEEKLY"] as const;

export class CreateIntentAutomationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @IsIn([...INTENT_SOURCES])
  source!: (typeof INTENT_SOURCES)[number];

  // Intent Hiring: job roles to search, one search each (max 5).
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  roles?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  location?: string;

  // Intent News: industry/topic, optional signal, window.
  @IsOptional()
  @IsString()
  @MaxLength(120)
  newsKeywords?: string;

  @IsOptional()
  @IsIn([...NEWS_SIGNAL_CATEGORIES])
  newsCategory?: string;

  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(90)
  newsDaysBack?: number;

  @IsIn([...INTENT_FREQUENCIES])
  frequency!: (typeof INTENT_FREQUENCIES)[number];

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "timeOfDay must be HH:MM (24h)" })
  timeOfDay!: string;

  // 0 = Sunday .. 6 = Saturday (WEEKLY only).
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weekday?: number;

  @IsOptional()
  @IsBoolean()
  autoSend?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  dailyCap?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  cooldownDays?: number;

  @IsString()
  @MinLength(20, { message: "Describe what you offer in at least a sentence" })
  @MaxLength(1500)
  offerDescription!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  tone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateIntentAutomationDto extends PartialType(CreateIntentAutomationDto) {}

export class UpdateOutreachDraftDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body?: string;
}
