import { IsInt, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateTaskListDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsInt()
  position?: number;
}
