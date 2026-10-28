import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { FollowUpMode, SequenceStatus } from "@prisma/client";

export class UpdateSequenceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(SequenceStatus)
  status?: SequenceStatus;

  // Opt-in escalation for the follow-up nudge scheduled when a recipient
  // opens a step's email -- see FollowUpMode's doc comment in schema.prisma.
  @IsOptional()
  @IsEnum(FollowUpMode)
  followUpMode?: FollowUpMode;
}
