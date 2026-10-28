import type { JobBoardListing } from '@/lib/api/recruitment';

export type CeipalModule =
  | 'home'
  | 'jobs'
  | 'applicants'
  | 'clients'
  | 'vendors'
  | 'eboarding'
  | 'placements'
  | 'leads'
  | 'settings';

export type EboardingSubModule = 'dashboard' | 'initiate' | 'ready';

export type EboardingStatus =
  | 'Draft'
  | 'Initiated'
  | 'Responded'
  | 'Verified'
  | 'Negotiate'
  | 'Joined'
  | 'Rejected'
  | 'Disqualified'
  | 'Cancelled';

export interface JobPostingItem {
  id: string;
  jobCode: string; // e.g. JPC-101
  jobTitle: string;
  businessUnit: string;
  client: string;
  clientJobId: string;
  location: string; // e.g. [Toronto, ON, M5V]
  states: string;
  country?: string;
  jobStatus: string; // "Active"
  clientBillRate: string; // "N/A" or "$85.00/hr"
  payRate?: string; // e.g. "$65.00/hr" or "$110,000/yr"
  budgetMin?: number | null;
  budgetMax?: number | null;
  currency?: string;
  salaryPeriod?: string;
  taxTerms?: string; // "Full Time" | "W2" | "C2C" | "1099"
  jobType?: string; // "Full Time" | "Contract" | "Part Time"
  numberOfPositions?: number; // e.g. 1
  primarySkills?: string[] | string; // e.g. ["React", "TypeScript", "Node.js"] or "React, TypeScript"
  experience?: string; // e.g. "3-5 Years"
  industry?: string; // e.g. "Information Technology"
  clearance?: string; // "No" | "Yes - Secret"
  recruitmentManager?: string; // e.g. "Govind K."
  assignedTo?: string; // e.g. "Megan P."
  owner?: string; // display name of the real owning recruiter, for activity/task attribution
  department?: string;
  tags?: string[];
  boardStatus?: Record<string, boolean>; // e.g. { linkedin: true, indeed: false, ziprecruiter: true, glassdoor: false }
  boardListings?: JobBoardListing[];
  applicantsCount: number; // e.g. 14, 38, 85
  sources: ('linkedin' | 'user' | 'resume')[];
  createdAt?: string;
  description?: string;
}

export interface JobTaskItem {
  id: string;
  jobId: string;
  taskName: string;
  dueDate: string;
  timeZone: string;
  assignedTo: string;
  assignedBy: string;
  createdOn: string;
  modified: string;
  completed?: boolean;
  status?: string; // e.g. "Open" -- separate freeform status alongside `completed`
}

export interface JobActivityItem {
  id: string;
  jobId: string;
  timestamp: string;
  user: string;
  description: string;
  type: 'creation' | 'status_change' | 'board' | 'task' | 'submission' | 'broadcast' | 'general';
}

export interface JobEmailMergeItem {
  id: string;
  jobId: string;
  sentBy: string;
  sentOn: string;
  sentTo: string; // recipient count or name e.g. "12 Candidates"
  searchString: string;
  zipLocation: string;
  subject: string;
  details: string;
}

export interface JobSubmissionItem {
  id: string;
  jobId: string;
  candidateId?: string;
  name: string;
  submittedBy: string;
  submittedOn: string;
  contact: string;
  location: string;
  status: string;
  statusLabel: string;
  payRate: string;
  billRate: string;
}

export interface JobNoteItem {
  id: string;
  jobId: string;
  addedBy: string;
  onDate: string;
  text: string;
  action?: string;
}

export interface JobDocumentItem {
  id: string;
  jobId: string;
  name: string;
  addedBy: string;
  onDate: string;
  type: string;
  size?: string;
}

