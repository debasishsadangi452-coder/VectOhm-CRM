import { IsString, MinLength } from "class-validator";

export class CreateContentBriefQaCheckDto {
  @IsString()
  @MinLength(1)
  checkItem!: string;
}
