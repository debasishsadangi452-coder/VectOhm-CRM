import { IsEnum, IsISO8601, IsOptional, IsString, IsUUID, MinLength } from "class-validator";
import { ProjectStatus } from "@prisma/client";

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsISO8601()
  startDate?: string | null;

  @IsOptional()
  @IsISO8601()
  dueDate?: string | null;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsString()
  githubUrl?: string | null;

  @IsOptional()
  @IsString()
  projectPassword?: string | null;
}
