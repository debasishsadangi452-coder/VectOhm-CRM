import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { ActivityType } from "@prisma/client";

export class UpdateActivityDto {
  @IsOptional()
  @IsEnum(ActivityType)
  type?: ActivityType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  content?: string;

  @IsOptional()
  @IsUUID()
  contactId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  outcome?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  durationMin?: number | null;

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}
