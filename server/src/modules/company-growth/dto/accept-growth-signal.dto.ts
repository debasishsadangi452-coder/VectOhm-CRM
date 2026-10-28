import { IsUUID } from "class-validator";

export class AcceptGrowthSignalDto {
  @IsUUID()
  sequenceId!: string;
}
