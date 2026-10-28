import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class IntentLeadDecisionMakerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  email?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  phoneType?: string | null;

  @IsOptional()
  @IsString()
  linkedinUrl?: string | null;
}

export class IntentLeadItemDto {
  @IsString()
  companyName!: string;

  @IsOptional()
  @IsString()
  companyDomain?: string;

  @IsOptional()
  @IsString()
  companyLocation?: string;

  @IsString()
  jobTitle!: string;

  @IsOptional()
  @IsString()
  jobUrl?: string;

  @IsOptional()
  @IsString()
  salary?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => IntentLeadDecisionMakerDto)
  decisionMaker?: IntentLeadDecisionMakerDto;
}

export class AutomateIntentEmailDto {
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsOptional()
  @IsString()
  campaignName?: string;

  @IsOptional()
  @IsString()
  customSubject?: string;

  @IsOptional()
  @IsString()
  customBodyHtml?: string;

  @IsOptional()
  @IsBoolean()
  appendSignature?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IntentLeadItemDto)
  leads!: IntentLeadItemDto[];
}
