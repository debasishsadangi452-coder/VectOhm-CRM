import { IsString, MinLength } from "class-validator";

export class ConnectApolloDto {
  @IsString()
  @MinLength(1)
  apiKey!: string;
}
