import { IsOptional, IsString, MinLength } from "class-validator";

export class ConnectCloudTalkDto {
  @IsString()
  @MinLength(1)
  apiKeyId!: string;

  @IsString()
  @MinLength(1)
  apiKeySecret!: string;

  // Optional webhook secret / token used to verify inbound CloudTalk webhooks
  @IsOptional()
  @IsString()
  webhookSecret?: string;
}
