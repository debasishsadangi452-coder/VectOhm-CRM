import { IsEnum, IsString, MinLength } from "class-validator";
import { GithubAccountType } from "@prisma/client";

export class ConnectGithubDto {
  @IsEnum(GithubAccountType)
  accountType!: GithubAccountType;

  @IsString()
  @MinLength(1)
  accountLogin!: string;

  @IsString()
  @MinLength(1)
  token!: string;
}
