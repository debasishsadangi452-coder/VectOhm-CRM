import { Type } from "class-transformer";
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class GenerateTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  goal!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  audience?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  language?: string;

  @IsOptional()
  @IsIn(["short", "medium", "long"])
  length?: "short" | "medium" | "long";
}

export class RewriteEmailDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  subject?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  body!: string;

  @IsIn(["SHORTER", "LONGER", "FRIENDLIER", "FORMAL", "FIX", "TRANSLATE", "CUSTOM"])
  instruction!: "SHORTER" | "LONGER" | "FRIENDLIER" | "FORMAL" | "FIX" | "TRANSLATE" | "CUSTOM";

  @IsOptional()
  @IsString()
  @MaxLength(50)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  custom?: string;
}

export class SuggestSubjectsDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  subject?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tone?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  count?: number;
}

export class PreviewRecipientDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  companyName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class PersonalizePreviewDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  subject!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  body!: string;

  @ValidateNested()
  @Type(() => PreviewRecipientDto)
  recipient!: PreviewRecipientDto;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string;
}
