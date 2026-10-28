import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MinLength } from "class-validator";
import { TaskStatus } from "@prisma/client";

export class CreateCommitDto {
  @IsString()
  @MinLength(1)
  message!: string;

  @IsOptional()
  @IsString()
  branch?: string;

  @IsUUID()
  authorId!: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  moveTaskTo?: TaskStatus;

  @IsOptional()
  @IsBoolean()
  isPR?: boolean;
}
