import { IsIn } from "class-validator";

export const ERP_TENDER_STATUSES = ["NEW", "REVIEWING", "PURSUING", "DISMISSED"] as const;

export class UpdateErpTenderStatusDto {
  @IsIn(ERP_TENDER_STATUSES as unknown as string[])
  status!: (typeof ERP_TENDER_STATUSES)[number];
}
