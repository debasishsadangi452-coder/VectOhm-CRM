import { ArrayMaxSize, ArrayMinSize, IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

// A private group chat with an explicit member list. The creator is added as the first
// group admin automatically, so memberIds only lists the OTHER people.
export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(255)
  @IsUUID("all", { each: true })
  memberIds!: string[];
}
