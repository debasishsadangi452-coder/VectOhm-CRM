import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, MinLength, Matches } from "class-validator";
import { SHIFT_TIME_RE } from "../../work-sessions/work-policy";
import { RoleName } from "@prisma/client";

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string | null;

  @IsOptional()
  @IsString()
  githubUsername?: string | null;

  @IsOptional()
  @IsEnum(RoleName)
  role?: RoleName;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Admin only (enforced in UsersService.update): false stops this person's screen recording.
  @IsOptional()
  @IsBoolean()
  screenRecordingEnabled?: boolean;

  // Admin only (enforced in UsersService.update): true lets this person sign out.
  @IsOptional()
  @IsBoolean()
  canSignOut?: boolean;

  // Admin only (enforced in UsersService.update). true = exactly `modules`; false = the role/department default.
  @IsOptional()
  @IsBoolean()
  modulesCustomized?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modules?: string[];

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsUUID()
  managerId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyTarget?: number | null;

  @IsOptional()
  @Matches(SHIFT_TIME_RE, { message: "shiftStart must be HH:MM (24h)" })
  shiftStart?: string;

  @IsOptional()
  @Matches(SHIFT_TIME_RE, { message: "shiftEnd must be HH:MM (24h)" })
  shiftEnd?: string;
}
