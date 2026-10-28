import { IsBoolean, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateJobTaskDto {
  @IsUUID()
  jobPostingId!: string;

  @IsString()
  @MinLength(1)
  taskName!: string;

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  timeZone?: string;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsString()
  assignedBy?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
