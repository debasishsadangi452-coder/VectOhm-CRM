import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from "class-validator";
import { BacklinkVerificationStatus } from "@prisma/client";

export class CreateSeoBacklinkDto {
  @IsString()
  @MinLength(1)
  sourceUrl!: string;

  @IsString()
  @MinLength(1)
  targetUrl!: string;

  @IsOptional()
  @IsString()
  anchorText?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  domainAuthority?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  spamScore?: number;

  @IsOptional()
  @IsString()
  linkType?: string;

  @IsOptional()
  @IsEnum(BacklinkVerificationStatus)
  status?: BacklinkVerificationStatus;

  @IsOptional()
  @IsString()
  rejectionNote?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
