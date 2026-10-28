import { IsString, IsUrl, MinLength } from "class-validator";

export class ConnectAggregatorDto {
  @IsString()
  @MinLength(1)
  provider!: string;

  @IsUrl({ require_protocol: true, protocols: ["http", "https"] })
  baseUrl!: string;

  @IsString()
  @MinLength(1)
  apiKey!: string;
}
