import { PartialType } from "@nestjs/mapped-types";
import { CreateEboardingDto } from "./create-eboarding.dto";

export class UpdateEboardingDto extends PartialType(CreateEboardingDto) {}
