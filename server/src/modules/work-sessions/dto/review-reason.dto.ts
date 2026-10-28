import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class ReviewReasonDto {
  /** Which reason is being reviewed. */
  @IsIn(["LATE", "EARLY"])
  kind!: "LATE" | "EARLY";

  /** PENDING clears an earlier decision. */
  @IsIn(["EXCUSED", "REJECTED", "PENDING"])
  status!: "EXCUSED" | "REJECTED" | "PENDING";

  /** Required when rejecting; optional otherwise. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
