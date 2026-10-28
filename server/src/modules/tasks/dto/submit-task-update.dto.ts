import { IsEnum, IsISO8601, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { TaskStatus } from "@prisma/client";

export class SubmitTaskUpdateDto {
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;

  @IsOptional()
  @IsString()
  workCompleted?: string;

  @IsOptional()
  @IsString()
  currentWork?: string;

  @IsOptional()
  @IsString()
  blockers?: string;

  @IsOptional()
  @IsISO8601()
  expectedCompletion?: string;

  @IsOptional()
  @IsString()
  additionalMessage?: string;
}
