import { IsArray, IsBoolean, IsEmail, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, MinLength, Matches } from "class-validator";
import { SHIFT_TIME_RE } from "../../work-sessions/work-policy";
import { RoleName } from "@prisma/client";

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsEnum(RoleName)
  role!: RoleName;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  githubUsername?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  managerId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyTarget?: number;

  @IsOptional()
  @Matches(SHIFT_TIME_RE, { message: "shiftStart must be HH:MM (24h)" })
  shiftStart?: string;

  @IsOptional()
  @Matches(SHIFT_TIME_RE, { message: "shiftEnd must be HH:MM (24h)" })
  shiftEnd?: string;

  // Admin only. true = they get exactly `modules`; false/omitted = the default for their role and department.
  @IsOptional()
  @IsBoolean()
  modulesCustomized?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modules?: string[];
}
