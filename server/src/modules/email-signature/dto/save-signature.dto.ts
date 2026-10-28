import { IsOptional, IsString, MaxLength } from "class-validator";

export class SaveSignatureDto {
  // Null or empty clears the signature. Capped so a pasted document can't be
  // stapled onto every outbound email.
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  html?: string | null;
}
