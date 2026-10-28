import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from "class-validator";
import { TimeLogStatus } from "@prisma/client";

export class UpdateTimeLogDto {
  @IsOptional()
  @IsISO8601()
  date?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  minutes?: number;

  @IsOptional()
  @IsString()
  note?: string | null;

  // Review fields -- only ever set by a Manager/Admin reviewing someone
  // else's entry (see TimeLogsService.update). Never settable by the
  // logger themselves.
  @IsOptional()
  @IsEnum(TimeLogStatus)
  status?: TimeLogStatus;

  @IsOptional()
  @IsString()
  reviewNote?: string;
}
