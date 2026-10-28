import { IsEmail, IsOptional, IsString, IsUUID } from "class-validator";

export class UpdateContactDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  title?: string | null;

  @IsOptional()
  @IsUUID()
  companyId?: string | null;

  @IsOptional()
  @IsString()
  location?: string | null;

  @IsOptional()
  @IsString()
  website?: string | null;

  @IsOptional()
  @IsString()
  linkedinUrl?: string | null;

  @IsOptional()
  @IsString()
  category?: string | null;

  @IsOptional()
  @IsString()
  priority?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
