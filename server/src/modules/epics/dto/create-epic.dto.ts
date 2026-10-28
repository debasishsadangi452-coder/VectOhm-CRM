import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from "class-validator";
import { EpicStatus } from "@prisma/client";

export class CreateEpicDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(EpicStatus)
  status?: EpicStatus;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
