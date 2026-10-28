import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from "class-validator";

export class AddGroupMembersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(255)
  @IsUUID("all", { each: true })
  userIds!: string[];
}
