import { IsIn } from "class-validator";

export const ERP_BUYER_SIGNAL_STATUSES = ["NEW", "REVIEWING", "PURSUING", "DISMISSED"] as const;

export class UpdateErpBuyerSignalStatusDto {
  @IsIn(ERP_BUYER_SIGNAL_STATUSES as unknown as string[])
  status!: (typeof ERP_BUYER_SIGNAL_STATUSES)[number];
}
