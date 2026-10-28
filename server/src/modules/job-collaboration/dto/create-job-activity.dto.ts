import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from "class-validator";
import { JobActivityType } from "@prisma/client";

export class CreateJobActivityDto {
  @IsUUID()
  jobPostingId!: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsOptional()
  @IsString()
  user?: string;

  @IsOptional()
  @IsEnum(JobActivityType)
  type?: JobActivityType;
}
