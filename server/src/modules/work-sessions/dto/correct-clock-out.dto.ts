import { IsDateString, IsString, MaxLength, MinLength } from "class-validator";

export class CorrectClockOutDto {
  /** When the employee actually finished work (ISO date-time). */
  @IsDateString()
  clockOutAt!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(300)
  note!: string;
}
