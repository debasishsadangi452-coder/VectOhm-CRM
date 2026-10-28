import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MinLength } from "class-validator";
import { ReleaseStatus } from "@prisma/client";

export class CreateReleaseDto {
  @IsString()
  @MinLength(1)
  versionName!: string;

  @IsOptional()
  @IsDateString()
  releaseDate?: string;

  @IsOptional()
  @IsEnum(ReleaseStatus)
  status?: ReleaseStatus;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
