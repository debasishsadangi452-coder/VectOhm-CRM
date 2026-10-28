import { IsEnum, IsOptional, IsString } from "class-validator";

export enum BugReviewDecision {
  APPROVE = "APPROVE",
  REJECT = "REJECT",
  REQUEST_CHANGES = "REQUEST_CHANGES",
}

export class ReviewBugFixDto {
  @IsEnum(BugReviewDecision)
  decision!: BugReviewDecision;

  @IsOptional()
  @IsString()
  managerComments?: string;
}
