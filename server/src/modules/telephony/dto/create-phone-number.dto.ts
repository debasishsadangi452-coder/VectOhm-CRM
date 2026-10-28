import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class CreatePhoneNumberDto {
  @IsString()
  @MinLength(1)
  providerId!: string;

  @IsString()
  @MinLength(1)
  e164!: string;

  @IsString()
  @MinLength(2)
  country!: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsBoolean()
  smsCapable?: boolean;
}
