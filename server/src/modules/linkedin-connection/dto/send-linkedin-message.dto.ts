import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class SendLinkedInMessageDto {
  @IsNotEmpty()
  @IsString()
  targetUrl!: string;

  @IsNotEmpty()
  @IsString()
  message!: string;

  @IsOptional()
  @IsString()
  leadId?: string;

  @IsOptional()
  @IsString()
  candidateId?: string;

  @IsOptional()
  @IsString()
  contactId?: string;
}
