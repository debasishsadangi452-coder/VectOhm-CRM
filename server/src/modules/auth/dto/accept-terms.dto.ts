import { IsString, MinLength } from "class-validator";

export class AcceptTermsDto {
  @IsString()
  @MinLength(1)
  version!: string;
}
