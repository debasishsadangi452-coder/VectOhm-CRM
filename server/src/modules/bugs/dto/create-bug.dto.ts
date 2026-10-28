import { IsArray, IsEnum, IsOptional, IsString, IsUUID, MinLength } from "class-validator";
import { BugPriority, BugSeverity, BugStatus } from "@prisma/client";

export class CreateBugDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUUID()
  taskId!: string;

  @IsOptional()
  @IsUUID()
  subtaskId?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsEnum(BugSeverity)
  severity?: BugSeverity;

  @IsOptional()
  @IsEnum(BugPriority)
  priority?: BugPriority;

  @IsOptional()
  @IsEnum(BugStatus)
  status?: BugStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}
