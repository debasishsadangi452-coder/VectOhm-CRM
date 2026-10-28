import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class IngestScrapedArticleDto {
  @IsString()
  @MaxLength(500)
  articleTitle!: string;

  @IsUrl()
  @MaxLength(2000)
  articleUrl!: string;

  @IsString()
  @MaxLength(255)
  sourceDomain!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  publishedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  rawContent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  keySnippet?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyDomain?: string;

  @IsOptional()
  @IsString()
  tier?: "ERP_AI_VIP" | "ENTERPRISE_HIGH" | "STANDARD_GROWTH";

  @IsOptional()
  @IsBoolean()
  isErpAiPriority?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  intentScore?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  erpVendors?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  aiKeywords?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  targetedRoles?: string[];

  @IsOptional()
  @IsBoolean()
  isHubPage?: boolean;

  @IsOptional()
  @IsBoolean()
  autoFindDecisionMakers?: boolean;

  @IsOptional()
  @IsBoolean()
  autoDraftEmail?: boolean;
}
