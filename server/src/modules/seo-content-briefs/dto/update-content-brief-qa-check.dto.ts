import { IsBoolean } from "class-validator";

export class UpdateContentBriefQaCheckDto {
  @IsBoolean()
  isPassed!: boolean;
}
