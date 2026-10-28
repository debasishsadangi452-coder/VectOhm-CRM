import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { InterviewType } from "@prisma/client";

export class CreateInterviewDto {
  @IsUUID()
  candidateId!: string;

  @IsOptional()
  @IsUUID()
  interviewerId?: string;

  @IsOptional()
  @IsEnum(InterviewType)
  type?: InterviewType;

  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  location?: string;
}
