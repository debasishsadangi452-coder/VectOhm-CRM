import { IsEmail, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ConnectLinkedInDto {
  @IsEmail()
  accountEmail!: string;

  @IsOptional()
  @IsString()
  accountName?: string;

  @IsOptional()
  @IsString()
  profileUrl?: string;

  @IsOptional()
  @IsString()
  profilePicUrl?: string;

  @IsOptional()
  @IsString()
  profileUrn?: string;

  @IsOptional()
  @IsString()
  accessToken?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  dailyInviteLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(150)
  dailyMessageLimit?: number;
}
