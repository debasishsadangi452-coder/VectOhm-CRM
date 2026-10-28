import { IsArray, IsInt, IsOptional, IsString, Max, Min, ValidateIf } from "class-validator";

// Ranges are enforced again (with a clearer message) by AttendancePolicyService,
// which is the single source of truth -- these only reject the wrong TYPES early.

export class UpdateAttendanceSettingsDto {
  @IsOptional() @IsInt() lateGraceMin?: number;
  @IsOptional() @IsInt() earlyGraceMin?: number;
  @IsOptional() @IsInt() idlePromptMin?: number;
  @IsOptional() @IsInt() absentAfterMin?: number;
  @IsOptional() @IsInt() maxOpenSessionHours?: number;
  @IsOptional() @IsInt() repeatLateThreshold?: number;
  @IsOptional() @IsInt() repeatLateWindowDays?: number;
  @IsOptional() @IsInt() minWorkMinutes?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weeklyOffDays?: number[];

  /** "YYYY-MM-DD", or null / "" to clear. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  absenceTrackingStart?: string | null;
}

/** null clears that field's override; omitted leaves it as it was. */
export class UpdateDeptPolicyDto {
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() lateGraceMin?: number | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() earlyGraceMin?: number | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() idlePromptMin?: number | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() absentAfterMin?: number | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() minWorkMinutes?: number | null;
}
