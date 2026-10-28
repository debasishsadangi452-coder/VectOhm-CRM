import { IsNotEmpty, IsOptional, IsString, Max, Min } from "class-validator";
import { Type } from "class-transformer";

export class IntentHiringSearchDto {
  @IsString()
  @IsNotEmpty()
  role!: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(50)
  maxResults?: number = 25;
}
