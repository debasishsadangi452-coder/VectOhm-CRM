import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from "class-validator";
import { TaskPriority, TaskStatus, TaskType } from "@prisma/client";

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsUUID()
  projectId?: string | null;

  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;

  @IsOptional()
  @IsISO8601()
  dueDate?: string | null;

  @IsOptional()
  @IsInt()
  position?: number;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsInt()
  storyPoints?: number | null;

  @IsOptional()
  @IsEnum(TaskType)
  type?: TaskType;

  @IsOptional()
  @IsUUID()
  sprintId?: string | null;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @IsUUID()
  taskListId?: string | null;

  @IsOptional()
  @IsISO8601()
  startDate?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  assigneeIds?: string[];

  @IsOptional()
  @IsUUID()
  testerId?: string | null;

  @IsOptional()
  @IsString()
  testingNotes?: string | null;

  @IsOptional()
  testingApproved?: boolean;
}