export interface ApplicantItem {
  id: string; // Internal database ID (UUID or numeric ID)
  displayId?: string; // 5-digit Ceipal formatted ID (e.g. "10000", "10001")
  name: string;
  email: string;
  mobile: string;
  city: string;
  source: 'ZipRecruiter' | 'Resume Inbox' | 'Direct Application' | string;
  state: string;
  status: string; // "New lead"
  jobTitle: string;
  owner: string; // "Govind...", "Rajeswari..."
  badgeCount: number;
  isStarred: boolean;
  skills?: string[] | string; // for skill-matching against job postings
  createdAt?: string;

  // AI Matching & Fit Assessment
  aiMatchScore?: number;
  skillMatchScore?: number;
  expMatchScore?: number;
  locMatchScore?: number;
  salaryMatchScore?: number;
  noticeMatchScore?: number;
  cultureMatchScore?: number;
  fitBadge?: 'PLATINUM_FIT' | 'GOLD_FIT' | 'SILVER_FIT' | 'REVIEW_REQUIRED';
  aiSummary?: string;

  // Extended applicant info fields
  totalExperience?: string;
  currentSalary?: string;
  expectedSalary?: string;
  noticePeriod?: string;
  workAuthorization?: string;
  willingToRelocate?: string;
  summary?: string;
  educationDegree?: string;
  educationInstitution?: string;
  educationYear?: string;
  certifications?: string[];
  resumeFileName?: string;
  resumeFileSize?: string;
  resumeUrl?: string;
  resumeDataUrl?: string;
  resumeFileType?: string;
  resumeUploadedAt?: string;
}

export interface ClientItem {
  id: string;
  name: string;
  contactNumber: string;
  website: string;
  industry: string;
  status: string; // "Active"
  category: string; // "Direct" or ""
  primaryOwner: string;
  businessUnit: string;
  displayOnJob: string; // "Yes"
  createdBy: string;
  hasBadge?: boolean;
}

export interface VendorItem {
  id: string;
  name: string;
  website: string;
  contactNumber: string;
  state: string;
  createdBy: string;
  createdOn: string;
  country: string;
  ownership: string;
  businessUnit: string;
  modifiedOn: string;
  modifiedBy: string;
  contactPerson?: string; // quick-create header form
  email?: string;
  category?: string;
}

export interface PlacementItem {
  id: string;
  applicantName: string;
  placementCode: string;
  jobCode: string;
  jobTitle: string;
  placementType: string;
  clientPrimeVendor: string;
  businessUnit: string;
  clientBillRate: string;
  payRate: string;
  perDiemHr: string;
  overhead: string;
  margin: string;
  createdOn: string;
  createdBy: string;
  status?: string; // real Offer.status display label (Draft/Sent/Accepted/...)
  clientJobId?: string;
  mobileNumber?: string;
  location?: string;
}

export interface LeadItem {
  id: string;
  name: string; // the contact person's name
  company?: string; // the organization they're at, quick-create header form
  status: string;
  source: string;
  website: string;
  contactNumber: string;
  email?: string;
  notes?: string;
  createdOn: string;
  createdBy: string;
  businessUnit: string;
  leadAge: string;
  modifiedOn: string;
  lastActivity: string;
  zipCode: string;
}

export interface EboardingItem {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  phone: string;
  initiatedOn: string;
  joiningDate: string;
  taxTerms: string;
  vendorName: string;
  vendorEmail: string;
  atsBu: string;
  status: EboardingStatus;
  gender?: 'Male' | 'Female';
  middleName?: string;
  lastName?: string;
  country?: string;
  state?: string;
  city?: string;
  zipCode?: string;
  employmentType?: string;
  streetAddress?: string;
  onboardingCode?: string;
  alternateEmail?: string;
  comments?: string;
  client?: string;
  startDate?: string;
  endDate?: string;
  billRate?: string;
  payRate?: string;
  placementType?: string;
  checklists?: { id: string; name: string; completed: boolean }[];
  createdBy?: string;
}

export interface CeipalViewTab {
  id: string;
  module: CeipalModule;
  label: string;
  filterKey?: string;
  filterValue?: string;
  isCustom?: boolean;
}

export interface ColumnFilter {
  field: string;
  operator: 'contains' | 'equals' | 'startsWith' | 'isEmpty';
  value: string;
}
