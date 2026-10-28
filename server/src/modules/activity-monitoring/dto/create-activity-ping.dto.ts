import { IsInt, IsOptional, Min } from "class-validator";

export class CreateActivityPingDto {
  @IsInt()
  @Min(0)
  idleSeconds!: number;

  // Plain counts of keydown/mousedown events since the previous ping --
  // never the key pressed or the click's coordinates/target. Optional so an
  // un-upgraded desktop agent build (pre-dating these fields) keeps working
  // during rollout; the service defaults missing values to 0.
  @IsOptional()
  @IsInt()
  @Min(0)
  keystrokeCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  clickCount?: number;
}
