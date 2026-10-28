import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  domain?: string | null;

  @IsOptional()
  @IsString()
  industry?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
