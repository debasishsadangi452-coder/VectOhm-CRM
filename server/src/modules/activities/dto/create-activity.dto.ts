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

export class CreateActivityDto {
  @IsUUID()
  dealId!: string;

  @IsEnum(ActivityType)
  type!: ActivityType;

  @IsString()
  @MinLength(1)
  content!: string;

  // Who was actually spoken to. Nullable so a note about nobody in particular
  // still logs cleanly.
  @IsOptional()
  @IsUUID()
  contactId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  outcome?: string | null;

  // Capped at a 24-hour call -- anything longer is a typo, not a meeting.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  durationMin?: number | null;

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}
