import { IsInt, IsUUID, Min } from "class-validator";

export class CreateSequenceStepDto {
  @IsUUID()
  templateId!: string;

  // Days after the previous step (or after enrollment, for the first step).
  @IsInt()
  @Min(0)
  delayDays!: number;
}
