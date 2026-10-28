import { IsArray, IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class SendDirectEmailDto {
  // Can be a single email or array of emails
  @IsString()
  @MinLength(1)
  to!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cc?: string[];

  @IsString()
  subject!: string;

  @IsOptional()
  @IsString()
  bodyHtml?: string;

  @IsOptional()
  @IsString()
  bodyText?: string;

  @IsOptional()
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsString()
  dealId?: string;
}
