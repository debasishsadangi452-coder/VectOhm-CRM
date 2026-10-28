import { IsBoolean, IsOptional, IsString } from "class-validator";

export class UpdatePhoneNumberDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  departmentId?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
