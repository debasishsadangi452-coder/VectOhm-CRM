import { PartialType, OmitType } from "@nestjs/mapped-types";
import { CreateCandidateDto } from "./create-candidate.dto";

// jobPostingId is allowed through (unlike departmentId) so a candidate can be
// re-submitted/reassigned to a different job posting -- see
// CandidatesService.update's re-parenting note.
export class UpdateCandidateDto extends PartialType(OmitType(CreateCandidateDto, ["departmentId"] as const)) {}
