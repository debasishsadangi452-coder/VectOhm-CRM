import { IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, Min } from "class-validator";

export class UpdateTrainingVideoDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ["http", "https"] })
  url?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  category?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
