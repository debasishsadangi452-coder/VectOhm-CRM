import { IsArray, IsBoolean, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateHiringSignalAutomationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  industries?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  locations?: string[];

  @IsOptional()
  @IsString()
  keywords?: string;

  @IsOptional()
  @IsBoolean()
  adzunaEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  adzunaRoleKeywords?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetTitles?: string[];

  @IsUUID()
  sequenceId!: string;
}
