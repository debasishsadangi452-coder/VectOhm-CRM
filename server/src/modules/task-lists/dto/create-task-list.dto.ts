import { IsString, IsUUID, MinLength } from "class-validator";

export class CreateTaskListDto {
  @IsUUID()
  projectId!: string;

  @IsString()
  @MinLength(1)
  name!: string;
}
