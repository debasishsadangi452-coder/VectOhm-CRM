import { IsIn, IsNotEmpty, IsOptional, IsString, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import { NEWS_SIGNAL_CATEGORIES, type NewsSignalCategory } from "../news-signal.util";

export class IntentNewsSearchDto {
  // Industry / topic to watch, e.g. "fintech", "SaaS", "healthcare AI".
  @IsString()
  @IsNotEmpty()
  keywords!: string;

  @IsString()
  @IsOptional()
  location?: string;

  // Omitted = any recognised signal.
  @IsOptional()
  @IsIn([...NEWS_SIGNAL_CATEGORIES])
  category?: NewsSignalCategory;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(90)
  daysBack?: number = 30;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(50)
  maxResults?: number = 25;
}
