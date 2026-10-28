import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateCallDispositionDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  disposition?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @IsOptional()
  @IsDateString()
  nextFollowUpAt?: string;
}
