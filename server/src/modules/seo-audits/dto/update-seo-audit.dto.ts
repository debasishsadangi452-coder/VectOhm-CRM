import { PartialType, OmitType } from "@nestjs/mapped-types";
import { CreateSeoAuditDto } from "./create-seo-audit.dto";

export class UpdateSeoAuditDto extends PartialType(OmitType(CreateSeoAuditDto, ["departmentId"] as const)) {}
