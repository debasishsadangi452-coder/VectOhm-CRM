import { IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

export class UpdateArticleDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  content?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  category?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;
}
