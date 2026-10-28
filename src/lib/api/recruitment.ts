import { apiFetch, apiFetchBlob, apiUploadForm } from "./client";
import type { PersonRef } from "./types";

export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP";
export type JobPostingStatus = "OPEN" | "ON_HOLD" | "CLOSED" | "FILLED";
export type CandidateStage =
  | "SOURCED"
  | "SCREENING"
  | "SHORTLISTED"
  | "INTERVIEW_SCHEDULED"
  | "INTERVIEWED"
  | "SELECTED"
  | "OFFER_RELEASED"
  | "OFFER_ACCEPTED"
  | "JOINED"
  | "REJECTED"
  | "ON_HOLD"
  | "APPLIED"
  | "INTERVIEW"
  | "OFFER"
  | "HIRED";

export type FitBadge = "PLATINUM_FIT" | "GOLD_FIT" | "SILVER_FIT" | "REVIEW_REQUIRED";
export type InterviewType = "PHONE_SCREEN" | "TECHNICAL" | "BEHAVIORAL" | "ONSITE" | "FINAL";
export type InterviewStatus = "SCHEDULED" | "COMPLETED" | "CANCELED" | "NO_SHOW";
export type OfferStatus = "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED" | "RESCINDED";

export const EMPLOYMENT_TYPES: EmploymentType[] = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"];
export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  INTERNSHIP: "Internship",
};

export const JOB_POSTING_STATUSES: JobPostingStatus[] = ["OPEN", "ON_HOLD", "CLOSED", "FILLED"];
export const JOB_POSTING_STATUS_LABELS: Record<JobPostingStatus, string> = {
  OPEN: "Open",
  ON_HOLD: "On hold",
  CLOSED: "Closed",
  FILLED: "Filled",
};

export const CANDIDATE_STAGES: CandidateStage[] = [
  "SOURCED",
  "SCREENING",
  "SHORTLISTED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEWED",
  "SELECTED",
  "OFFER_RELEASED",
  "OFFER_ACCEPTED",
  "JOINED",
  "REJECTED",
  "ON_HOLD",
];

export const CANDIDATE_STAGE_LABELS: Record<CandidateStage, string> = {
  SOURCED: "Sourced",
  SCREENING: "Screening",
  SHORTLISTED: "Shortlisted",
  INTERVIEW_SCHEDULED: "Interview Sched",
  INTERVIEWED: "Interviewed",
  SELECTED: "Selected",
  OFFER_RELEASED: "Offer Released",
  OFFER_ACCEPTED: "Offer Accepted",
  JOINED: "Joined",
  REJECTED: "Rejected",
  ON_HOLD: "On Hold",
  APPLIED: "Sourced",
  INTERVIEW: "Interviewed",
  OFFER: "Offer Released",
  HIRED: "Joined",
};

export const INTERVIEW_TYPES: InterviewType[] = ["PHONE_SCREEN", "TECHNICAL", "BEHAVIORAL", "ONSITE", "FINAL"];
export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  PHONE_SCREEN: "Phone screen",
  TECHNICAL: "Technical",
  BEHAVIORAL: "Behavioral",
  ONSITE: "Onsite",
  FINAL: "Final",
};

export const INTERVIEW_STATUSES: InterviewStatus[] = ["SCHEDULED", "COMPLETED", "CANCELED", "NO_SHOW"];
export const INTERVIEW_STATUS_LABELS: Record<InterviewStatus, string> = {
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  CANCELED: "Canceled",
  NO_SHOW: "No-show",
};

export const OFFER_STATUSES: OfferStatus[] = ["DRAFT", "SENT", "ACCEPTED", "DECLINED", "RESCINDED"];
export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  RESCINDED: "Rescinded",
};

export type JobBoard =
  | "LINKEDIN"
  | "NAUKRI"
  | "INDEED"
  | "GLASSDOOR"
  | "ZIPRECRUITER"
  | "MONSTER"
  | "DICE"
  | "SIMPLYHIRED"
  | "CAREERBUILDER"
  | "GOOGLE_JOBS";
export type JobBoardListingStatus = "PENDING" | "POSTED" | "FAILED";

