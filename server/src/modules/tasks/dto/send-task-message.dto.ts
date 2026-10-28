import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from "class-validator";
import { TaskMessageType } from "@prisma/client";

export class SendTaskMessageDto {
  @IsString()
  @MinLength(1)
  message!: string;

  @IsOptional()
  @IsEnum(TaskMessageType)
  messageType?: TaskMessageType;

  @IsOptional()
  @IsUUID()
  recipientId?: string;
}
