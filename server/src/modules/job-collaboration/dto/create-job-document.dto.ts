import { IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateJobDocumentDto {
  @IsUUID()
  jobPostingId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  addedBy?: string;
}
