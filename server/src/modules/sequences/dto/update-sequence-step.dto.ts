import { IsInt, IsOptional, IsUUID, Min } from "class-validator";

export class UpdateSequenceStepDto {
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  delayDays?: number;
}
