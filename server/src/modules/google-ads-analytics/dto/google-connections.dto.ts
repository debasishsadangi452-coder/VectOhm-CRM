import { IsBoolean, IsOptional, IsString } from "class-validator";

export class ConnectGoogleAdsDto {
  @IsString()
  customerAccountId!: string;

  @IsOptional()
  @IsString()
  managerAccountId?: string;

  @IsOptional()
  @IsString()
  developerToken?: string;

  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsOptional()
  @IsString()
  conversionActionId?: string;

  @IsOptional()
  @IsBoolean()
  isSimulated?: boolean;
}

export class ConnectGa4Dto {
  @IsString()
  propertyId!: string;

  @IsOptional()
  @IsString()
  serviceAccountKeyJson?: string;

  @IsOptional()
  @IsBoolean()
  isSimulated?: boolean;
}
