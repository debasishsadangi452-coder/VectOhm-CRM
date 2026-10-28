import { IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateJobSubmissionDto {
  @IsUUID()
  jobPostingId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  status!: string;

  @IsOptional()
  @IsUUID()
  candidateId?: string;

  @IsOptional()
  @IsString()
  submittedBy?: string;

  @IsOptional()
  @IsString()
  contact?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  statusLabel?: string;

  @IsOptional()
  @IsString()
  payRate?: string;

  @IsOptional()
  @IsString()
  billRate?: string;
}
