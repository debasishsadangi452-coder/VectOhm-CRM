import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { EmailTemplateVisibility } from "@prisma/client";

export class CreateEmailTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject!: string;

  @IsString()
  @MinLength(1)
  bodyHtml!: string;

  // Appends the sender's own signature at send time -- see composeEmailHtml.
  @IsOptional()
  @IsBoolean()
  appendSignature?: boolean;

  // Who can use it besides you. Defaults to PRIVATE (only you).
  @IsOptional()
  @IsEnum(EmailTemplateVisibility)
  visibility?: EmailTemplateVisibility;

  // The first draft was written by the AI.
  @IsOptional()
  @IsBoolean()
  aiGenerated?: boolean;
}
