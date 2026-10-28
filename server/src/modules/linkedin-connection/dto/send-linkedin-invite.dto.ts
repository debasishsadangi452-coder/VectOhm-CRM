import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class SendLinkedInInviteDto {
  @IsNotEmpty()
  @IsString()
  targetUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300, { message: "LinkedIn invitation notes must be 300 characters or fewer." })
  message?: string;

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
