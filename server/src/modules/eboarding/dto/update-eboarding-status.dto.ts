import { IsEnum } from "class-validator";
import { EboardingStatus } from "@prisma/client";

export class UpdateEboardingStatusDto {
  @IsEnum(EboardingStatus)
  status!: EboardingStatus;
}
