import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateAppSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(280)
  heroTagline?: string | null;
}
