import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from "class-validator";
import { SHIFT_TIME_RE } from "../work-policy";

export class CreateShiftTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @Matches(SHIFT_TIME_RE, { message: "shiftStart must be HH:MM (24h)" })
  shiftStart!: string;

  @Matches(SHIFT_TIME_RE, { message: "shiftEnd must be HH:MM (24h)" })
  shiftEnd!: string;
}

export class UpdateShiftTemplateDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(60) name?: string;
  @IsOptional() @Matches(SHIFT_TIME_RE, { message: "shiftStart must be HH:MM (24h)" }) shiftStart?: string;
  @IsOptional() @Matches(SHIFT_TIME_RE, { message: "shiftEnd must be HH:MM (24h)" }) shiftEnd?: string;
}

export class ApplyShiftTemplateDto {
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID(undefined, { each: true })
  userIds!: string[];
}
