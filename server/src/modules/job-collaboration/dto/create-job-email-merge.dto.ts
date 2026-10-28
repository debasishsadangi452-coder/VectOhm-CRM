import { IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateJobEmailMergeDto {
  @IsUUID()
  jobPostingId!: string;

  @IsString()
  @MinLength(1)
  subject!: string;

  @IsString()
  @MinLength(1)
  details!: string;

  @IsOptional()
  @IsString()
  sentBy?: string;

  @IsOptional()
  @IsString()
  sentTo?: string;

  @IsOptional()
  @IsString()
  searchString?: string;

  @IsOptional()
  @IsString()
  zipLocation?: string;
}
