import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { OfferStatus } from "@prisma/client";

export class CreateOfferDto {
  @IsUUID()
  candidateId!: string;

  @IsInt()
  @Min(0)
  salary!: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsEnum(OfferStatus)
  status?: OfferStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  // Ceipal-style placement-record billing fields (src/components/ceipal)
  @IsOptional()
  @IsString()
  placementCode?: string;

  @IsOptional()
  @IsString()
  placementType?: string;

  @IsOptional()
  @IsString()
  clientPrimeVendor?: string;

  @IsOptional()
  @IsString()
  businessUnit?: string;

  @IsOptional()
  @IsString()
  clientBillRate?: string;

  @IsOptional()
  @IsString()
  payRate?: string;

  @IsOptional()
  @IsString()
  perDiemHr?: string;

  @IsOptional()
  @IsString()
  overhead?: string;

  @IsOptional()
  @IsString()
  margin?: string;
}
