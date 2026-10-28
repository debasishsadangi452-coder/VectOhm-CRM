import { IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateJobNoteDto {
  @IsUUID()
  jobPostingId!: string;

  @IsString()
  @MinLength(1)
  text!: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  addedBy?: string;
}
