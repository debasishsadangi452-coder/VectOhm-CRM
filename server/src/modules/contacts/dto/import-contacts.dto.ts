import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";

// Loosely typed on purpose -- rows come straight from a spreadsheet a human
// exported, so email/phone/etc. may be malformed or missing entirely. The
// service does the real per-field sanity checking (see normalizeEmail in
// contacts.service.ts) and skips or coerces bad values rather than 400-ing
// the whole batch over one messy row.
export class ImportContactRowDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  linkedinUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  priority?: string;
}

export class ImportContactsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fileName!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => ImportContactRowDto)
  rows!: ImportContactRowDto[];
}
