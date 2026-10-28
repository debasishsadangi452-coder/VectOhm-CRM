import { IsOptional, IsString, MinLength } from "class-validator";

export class UpdateGithubUsernameDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  githubUsername?: string | null;
}
