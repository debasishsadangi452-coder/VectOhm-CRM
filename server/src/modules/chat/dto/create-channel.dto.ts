import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

// Always creates a non-DM channel (see ChatService.createChannel, which
// hardcodes isDM: false) -- DMs go through the separate /chat/dms endpoint,
// so a name is always required here.
export class CreateChannelDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
