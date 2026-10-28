import { IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

// Used by Intent Hiring's per-lead "Find contact & send" action, for leads
// the live search didn't already resolve a decision-maker for (Apollo
// lookup failed, rate-limited, or simply hadn't finished at search time).
export class ResolveAndSendLeadDto {
  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @IsOptional()
  @IsString()
  companyDomain?: string;

  @IsUUID()
  sequenceId!: string;
}
