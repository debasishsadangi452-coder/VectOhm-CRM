import { IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  headId?: string;
}
