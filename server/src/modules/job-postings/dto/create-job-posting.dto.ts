import { IsArray, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, MinLength } from "class-validator";
import { EmploymentType, JobPostingStatus } from "@prisma/client";

export class CreateJobPostingDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  location?: string;

  // Ceipal-style job-postings view fields (src/components/ceipal)
  @IsOptional()
  @IsString()
  client?: string;

  @IsOptional()
  @IsString()
  clientJobId?: string;

  @IsOptional()
  @IsString()
  businessUnit?: string;

  @IsOptional()
  @IsString()
  states?: string;

  @IsOptional()
  @IsString()
  clientBillRate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sources?: string[];

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  clearance?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  // { linkedin: bool, indeed: bool, ziprecruiter: bool, glassdoor: bool } --
  // manual publish/unpublish toggle, see schema.prisma's JobPosting.boardStatus.
  @IsOptional()
  @IsObject()
  boardStatus?: Record<string, boolean>;

  @IsOptional()
  @IsString()
  recruitmentManager?: string;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @IsOptional()
  @IsEnum(JobPostingStatus)
  status?: JobPostingStatus;

  @IsOptional()
  @IsInt()
  targetHeadcount?: number;

  @IsOptional()
  @IsNumber()
  budgetMin?: number;

  @IsOptional()
  @IsNumber()
  budgetMax?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  salaryPeriod?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skillsRequired?: string[];

  @IsOptional()
  @IsNumber()
  minExperienceYears?: number;

  @IsOptional()
  @IsUUID()
  hiringDepartmentId?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
