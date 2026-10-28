import { IsOptional, IsString } from "class-validator";

export class RequestTaskUpdateDto {
  @IsOptional()
  @IsString()
  note?: string;
}
