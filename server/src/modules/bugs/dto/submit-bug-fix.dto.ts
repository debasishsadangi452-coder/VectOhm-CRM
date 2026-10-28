import { IsOptional, IsString, MinLength } from "class-validator";

export class SubmitBugFixDto {
  @IsString()
  @MinLength(2)
  fixSummary!: string;

  @IsOptional()
  @IsString()
  rootCause?: string;

  @IsOptional()
  @IsString()
  testingNotes?: string;

  @IsOptional()
  @IsString()
  prLink?: string;

  @IsOptional()
  @IsString()
  fixAttachmentUrl?: string;
}
