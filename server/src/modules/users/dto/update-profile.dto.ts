import { IsOptional, IsString, MinLength } from "class-validator";

// Self-service: a user editing their OWN profile. Deliberately excludes
// role / department / manager / isActive / monthlyTarget (management-only),
// EMAIL (the login identifier -- never changeable), and password (changed
// only via the emailed reset-link flow, see auth password reset).
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string | null;
}
