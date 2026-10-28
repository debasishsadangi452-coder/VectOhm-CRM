import { ArrayNotEmpty, IsUUID } from "class-validator";

export class AssignTasksDto {
  @ArrayNotEmpty()
  @IsUUID("4", { each: true })
  taskIds!: string[];
}
