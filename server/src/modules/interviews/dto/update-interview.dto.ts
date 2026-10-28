import { PartialType, OmitType } from "@nestjs/mapped-types";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { InterviewStatus } from "@prisma/client";
import { CreateInterviewDto } from "./create-interview.dto";

export class UpdateInterviewDto extends PartialType(OmitType(CreateInterviewDto, ["candidateId"] as const)) {
  @IsOptional()
  @IsEnum(InterviewStatus)
  status?: InterviewStatus;

  @IsOptional()
  @IsString()
  feedback?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
}
