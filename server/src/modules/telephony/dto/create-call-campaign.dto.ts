import { ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateCallCampaignDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  contactIds!: string[];

  // If set, every lead is pre-assigned to this one agent. Left unset, leads
  // are unassigned and any Sales member can claim them via claimNext --
  // simplest possible "who works this list" model for a first pass; a real
  // round-robin distributor is a later refinement (see the plan's §13/§25).
  @IsOptional()
  @IsUUID()
  assignToId?: string;
}
