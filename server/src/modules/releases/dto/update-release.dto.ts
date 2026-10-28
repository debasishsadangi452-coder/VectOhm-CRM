import { PartialType, OmitType } from "@nestjs/mapped-types";
import { CreateReleaseDto } from "./create-release.dto";

export class UpdateReleaseDto extends PartialType(OmitType(CreateReleaseDto, ["departmentId"] as const)) {}
