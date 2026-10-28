import { IsOptional, IsString, MinLength } from "class-validator";

export class ConnectJustCallDto {
  @IsString()
  @MinLength(1)
  apiKey!: string;

  @IsString()
  @MinLength(1)
  apiSecret!: string;

  // Optional: only JustCall plans/setups that issue a webhook signing secret
  // will have one. When absent, the webhook controller accepts unsigned
  // events and logs a warning, same fallback as the GitHub webhook.
  @IsOptional()
  @IsString()
  webhookSecret?: string;
}
