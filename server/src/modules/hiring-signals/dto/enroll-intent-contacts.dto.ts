import { IsArray, IsNotEmpty, IsString } from "class-validator";

export class EnrollIntentContactsDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  leadIds!: string[];

  @IsString()
  @IsNotEmpty()
  sequenceId!: string;
}
