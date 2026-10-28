import { IsDateString, IsInt, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class IdleEventDto {
  @IsDateString()
  idleStartedAt!: string;

  @IsInt()
  @Min(1)
  @Max(24 * 60)
  idleMinutes!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
