import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from "class-validator";
import { CandidateStage } from "@prisma/client";

export class CreateCandidateDto {
  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  // Ceipal-style applicants view fields (src/components/ceipal)
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsBoolean()
  isStarred?: boolean;

  @IsOptional()
  @IsString()
  resumeUrl?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  currentTitle?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalExperienceYears?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  currentSalary?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  expectedSalary?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  noticePeriodDays?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  educationDegree?: string;

  @IsOptional()
  @IsString()
  educationInstitution?: string;

  @IsOptional()
  @IsString()
  educationYear?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certifications?: string[];

  @IsOptional()
  @IsString()
  workAuthorization?: string;

  @IsOptional()
  @IsString()
  willingToRelocate?: string;

  @IsOptional()
  @IsEnum(CandidateStage)
  stage?: CandidateStage;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @IsUUID()
  jobPostingId!: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
