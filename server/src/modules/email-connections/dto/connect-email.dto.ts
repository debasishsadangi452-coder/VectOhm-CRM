import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from "class-validator";

export class ConnectEmailDto {
  @IsString()
  @MinLength(1)
  smtpHost!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort!: number;

  @IsBoolean()
  smtpSecure!: boolean;

  @IsString()
  @MinLength(1)
  smtpUsername!: string;

  // Optional on update: omitting it re-verifies and re-saves using the
  // password already on file (see EmailConnectionsService.connect), so
  // changing e.g. the From name doesn't force re-entering a password.
  @IsOptional()
  @IsString()
  @MinLength(1)
  smtpPassword?: string;

  @IsOptional()
  @IsString()
  fromName?: string;

  @IsEmail()
  fromEmail!: string;

  @IsOptional()
  @IsString()
  connectionId?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsBoolean()
  setAsDefault?: boolean;
}
