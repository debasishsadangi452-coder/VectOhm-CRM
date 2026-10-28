import { IsEnum, IsISO8601, IsOptional, IsString, MinLength } from "class-validator";
import { LeaveType } from "@prisma/client";

export class CreateLeaveRequestDto {
  @IsEnum(LeaveType)
  type!: LeaveType;

  @IsISO8601()
  startDate!: string;

  @IsISO8601()
  endDate!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  reason?: string;
}
