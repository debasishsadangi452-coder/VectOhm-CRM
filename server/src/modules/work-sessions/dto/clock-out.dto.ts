import { IsOptional, IsString, MaxLength } from "class-validator";

export class ClockOutDto {
  /** Required by the service only when clocking out before shift end. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
