import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from "class-validator";
import { DealStage } from "@prisma/client";

export class UpdateDealDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  value?: number;

  @IsOptional()
  @IsEnum(DealStage)
  stage?: DealStage;

  @IsOptional()
  @IsInt()
  position?: number;

  @IsOptional()
  @IsUUID()
  companyId?: string | null;

  @IsOptional()
  @IsUUID()
  contactId?: string | null;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsISO8601()
  expectedCloseDate?: string | null;

  @IsOptional()
  @IsISO8601()
  followUpAt?: string | null;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;
}
