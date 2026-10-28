import { IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

export class CreateTimeLogDto {
  @IsUUID()
  taskId!: string;

  @IsISO8601()
  date!: string;

  // Capped at 24h -- a single day's log entry, not a running total.
  @IsInt()
  @Min(1)
  @Max(1440)
  minutes!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
