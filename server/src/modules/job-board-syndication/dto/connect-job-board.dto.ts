import { IsString, MinLength } from "class-validator";

export class ConnectJobBoardDto {
  @IsString()
  @MinLength(1)
  apiKey!: string;
}
