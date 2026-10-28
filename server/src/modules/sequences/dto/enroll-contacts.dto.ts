import { ArrayMinSize, IsArray, IsUUID } from "class-validator";

export class EnrollContactsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  contactIds!: string[];
}
