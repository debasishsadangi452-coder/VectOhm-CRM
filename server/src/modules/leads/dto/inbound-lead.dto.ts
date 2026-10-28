import { IsOptional, IsString, MinLength } from "class-validator";

export class InboundLeadDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  contactNumber?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  businessUnit?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  message?: string;

  /**
   * Anti-spam honeypot field.
   * Legitimate web visitors will leave this blank (hidden in CSS).
   * Spambots that auto-fill every input field will populate it.
   */
  @IsOptional()
  @IsString()
  honeypot?: string;

  @IsOptional()
  @IsString()
  gclid?: string;

  @IsOptional()
  @IsString()
  wbraid?: string;

  @IsOptional()
  @IsString()
  gbraid?: string;

  @IsOptional()
  @IsString()
  utmSource?: string;

  @IsOptional()
  @IsString()
  utmMedium?: string;

  @IsOptional()
  @IsString()
  utmCampaign?: string;

  @IsOptional()
  @IsString()
  utmTerm?: string;

  @IsOptional()
  @IsString()
  utmContent?: string;

  @IsOptional()
  @IsString()
  landingPage?: string;
}
