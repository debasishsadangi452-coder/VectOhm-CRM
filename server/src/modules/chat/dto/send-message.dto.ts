import { ArrayMaxSize, IsArray, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  content!: string;

  // People @mentioned in the message; they get a distinct notification (and sound) on top of the normal one.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  mentionIds?: string[];
}
