import { IsEmail, IsOptional, IsString, IsUUID, Matches, MinLength } from "class-validator";

// Must match exactly what CareersController.uploadResume() (and
// CandidatesController.uploadResume()) hand back: /candidates/resumes/
// followed by a randomUUID() filename from CandidateStorageService --
// see candidate-storage.service.ts. This is a PUBLIC, unauthenticated
// endpoint, so resumeUrl can't be trusted as an arbitrary string the way
// the internal, staff-only CreateCandidateDto currently treats it -- an
// anonymous caller (bypassing the frontend entirely) could otherwise plant
// a javascript:/data: URI or a phishing link that later executes or
// redirects when a recruiter opens the "resume" from inside the CRM.
const RESUME_URL_PATTERN =
  /^\/candidates\/resumes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,5}$/;

export class SubmitApplicationDto {
  @IsUUID()
  jobPostingId!: string;

  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  @Matches(RESUME_URL_PATTERN, { message: "resumeUrl must be a resume uploaded through /careers/apply/upload-resume" })
  resumeUrl?: string;

  // Which board's link the applicant actually clicked (?source=linkedin,
  // etc. -- see careers-url.util.ts on the syndication side). Defaults to
  // "careers_site" for someone who found the page directly.
  @IsOptional()
  @IsString()
  source?: string;

  // Spam trap: a hidden form field real applicants never see or fill in
  // (see careers.$jobId.tsx). Any non-empty value here means a bot filled
  // every field -- accepted with a normal-looking response, but silently
  // dropped rather than saved as a Candidate.
  @IsOptional()
  @IsString()
  honeypot?: string;

  @IsOptional()
  @IsString()
  gclid?: string;

  @IsOptional()
  @IsString()
  utmSource?: string;

  @IsOptional()
  @IsString()
  utmCampaign?: string;
}
