import { PartialType, OmitType } from "@nestjs/mapped-types";
import { CreateOfferDto } from "./create-offer.dto";

export class UpdateOfferDto extends PartialType(OmitType(CreateOfferDto, ["candidateId"] as const)) {}
