import { PartialType, OmitType } from "@nestjs/mapped-types";
import { CreateEpicDto } from "./create-epic.dto";

export class UpdateEpicDto extends PartialType(OmitType(CreateEpicDto, ["departmentId"] as const)) {}
