import { IsBoolean, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateClientDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  contactNumber?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  businessUnit?: string;

  @IsOptional()
  @IsBoolean()
  displayOnJob?: boolean;

  @IsOptional()
  @IsUUID()
  primaryOwnerId?: string;
}
