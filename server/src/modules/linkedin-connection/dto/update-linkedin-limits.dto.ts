import { IsInt, IsOptional, Max, Min } from "class-validator";

export class UpdateLinkedInLimitsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  dailyInviteLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(150)
  dailyMessageLimit?: number;
}
