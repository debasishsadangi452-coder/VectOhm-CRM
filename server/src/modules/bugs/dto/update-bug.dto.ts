import { IsArray, IsEnum, IsOptional, IsString, IsUUID, MinLength } from "class-validator";
import { BugPriority, BugSeverity, BugStatus } from "@prisma/client";

export class UpdateBugDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;

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

export class AddBugCommentDto {
  @IsString()
  @MinLength(1)
  content!: string;
}
