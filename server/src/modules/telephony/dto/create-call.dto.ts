import { IsIn, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

// Created by the frontend the moment the JustCall Dialer SDK's dialNumber()
// fires -- see GlobalCallWidget. The SDK owns the actual audio/PSTN
// connection client-side; this row is just the CRM's record of "a call was
// placed," which the webhook handler then fills in (providerCallId, status,
// duration, recording) as JustCall's events arrive.
export class CreateCallDto {
  @IsString()
  @MinLength(3)
  toNumber!: string;

  // Optional: the JustCall Dialer SDK doesn't let our code pick/know the
  // agent's outbound caller-ID line up front (see Call.fromNumber comment
  // in schema.prisma) -- when the widget does have a best-effort guess
  // (the agent's first login_numbers entry) it's sent, otherwise the
  // webhook fills this in once JustCall reports the real value.
  @IsOptional()
  @IsString()
  @MinLength(3)
  fromNumber?: string;

  @IsOptional()
  @IsIn(["OUTBOUND", "INBOUND"])
  direction?: "OUTBOUND" | "INBOUND";

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  dealId?: string;

  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsOptional()
  @IsString()
  provider?: string;
}
