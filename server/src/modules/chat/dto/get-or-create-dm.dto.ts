import { IsUUID } from "class-validator";

export class GetOrCreateDmDto {
  @IsUUID()
  recipientId!: string;
}
