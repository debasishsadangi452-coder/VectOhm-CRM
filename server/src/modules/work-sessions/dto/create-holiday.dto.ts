import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class CreateHolidayDto {
  /** Calendar day in the company timezone, YYYY-MM-DD. */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "date must be YYYY-MM-DD" })
  date!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;
}
