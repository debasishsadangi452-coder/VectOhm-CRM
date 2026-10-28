import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from "class-validator";
import { EboardingStatus } from "@prisma/client";

export class EboardingChecklistItemDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsBoolean()
  completed!: boolean;
}

export class CreateEboardingDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsEmail()
  alternateEmail?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  zipCode?: string;

  @IsOptional()
  @IsString()
  streetAddress?: string;

  @IsOptional()
  @IsString()
  employmentType?: string;

  @IsOptional()
  @IsString()
  onboardingCode?: string;

  @IsOptional()
  @IsString()
  taxTerms?: string;

  @IsOptional()
  @IsString()
  vendorName?: string;

  @IsOptional()
  @IsEmail()
  vendorEmail?: string;

  @IsOptional()
  @IsString()
  atsBu?: string;

  @IsOptional()
  @IsString()
  client?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  joiningDate?: string;

  @IsOptional()
  @IsString()
  billRate?: string;

  @IsOptional()
  @IsString()
  payRate?: string;

  @IsOptional()
  @IsString()
  placementType?: string;

  @IsOptional()
  @IsString()
  comments?: string;

  @IsOptional()
  @IsEnum(EboardingStatus)
  status?: EboardingStatus;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EboardingChecklistItemDto)
  checklist?: EboardingChecklistItemDto[];

  @IsOptional()
  @IsString()
  initiatedOn?: string;
}
