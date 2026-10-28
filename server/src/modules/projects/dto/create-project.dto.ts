import { IsEnum, IsISO8601, IsOptional, IsString, IsUUID, MinLength } from "class-validator";
import { ProjectStatus } from "@prisma/client";

export class CreateProjectDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  githubUrl?: string;

  @IsOptional()
  @IsString()
  projectPassword?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;
}
