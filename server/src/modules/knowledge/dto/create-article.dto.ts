import { IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateArticleDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;
}