export const JOB_BOARDS: JobBoard[] = [
  "LINKEDIN",
  "NAUKRI",
  "INDEED",
  "GLASSDOOR",
  "ZIPRECRUITER",
  "MONSTER",
  "DICE",
  "SIMPLYHIRED",
  "CAREERBUILDER",
  "GOOGLE_JOBS",
];
export const JOB_BOARD_LABELS: Record<JobBoard, string> = {
  LINKEDIN: "LinkedIn",
  NAUKRI: "Naukri",
  INDEED: "Indeed",
  GLASSDOOR: "Glassdoor",
  ZIPRECRUITER: "ZipRecruiter",
  MONSTER: "Monster",
  DICE: "Dice",
  SIMPLYHIRED: "SimplyHired",
  CAREERBUILDER: "CareerBuilder",
  GOOGLE_JOBS: "Google for Jobs",
};

export interface JobBoardListing {
  id: string;
  jobPostingId: string;
  board: JobBoard;
  status: JobBoardListingStatus;
  // True while this board is backed by a stub adapter rather than a real
  // partner API -- see server/src/modules/job-board-syndication.
  simulated: boolean;
  externalId: string | null;
  externalUrl: string | null;
  errorMessage: string | null;
  postedAt: string | null;
}

export interface JobPosting {
  id: string;
  jobCode?: string | null;
  title: string;
  description: string | null;
  location: string | null;
  employmentType: EmploymentType;
  status: JobPostingStatus;
  targetHeadcount?: number;
  filledHeadcount?: number;
  priority?: string;
  currency?: string;
  budgetMin?: number | null;
  budgetMax?: number | null;
  salaryPeriod?: string | null;
  skillsRequired?: string[];
  minExperienceYears?: number;
  boardListings: JobBoardListing[];
  hiringDepartmentId: string | null;
  hiringDepartment: { id: string; name: string } | null;
  departmentId: string | null;
  ownerId: string;
  owner: PersonRef;
  _count: { candidates: number };
  // Ceipal-style recruitment CRM display fields (src/components/ceipal)
  client?: string | null;
  clientJobId?: string | null;
  businessUnit?: string | null;
  states?: string | null;
  clientBillRate?: string | null;
  sources?: string[];
  industry?: string | null;
  clearance?: string | null;
  tags?: string[];
  boardStatus?: Record<string, boolean> | null;
  recruitmentManager?: string | null;
  assignedTo?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateJobPostingRef {
  id: string;
  title: string;
}

export interface Candidate {
  id: string;
  candidateCode?: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  currentCompany?: string | null;
  currentTitle?: string | null;
  totalExperienceYears?: number;
  currentSalary?: number | null;
  expectedSalary?: number | null;
  noticePeriodDays?: number;
  location?: string | null;
  skills?: string[];
  resumeUrl: string | null;
  source: string | null;
  jobBoardUrl?: string | null;
  stage: CandidateStage;
  position: number;
  rejectionReason: string | null;
  aiMatchScore?: number;
  fitBadge?: FitBadge;
  aiSummary?: string | null;
  summary?: string | null;
  educationDegree?: string | null;
  educationInstitution?: string | null;
  educationYear?: string | null;
  certifications?: string[];
  workAuthorization?: string | null;
  willingToRelocate?: string | null;
  jobPostingId: string;
  jobPosting: CandidateJobPostingRef;
  ownerId: string;
  owner: PersonRef;
  departmentId: string | null;
  // Ceipal-style applicants view fields (src/components/ceipal)
  city?: string | null;
  state?: string | null;
  isStarred?: boolean;
  badgeCount?: number;
  appliedAt: string;
  stageEnteredAt?: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateDetail extends Candidate {
  interviews: Interview[];
  offers: Offer[];
}

export interface Interview {
  id: string;
  candidateId: string;
  candidate: { id: string; firstName: string; lastName: string; jobPostingId: string };
  interviewerId: string | null;
  interviewer: PersonRef | null;
  createdById: string;
  createdBy: Pick<PersonRef, "id" | "firstName" | "lastName">;
  type: InterviewType;
  scheduledAt: string;
  durationMinutes: number;
  location: string | null;
  status: InterviewStatus;
  feedback: string | null;
  rating: number | null;
  departmentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Offer {
  id: string;
  candidateId: string;
  candidate: { id: string; firstName: string; lastName: string; jobPostingId: string };
  createdById: string;
  createdBy: Pick<PersonRef, "id" | "firstName" | "lastName">;
  salary: number;
  startDate: string | null;
  status: OfferStatus;
  sentAt: string | null;
  respondedAt: string | null;
  notes: string | null;
  departmentId: string | null;
  // Ceipal-style placement-record billing fields (src/components/ceipal)
  placementCode?: string | null;
  placementType?: string | null;
  clientPrimeVendor?: string | null;
  businessUnit?: string | null;
  clientBillRate?: string | null;
  payRate?: string | null;
  perDiemHr?: string | null;
  overhead?: string | null;
  margin?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecruitmentAnalyticsSummary {
  openPositions: number;
  totalCandidates: number;
  stageCounts: Record<CandidateStage, number>;
  hiresThisMonth: number;
  avgTimeToHireDays: number | null;
  offerCounts: Record<OfferStatus, number>;
  offerAcceptanceRate: number | null;
  upcomingInterviews: number;
  openPositionsByDepartment: { departmentId: string | null; departmentName: string; count: number }[];
}

// --- Job Postings ---

export interface JobPostingFilters {
  status?: JobPostingStatus;
  hiringDepartmentId?: string;
  departmentId?: string;
}

export interface CreateJobPostingInput {
  title: string;
  description?: string;
  location?: string;
  employmentType?: EmploymentType;
  status?: JobPostingStatus;
  targetHeadcount?: number;
  budgetMin?: number | null;
  budgetMax?: number | null;
  currency?: string;
  salaryPeriod?: string;
  skillsRequired?: string[];
  minExperienceYears?: number;
  hiringDepartmentId?: string;
  ownerId?: string;
  departmentId?: string;
  client?: string;
  clientJobId?: string;
  businessUnit?: string;
  states?: string;
  clientBillRate?: string;
  sources?: string[];
  industry?: string;
  clearance?: string;
  tags?: string[];
  boardStatus?: Record<string, boolean>;
  recruitmentManager?: string;
  assignedTo?: string;
}

export type UpdateJobPostingInput = Partial<CreateJobPostingInput>;

function buildQuery(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) qs.set(key, value);
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export function listJobPostings(filters: JobPostingFilters = {}) {
  return apiFetch<JobPosting[]>(`/job-postings${buildQuery({ ...filters })}`);
}

export function getJobPosting(id: string) {
  return apiFetch<JobPosting>(`/job-postings/${id}`);
}

export function createJobPosting(input: CreateJobPostingInput) {
  return apiFetch<JobPosting>("/job-postings", { method: "POST", body: JSON.stringify(input) });
}

export function updateJobPosting(id: string, input: UpdateJobPostingInput) {
  return apiFetch<JobPosting>(`/job-postings/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function closeJobPosting(id: string) {
  return apiFetch<JobPosting>(`/job-postings/${id}`, { method: "DELETE" });
}

export function deleteJobPosting(id: string) {
  return apiFetch<{ success: boolean; deletedId: string }>(`/job-postings/${id}?permanent=true`, {
    method: "DELETE",
  });
}

export function retryJobBoardListing(jobPostingId: string, board: JobBoard) {
  return apiFetch<JobBoardListing>(`/job-postings/${jobPostingId}/board-listings/${board}/retry`, {
    method: "POST",
  });
}

// --- Candidates ---

export interface CandidateFilters {
  jobPostingId?: string;
  stage?: CandidateStage;
  ownerId?: string;
  mine?: boolean;
  departmentId?: string;
}

export interface CreateCandidateInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  isStarred?: boolean;
  resumeUrl?: string;
  source?: string;
  currentTitle?: string;
  totalExperienceYears?: number;
  currentSalary?: number;
  expectedSalary?: number;
  noticePeriodDays?: number;
  skills?: string[];
  summary?: string;
  educationDegree?: string;
  educationInstitution?: string;
  educationYear?: string;
  certifications?: string[];
  workAuthorization?: string;
  willingToRelocate?: string;
  stage?: CandidateStage;
  position?: number;
  rejectionReason?: string;
  jobPostingId: string;
  ownerId?: string;
  departmentId?: string;
}

// jobPostingId stays updatable (unlike departmentId) so a candidate can be
// re-submitted to a different job posting -- see ceipal-context.tsx's
// submitCandidateToJob.
export type UpdateCandidateInput = Partial<Omit<CreateCandidateInput, "departmentId">>;

export function listCandidates(filters: CandidateFilters = {}) {
  const qs = buildQuery({
    jobPostingId: filters.jobPostingId,
    stage: filters.stage,
    ownerId: filters.ownerId,
    departmentId: filters.departmentId,
    mine: filters.mine ? "true" : undefined,
  });
  return apiFetch<Candidate[]>(`/candidates${qs}`);
}

export function getCandidate(id: string) {
  return apiFetch<CandidateDetail>(`/candidates/${id}`);
}

export function createCandidate(input: CreateCandidateInput) {
  return apiFetch<Candidate>("/candidates", { method: "POST", body: JSON.stringify(input) });
}

export function updateCandidate(id: string, input: UpdateCandidateInput) {
  return apiFetch<Candidate>(`/candidates/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteCandidate(id: string) {
  return apiFetch<void>(`/candidates/${id}`, { method: "DELETE" });
}

export interface AutoScreenResult {
  candidate: Candidate;
  matchResult: {
    aiMatchScore: number;
    skillMatchScore: number;
    expMatchScore: number;
    locMatchScore: number;
    salaryMatchScore: number;
    noticeMatchScore: number;
    cultureMatchScore: number;
    fitBadge: FitBadge;
    aiSummary: string;
    overlappingSkills: string[];
    missingSkills: string[];
    recommendation: "FAST_TRACK_SCREENING" | "STANDARD_REVIEW" | "MANUAL_INSPECTION";
  };
  autoAdvanced: boolean;
  message: string;
}

export function autoScreenCandidate(id: string) {
  return apiFetch<AutoScreenResult>(`/candidates/${id}/auto-screen`, { method: "POST" });
}

export function uploadCandidateResume(file: File) {
  const form = new FormData();
  form.append("file", file, file.name);
  return apiUploadForm<{
    url: string;
    filename: string;
    originalName: string;
    sizeBytes: number;
    mimeType: string;
  }>("/candidates/upload-resume", form);
}

// --- Interviews ---

export interface InterviewFilters {
  candidateId?: string;
  interviewerId?: string;
  status?: InterviewStatus;
  mine?: boolean;
  upcoming?: boolean;
}

export interface CreateInterviewInput {
  candidateId: string;
  interviewerId?: string;
  type?: InterviewType;
  scheduledAt: string;
  durationMinutes?: number;
  location?: string;
}

export interface UpdateInterviewInput extends Partial<Omit<CreateInterviewInput, "candidateId">> {
  status?: InterviewStatus;
  feedback?: string;
  rating?: number;
}

export function listInterviews(filters: InterviewFilters = {}) {
  const qs = buildQuery({
    candidateId: filters.candidateId,
    interviewerId: filters.interviewerId,
    status: filters.status,
    mine: filters.mine ? "true" : undefined,
    upcoming: filters.upcoming ? "true" : undefined,
  });
  return apiFetch<Interview[]>(`/interviews${qs}`);
}

export function createInterview(input: CreateInterviewInput) {
  return apiFetch<Interview>("/interviews", { method: "POST", body: JSON.stringify(input) });
}

export function updateInterview(id: string, input: UpdateInterviewInput) {
  return apiFetch<Interview>(`/interviews/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteInterview(id: string) {
  return apiFetch<void>(`/interviews/${id}`, { method: "DELETE" });
}

// --- Offers ---

export interface OfferFilters {
  candidateId?: string;
  status?: OfferStatus;
  departmentId?: string;
}

export interface CreateOfferInput {
  candidateId: string;
  salary: number;
  startDate?: string;
  status?: OfferStatus;
  notes?: string;
  placementCode?: string;
  placementType?: string;
  clientPrimeVendor?: string;
  businessUnit?: string;
  clientBillRate?: string;
  payRate?: string;
  perDiemHr?: string;
  overhead?: string;
  margin?: string;
}

export type UpdateOfferInput = Partial<Omit<CreateOfferInput, "candidateId">>;

export function listOffers(filters: OfferFilters = {}) {
  return apiFetch<Offer[]>(`/offers${buildQuery({ ...filters })}`);
}

export function createOffer(input: CreateOfferInput) {
  return apiFetch<Offer>("/offers", { method: "POST", body: JSON.stringify(input) });
}

export function updateOffer(id: string, input: UpdateOfferInput) {
  return apiFetch<Offer>(`/offers/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteOffer(id: string) {
  return apiFetch<void>(`/offers/${id}`, { method: "DELETE" });
}

// --- ROS Intelligence Interfaces & API Endpoints ---

export interface RosHealthData {
  globalHealthScore: number;
  pipelineVelocityScore: number;
  submittalRatioScore: number;
  offerAcceptanceScore: number;
  dropOffSlaScore: number;
  pipelineFreshnessScore?: number;
  joiningSuccessScore: number;
  joiningConfidenceLevel?: "HIGH" | "MODERATE" | "AT_RISK";
  interviewSlaScore?: number;
  hiringVelocityScore?: number;
  stuckCandidatesCount?: number;
  forecast: {
    targetHires: number;
    expectedHires: number;
    velocityPerDay: number;
    projectedShortfall: number;
    hiringRiskLevel: string;
  };
}

export interface CandidateRiskProfile {
  candidateId: string;
  jobId: string;
  offerDeclineRiskScore: number; // 0 - 100
  joiningSuccessScore: number;   // 0 - 100
  ghostingAlertLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  compGapVariancePercent: number;
  noticePeriodDays: number;
  noticePeriodRisk: "SAFE" | "MODERATE" | "HIGH_RISK" | "CRITICAL";
  recommendedPlaybooks: Array<{
    id: string;
    actionTitle: string;
    description: string;
    actionType: "BONUS_BUFFER" | "BUYOUT_OFFER" | "MANAGER_SYNC" | "NUDGE";
  }>;
  // Fallbacks for older references
  factors?: {
    latencyRisk: number;
    compGapRisk: number;
    noticePeriodDays: number;
  };
  ghostingRiskLevel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  recommendedPlaybook?: string[];
}

export interface VectorMatchCandidate {
  id?: string;
  candidateId: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  candidateCode?: string;
  currentCompany?: string;
  currentTitle?: string;
  skills?: string[];
  stage?: CandidateStage;
  matchPercentage: number;
  aiMatchScore: number;
  cosineDistance: number;
  overlappingSkills: string[];
  matchExplanation: string;
  isSilverMedalist: boolean;
  previousJobApplied?: string;
  reEngagementProbability?: number;
  primarySkillDistance?: string;
  source?: string;
}

export type TalentRediscoveryResult = VectorMatchCandidate;
export type RediscoveryCandidate = VectorMatchCandidate;

export interface SLAPriorityItem {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateCode?: string;
  jobTitle: string;
  jobId?: string;
  currentStage: string;
  timeInStageHours: number;
  slaBreachTier: "24h" | "48h" | "72h" | "96h+";
  actionType: "FEEDBACK_DUE" | "OFFER_PENDING" | "STAGE_STALLED" | "FOLLOWUP_DUE";
  assignedRecruiter: {
    id: string;
    name: string;
  };
  urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface RecruiterActionTask {
  id: string;
  actionType: string;
  priorityScore: number;
  dueDate: string;
  isCompleted: boolean;
  candidate?: {
    id: string;
    firstName: string;
    lastName: string;
    candidateCode?: string;
    currentCompany?: string;
    currentTitle?: string;
    stage: CandidateStage;
  };
  title?: string;
  subtitle?: string;
  urgency?: string;
}

export interface TalentPoolData {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  freshnessScore: number;
  engagementIndex: number;
  conversionRate: number;
}

export interface CandidateRiskData {
  candidateId: string;
  offerDeclineRisk: number;
  ghostingRisk: number;
  counterOfferRisk: number;
  joiningFailureRisk: number;
  primaryRiskFactor: string | null;
  recommendedMitigation: string | null;
}

// --- Analytics & ROS APIs ---

export function getRecruitmentAnalyticsSummary() {
  return apiFetch<RecruitmentAnalyticsSummary>("/recruitment-analytics/summary");
}

export function getRosHealth() {
  return apiFetch<RosHealthData>("/recruitment-analytics/ros-health");
}

export function getRediscovery(jobPostingId?: string) {
  const qs = jobPostingId ? `?jobPostingId=${encodeURIComponent(jobPostingId)}` : "";
  return apiFetch<TalentRediscoveryResult[]>(`/recruitment-analytics/rediscovery${qs}`);
}

export function reactivateRediscoveredCandidate(candidateId: string, jobPostingId: string) {
  return apiFetch<{ success: boolean; message: string; candidate: Candidate }>(
    "/recruitment-analytics/rediscovery/reactivate",
    {
      method: "POST",
      body: JSON.stringify({ candidateId, jobPostingId }),
    },
  );
}

export function getActionQueue() {
  return apiFetch<RecruiterActionTask[]>("/recruitment-analytics/action-queue");
}

export function getSLAPriorityQueue() {
  return apiFetch<SLAPriorityItem[]>("/recruitment-analytics/sla-priority-queue");
}

export function triggerSlaNudge(candidateId: string, message?: string) {
  return apiFetch<{ success: boolean; action: string; message: string }>(
    "/recruitment-analytics/sla-action/nudge",
    {
      method: "POST",
      body: JSON.stringify({ candidateId, message }),
    },
  );
}

export function triggerInterviewerReminder(interviewId: string) {
  return apiFetch<{ success: boolean; action: string; message: string }>(
    "/recruitment-analytics/sla-action/remind-interviewer",
    {
      method: "POST",
      body: JSON.stringify({ interviewId }),
    },
  );
}

export function advanceSlaStage(candidateId: string, nextStage: CandidateStage) {
  return apiFetch<{ success: boolean; action: string; candidateId: string; newStage: CandidateStage }>(
    "/recruitment-analytics/sla-action/advance-stage",
    {
      method: "POST",
      body: JSON.stringify({ candidateId, nextStage }),
    },
  );
}

export function getTalentPools() {
  return apiFetch<TalentPoolData[]>("/recruitment-analytics/talent-pools");
}

// Real per-recruiter tracking for the recruitment manager's team-oversight
// view (Ceipal's Recruiter Dashboard) -- see recruitment-analytics.service.ts.
export interface TeamPerformanceRow {
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  submissions: number;
  clientSubmissions?: number;
  interviews: number;
  hires: number;
  candidatesOwned: number;
  conversionRate: number;
  notesLogged: number;
  tasksAssigned: number;
  tasksCompleted: number;
  activitiesLogged: number;
}

export function getTeamPerformance(range?: string) {
  const url = range
    ? `/recruitment-analytics/team-performance?range=${encodeURIComponent(range)}`
    : "/recruitment-analytics/team-performance";
  return apiFetch<TeamPerformanceRow[]>(url);
}

export function getCandidateRiskProfile(id: string) {
  return apiFetch<CandidateRiskProfile>(`/recruitment-analytics/candidate-risk/${id}`);
}

// --- Ceipal-style recruitment CRM: Clients, Vendors, Leads, Eboarding ---
// (src/components/ceipal) -- these are separate entities from the ATS
// pipeline above (JobPosting/Candidate/Offer), added specifically to back
// that staffing-agency-flavored UI.

export interface RecruitmentClient {
  id: string;
  name: string;
  contactNumber: string | null;
  website: string | null;
  industry: string | null;
  status: string;
  category: string | null;
  businessUnit: string | null;
  displayOnJob: boolean;
  hasBadge: boolean;
  primaryOwnerId: string | null;
  primaryOwner: PersonRef | null;
  createdById: string;
  createdBy: Pick<PersonRef, "id" | "firstName" | "lastName">;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientInput {
  name: string;
  contactNumber?: string;
  website?: string;
  industry?: string;
  status?: string;
  category?: string;
  businessUnit?: string;
  displayOnJob?: boolean;
  primaryOwnerId?: string;
}

export type UpdateClientInput = Partial<CreateClientInput>;

export function listClients() {
  return apiFetch<RecruitmentClient[]>("/clients");
}

export function createClient(input: CreateClientInput) {
  return apiFetch<RecruitmentClient>("/clients", { method: "POST", body: JSON.stringify(input) });
}

export function updateClient(id: string, input: UpdateClientInput) {
  return apiFetch<RecruitmentClient>(`/clients/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteClient(id: string) {
  return apiFetch<void>(`/clients/${id}`, { method: "DELETE" });
}

export interface RecruitmentVendor {
  id: string;
  name: string;
  website: string | null;
  contactNumber: string | null;
  state: string | null;
  country: string | null;
  ownership: string | null;
  businessUnit: string | null;
  contactPerson: string | null;
  email: string | null;
  category: string | null;
  createdById: string;
  createdBy: Pick<PersonRef, "id" | "firstName" | "lastName">;
  modifiedById: string | null;
  modifiedBy: Pick<PersonRef, "id" | "firstName" | "lastName"> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVendorInput {
  name: string;
  website?: string;
  contactNumber?: string;
  state?: string;
  country?: string;
  ownership?: string;
  businessUnit?: string;
  contactPerson?: string;
  email?: string;
  category?: string;
}

export type UpdateVendorInput = Partial<CreateVendorInput>;

export function listVendors() {
  return apiFetch<RecruitmentVendor[]>("/vendors");
}

export function createVendor(input: CreateVendorInput) {
  return apiFetch<RecruitmentVendor>("/vendors", { method: "POST", body: JSON.stringify(input) });
}

export function updateVendor(id: string, input: UpdateVendorInput) {
  return apiFetch<RecruitmentVendor>(`/vendors/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteVendor(id: string) {
  return apiFetch<void>(`/vendors/${id}`, { method: "DELETE" });
}

export interface RecruitmentLead {
  id: string;
  name: string;
  company: string | null;
  status: string;
  source: string | null;
  website: string | null;
  contactNumber: string | null;
  email?: string | null;
  notes?: string | null;
  businessUnit: string | null;
  zipCode: string | null;
  lastActivityAt: string | null;
  createdById: string;
  createdBy: Pick<PersonRef, "id" | "firstName" | "lastName">;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeadInput {
  name: string;
  company?: string;
  email?: string;
  notes?: string;
  status?: string;
  source?: string;
  website?: string;
  contactNumber?: string;
  businessUnit?: string;
  zipCode?: string;
}

export type UpdateLeadInput = Partial<CreateLeadInput>;

export function listLeads() {
  return apiFetch<RecruitmentLead[]>("/leads");
}

export function createLead(input: CreateLeadInput) {
  return apiFetch<RecruitmentLead>("/leads", { method: "POST", body: JSON.stringify(input) });
}

export function updateLead(id: string, input: UpdateLeadInput) {
  return apiFetch<RecruitmentLead>(`/leads/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteLead(id: string) {
  return apiFetch<void>(`/leads/${id}`, { method: "DELETE" });
}

export type EboardingStatus =
  | "DRAFT"
  | "INITIATED"
  | "RESPONDED"
  | "VERIFIED"
  | "NEGOTIATE"
  | "JOINED"
  | "REJECTED"
  | "DISQUALIFIED"
  | "CANCELLED";

export interface EboardingChecklistItem {
  id: string;
  name: string;
  completed: boolean;
}

export interface EboardingRecord {
  id: string;
  name: string;
  middleName: string | null;
  lastName: string | null;
  email: string;
  alternateEmail: string | null;
  phone: string | null;
  gender: string | null;
  jobTitle: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  zipCode: string | null;
  streetAddress: string | null;
  employmentType: string | null;
  onboardingCode: string | null;
  taxTerms: string | null;
  vendorName: string | null;
  vendorEmail: string | null;
  atsBu: string | null;
  client: string | null;
  startDate: string | null;
  endDate: string | null;
  joiningDate: string | null;
  billRate: string | null;
  payRate: string | null;
  placementType: string | null;
  comments: string | null;
  status: EboardingStatus;
  checklist: EboardingChecklistItem[] | null;
  initiatedOn: string | null;
  createdById: string;
  createdBy: Pick<PersonRef, "id" | "firstName" | "lastName">;
  createdAt: string;
  updatedAt: string;
}

export type CreateEboardingInput = Omit<
  EboardingRecord,
  "id" | "createdById" | "createdBy" | "createdAt" | "updatedAt"
>;

export type UpdateEboardingInput = Partial<CreateEboardingInput>;

export function listEboardings() {
  return apiFetch<EboardingRecord[]>("/eboarding");
}

export function createEboarding(input: CreateEboardingInput) {
  return apiFetch<EboardingRecord>("/eboarding", { method: "POST", body: JSON.stringify(input) });
}

export function updateEboarding(id: string, input: UpdateEboardingInput) {
  return apiFetch<EboardingRecord>(`/eboarding/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function updateEboardingStatus(id: string, status: EboardingStatus) {
  return apiFetch<EboardingRecord>(`/eboarding/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function deleteEboarding(id: string) {
  return apiFetch<void>(`/eboarding/${id}`, { method: "DELETE" });
}

// --- Job-detail-panel collaboration sub-entities (tasks, activity log,
// email merges, submissions, notes, documents) -- src/components/ceipal.
// Previously localStorage-only on the frontend; now backed by real,
// shared tables (see server/src/modules/job-collaboration).

export interface JobTask {
  id: string;
  jobPostingId: string;
  taskName: string;
  dueDate: string | null;
  timeZone: string | null;
  assignedTo: string | null;
  assignedBy: string | null;
  status: string | null;
  completed: boolean;
  createdById: string;
  createdBy: Pick<PersonRef, "id" | "firstName" | "lastName">;
  createdAt: string;
  updatedAt: string;
}

export interface CreateJobTaskInput {
  jobPostingId: string;
  taskName: string;
  dueDate?: string;
  timeZone?: string;
  assignedTo?: string;
  assignedBy?: string;
  status?: string;
  completed?: boolean;
}

export function listJobTasks() {
  return apiFetch<JobTask[]>("/job-tasks");
}

export function createJobTask(input: CreateJobTaskInput) {
  return apiFetch<JobTask>("/job-tasks", { method: "POST", body: JSON.stringify(input) });
}

export function deleteJobTask(id: string) {
  return apiFetch<void>(`/job-tasks/${id}`, { method: "DELETE" });
}

export type JobActivityType =
  | "CREATION"
  | "STATUS_CHANGE"
  | "BOARD"
  | "TASK"
  | "SUBMISSION"
  | "BROADCAST"
  | "GENERAL";

export interface JobActivity {
  id: string;
  jobPostingId: string;
  user: string;
  description: string;
  type: JobActivityType;
  createdById: string;
  createdBy: Pick<PersonRef, "id" | "firstName" | "lastName">;
  createdAt: string;
}

export interface CreateJobActivityInput {
  jobPostingId: string;
  description: string;
  user?: string;
  type?: JobActivityType;
}

export function listJobActivities() {
  return apiFetch<JobActivity[]>("/job-activities");
}

export function createJobActivity(input: CreateJobActivityInput) {
  return apiFetch<JobActivity>("/job-activities", { method: "POST", body: JSON.stringify(input) });
}

export interface JobEmailMerge {
  id: string;
  jobPostingId: string;
  sentBy: string;
  sentTo: string;
  searchString: string | null;
  zipLocation: string | null;
  subject: string;
  details: string;
  createdById: string;
  createdBy: Pick<PersonRef, "id" | "firstName" | "lastName">;
  createdAt: string;
}

export interface CreateJobEmailMergeInput {
  jobPostingId: string;
  subject: string;
  details: string;
  sentBy?: string;
  sentTo?: string;
  searchString?: string;
  zipLocation?: string;
}

export function listJobEmailMerges() {
  return apiFetch<JobEmailMerge[]>("/job-email-merges");
}

export function createJobEmailMerge(input: CreateJobEmailMergeInput) {
  return apiFetch<JobEmailMerge>("/job-email-merges", { method: "POST", body: JSON.stringify(input) });
}

export interface JobSubmission {
  id: string;
  jobPostingId: string;
  candidateId: string | null;
  name: string;
  submittedBy: string;
  contact: string | null;
  location: string | null;
  status: string;
  statusLabel: string | null;
  payRate: string | null;
  billRate: string | null;
  createdById: string;
  createdBy: Pick<PersonRef, "id" | "firstName" | "lastName">;
  createdAt: string;
}

export interface CreateJobSubmissionInput {
  jobPostingId: string;
  name: string;
  status: string;
  candidateId?: string;
  submittedBy?: string;
  contact?: string;
  location?: string;
  statusLabel?: string;
  payRate?: string;
  billRate?: string;
}

export function listJobSubmissions() {
  return apiFetch<JobSubmission[]>("/job-submissions");
}

export function createJobSubmission(input: CreateJobSubmissionInput) {
  return apiFetch<JobSubmission>("/job-submissions", { method: "POST", body: JSON.stringify(input) });
}

export function deleteJobSubmission(id: string) {
  return apiFetch<void>(`/job-submissions/${id}`, { method: "DELETE" });
}

export interface JobNote {
  id: string;
  jobPostingId: string;
  text: string;
  action: string | null;
  addedBy: string;
  createdById: string;
  createdBy: Pick<PersonRef, "id" | "firstName" | "lastName">;
  createdAt: string;
}

export interface CreateJobNoteInput {
  jobPostingId: string;
  text: string;
  action?: string;
  addedBy?: string;
}

export function listJobNotes() {
  return apiFetch<JobNote[]>("/job-notes");
}

export function createJobNote(input: CreateJobNoteInput) {
  return apiFetch<JobNote>("/job-notes", { method: "POST", body: JSON.stringify(input) });
}

export function deleteJobNote(id: string) {
  return apiFetch<void>(`/job-notes/${id}`, { method: "DELETE" });
}

export interface JobDocument {
  id: string;
  jobPostingId: string;
  name: string;
  type: string | null;
  size: string | null;
  addedBy: string;
  createdById: string;
  createdBy: Pick<PersonRef, "id" | "firstName" | "lastName">;
  createdAt: string;
}

export interface CreateJobDocumentInput {
  jobPostingId: string;
  name: string;
  type?: string;
  size?: string;
  addedBy?: string;
}

export function listJobDocuments() {
  return apiFetch<JobDocument[]>("/job-documents");
}

export function createJobDocument(input: CreateJobDocumentInput) {
  return apiFetch<JobDocument>("/job-documents", { method: "POST", body: JSON.stringify(input) });
}

export function deleteJobDocument(id: string) {
  return apiFetch<void>(`/job-documents/${id}`, { method: "DELETE" });
}

