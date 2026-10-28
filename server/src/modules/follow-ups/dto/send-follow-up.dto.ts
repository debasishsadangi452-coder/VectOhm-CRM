import { IsString, MinLength } from "class-validator";

export class SendFollowUpDto {
  @IsString()
  @MinLength(1)
  subject!: string;

  @IsString()
  @MinLength(1)
  body!: string;
}
