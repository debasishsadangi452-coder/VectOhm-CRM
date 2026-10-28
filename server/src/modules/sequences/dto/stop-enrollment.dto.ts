import { IsOptional, IsString } from "class-validator";

export class StopEnrollmentDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
