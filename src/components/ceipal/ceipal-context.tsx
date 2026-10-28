import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import {
  CeipalModule,
  EboardingSubModule,
  EboardingStatus,
  JobPostingItem,
  JobTaskItem,
  JobActivityItem,
  JobEmailMergeItem,
  JobSubmissionItem,
  JobNoteItem,
  JobDocumentItem,
  ApplicantItem,
  ClientItem,
  VendorItem,
  PlacementItem,
  LeadItem,
  EboardingItem,
  CeipalViewTab,
  ColumnFilter,
} from './types';
import * as api from '@/lib/api/recruitment';
import { personName, toApplicantItem, toCandidateProfileInput } from './applicant-mappers';
import { toast } from 'sonner';

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota or serialization errors
  }
}
import {
  useJobPostings,
  useCreateJobPosting,
  useUpdateJobPosting,
  useCloseJobPosting,
  useDeleteJobPosting,
  useCandidates,
  useCreateCandidate,
  useUpdateCandidate,
  useClients,
  useCreateClient,
  useUpdateClient,
  useVendors,
  useCreateVendor,
  useRecruitmentLeads,
  useCreateRecruitmentLead,
  useOffers,
  useCreateOffer,
  useEboardings,
  useCreateEboarding,
  useUpdateEboarding as useUpdateEboardingRecord,
  useUpdateEboardingStatus,
  useDeleteEboarding as useDeleteEboardingRecord,
  useJobTasks,
  useCreateJobTask,
  useDeleteJobTask,
  useJobActivities,
  useCreateJobActivity,
  useJobEmailMerges,
  useCreateJobEmailMerge,
  useJobSubmissions,
  useCreateJobSubmission,
  useDeleteJobSubmission,
  useJobNotes,
  useCreateJobNote,
  useDeleteJobNote,
  useJobDocuments,
  useCreateJobDocument,
  useDeleteJobDocument,
} from '@/hooks/use-recruitment';

// ---------------------------------------------------------------------------
// Backend adapters
//
// The views in this directory were built against a fixed, staffing-agency-
// flavored shape (JobPostingItem/ApplicantItem/etc., see ./types) that predates
// any backend for it. Rather than rewrite ~15 view files to a different shape,
// this file is the single seam: it fetches the real ATS entities (JobPosting/
// Candidate/Offer, plus the new Client/Vendor/Lead/Eboarding models) and maps
// them to/from the shape the views already expect.
//
// Two of the mock forms (Applicants, Placements) only ever free-type a job
// title / applicant name rather than picking a real record -- there was never
// a picker UI for it. The real Candidate/Offer models require a real
// jobPostingId/candidateId, so on create here we resolve an existing match by
// name (case-insensitive) or, failing that, auto-provision a minimal one. This
// keeps the existing forms working unchanged while still writing real,
// relationally-valid rows.
// ---------------------------------------------------------------------------

function splitName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx === -1) return { firstName: trimmed || 'Unknown', lastName: '-' };
  return { firstName: trimmed.slice(0, spaceIdx), lastName: trimmed.slice(spaceIdx + 1) || '-' };
}

function dateOnly(iso: string | null | undefined): string {
  return iso ? iso.split('T')[0] : '';
}

// Ceipal's EboardingStatus (./types) is Title Case for display; the Prisma
// enum backing it is UPPER_SNAKE_CASE. Map explicitly rather than casting.
const EBOARDING_STATUS_TO_API: Record<EboardingStatus, api.EboardingStatus> = {
  Draft: 'DRAFT',
  Initiated: 'INITIATED',
  Responded: 'RESPONDED',
  Verified: 'VERIFIED',
  Negotiate: 'NEGOTIATE',
  Joined: 'JOINED',
  Rejected: 'REJECTED',
  Disqualified: 'DISQUALIFIED',
  Cancelled: 'CANCELLED',
};
const API_TO_EBOARDING_STATUS: Record<api.EboardingStatus, EboardingStatus> = {
  DRAFT: 'Draft',
  INITIATED: 'Initiated',
  RESPONDED: 'Responded',
  VERIFIED: 'Verified',
  NEGOTIATE: 'Negotiate',
  JOINED: 'Joined',
  REJECTED: 'Rejected',
  DISQUALIFIED: 'Disqualified',
  CANCELLED: 'Cancelled',
};

const CEIPAL_STATUS_MAP: Record<string, string> = {
  OPEN: 'Active',
  ON_HOLD: 'Hold',
  CLOSED: 'Closed',
  FILLED: 'Filled',
  Open: 'Active',
  'On hold': 'Hold',
};

function toApiJobPostingStatus(status: string | undefined): api.JobPostingStatus | undefined {
  if (!status) return undefined;
  const s = status.trim().toUpperCase().replace(/\s+/g, '_');
  if (s === 'ACTIVE' || s === 'OPEN') return 'OPEN';
  if (s === 'HOLD' || s === 'ON_HOLD' || s === 'DRAFT') return 'ON_HOLD';
  if (s === 'CLOSED') return 'CLOSED';
  if (s === 'FILLED') return 'FILLED';
  return 'OPEN';
}

function formatCeipalRate(
  min?: number | null,
  max?: number | null,
  currency: string = 'USD',
  salaryPeriod: string = 'YEARLY'
): string | undefined {
  if (!min && !max) return undefined;
  const sym =
    currency === 'USD'
      ? '$'
      : currency === 'CAD'
      ? 'CA$'
      : currency === 'EUR'
      ? '€'
      : currency === 'GBP'
      ? '£'
      : `${currency} `;
  const period = (salaryPeriod || 'YEARLY').toUpperCase();
  const unit = period === 'HOURLY' ? '/hr' : period === 'MONTHLY' ? '/mo' : '/yr';
  if (min && max && min !== max) {
    return `${sym}${min.toLocaleString('en-US')} - ${sym}${max.toLocaleString('en-US')}${unit}`;
  }
  const val = min || max;
  return `${sym}${val?.toLocaleString('en-US')}${unit}`;
}

function parseBudgetRange(clientBillRate?: string, payRate?: string): { budgetMin?: number; budgetMax?: number } {
  const extractNumbers = (str?: string): number[] => {
    if (!str) return [];
    const normalized = str.replace(/(\d+(?:\.\d+)?)\s*[kK]\b/g, (_, num) => String(parseFloat(num) * 1000));
    const matches = normalized.match(/\d+(?:\.\d+)?/g);
    if (!matches) return [];
    return matches.map((n) => parseFloat(n)).filter((n) => !isNaN(n) && n > 0);
  };

  const payNums = extractNumbers(payRate);
  const billNums = extractNumbers(clientBillRate);

  if (payNums.length >= 2) {
    return {
      budgetMin: Math.min(...payNums),
      budgetMax: Math.max(...payNums),
    };
  }

  if (billNums.length > 0 && payNums.length > 0) {
    return {
      budgetMin: Math.min(billNums[0], payNums[0]),
      budgetMax: Math.max(billNums[0], payNums[0]),
    };
  }

  if (payNums.length === 1) {
    return {
      budgetMin: payNums[0],
      budgetMax: payNums[0],
    };
  }

  if (billNums.length >= 2) {
    return {
      budgetMin: Math.min(...billNums),
      budgetMax: Math.max(...billNums),
    };
  }

  if (billNums.length === 1) {
    return {
      budgetMin: billNums[0],
      budgetMax: billNums[0],
    };
  }

  return {};
}

function toJobPostingItem(jp: api.JobPosting): JobPostingItem {
  const payRateStr = formatCeipalRate(jp.budgetMin, jp.budgetMax, jp.currency || 'USD', jp.salaryPeriod || 'YEARLY');
  const expStr = jp.minExperienceYears ? `${jp.minExperienceYears}+ Years` : undefined;

  return {
    id: jp.id,
    jobCode: jp.jobCode || `JPC-${jp.id.slice(0, 6).toUpperCase()}`,
    jobTitle: jp.title,
    businessUnit: jp.businessUnit || '',
    client: jp.client || '',
    clientJobId: jp.clientJobId || '',
    location: jp.location || '',
    states: jp.states || '',
    jobStatus: (jp.status && CEIPAL_STATUS_MAP[jp.status]) || api.JOB_POSTING_STATUS_LABELS[jp.status] || jp.status || 'Active',
    clientBillRate: jp.clientBillRate || 'N/A',
    payRate: payRateStr,
    budgetMin: jp.budgetMin,
    budgetMax: jp.budgetMax,
    currency: jp.currency || 'USD',
    salaryPeriod: jp.salaryPeriod || 'YEARLY',
    taxTerms: jp.employmentType === 'FULL_TIME' ? 'Full Time' : jp.employmentType === 'CONTRACT' ? 'Contract' : jp.employmentType ? 'Part Time' : 'N/A',
    jobType: jp.employmentType === 'FULL_TIME' ? 'Full Time' : jp.employmentType === 'CONTRACT' ? 'Contract' : jp.employmentType ? 'Part Time' : 'N/A',
    numberOfPositions: jp.targetHeadcount ?? 1,
    primarySkills: jp.skillsRequired && jp.skillsRequired.length > 0 ? (Array.isArray(jp.skillsRequired) ? jp.skillsRequired.join(', ') : String(jp.skillsRequired)) : undefined,
    experience: expStr,
    industry: jp.industry || undefined,
    clearance: jp.clearance || undefined,
    recruitmentManager: jp.recruitmentManager || personName(jp.owner) || undefined,
    owner: personName(jp.owner) || undefined,
    assignedTo: jp.assignedTo || undefined,
    department: jp.hiringDepartment?.name,
    boardStatus: jp.boardStatus || { linkedin: true, indeed: true, ziprecruiter: true, glassdoor: false },
    boardListings: jp.boardListings || [],
    tags: jp.tags || [],
    applicantsCount: jp._count?.candidates ?? 0,
    sources: (jp.sources as JobPostingItem['sources']) || [],
    createdAt: dateOnly(jp.createdAt) || undefined,
    description: jp.description || undefined,
  };
}

function toCreateJobPostingInput(job: Partial<JobPostingItem>): api.CreateJobPostingInput {
  const budgetRange = parseBudgetRange(job.clientBillRate, job.payRate);
  const expNum = job.experience ? parseFloat(job.experience.replace(/[^0-9.]/g, '')) : undefined;

  let empType: api.EmploymentType | undefined = undefined;
  if (job.jobType === 'Contract') empType = 'CONTRACT';
  else if (job.jobType === 'Part Time') empType = 'PART_TIME';
  else if (job.jobType === 'Full Time') empType = 'FULL_TIME';

  const skillsArr = job.primarySkills
    ? (Array.isArray(job.primarySkills)
        ? job.primarySkills
        : (job.primarySkills as string).split(',').map((s) => s.trim()).filter(Boolean))
    : undefined;

  return {
    title: job.jobTitle || 'Untitled Role',
    description: job.description,
    location: job.location,
    client: job.client,
    clientJobId: job.clientJobId,
    businessUnit: job.businessUnit,
    states: job.states,
    clientBillRate: job.clientBillRate,
    sources: job.sources,
    industry: job.industry,
    clearance: job.clearance,
    tags: job.tags,
    boardStatus: job.boardStatus,
    status: job.jobStatus ? toApiJobPostingStatus(job.jobStatus) : undefined,
    employmentType: empType,
    targetHeadcount: typeof job.numberOfPositions === 'number' && !isNaN(job.numberOfPositions) ? job.numberOfPositions : 1,
    budgetMin: job.budgetMin !== undefined && job.budgetMin !== null ? Number(job.budgetMin) : budgetRange.budgetMin,
    budgetMax: job.budgetMax !== undefined && job.budgetMax !== null ? Number(job.budgetMax) : budgetRange.budgetMax,
    currency: job.currency || 'USD',
    salaryPeriod: job.salaryPeriod || 'YEARLY',
    skillsRequired: skillsArr,
    minExperienceYears: typeof expNum === 'number' && !isNaN(expNum) ? expNum : undefined,
    recruitmentManager: job.recruitmentManager,
    assignedTo: job.assignedTo,
  };
}

function toUpdateJobPostingInput(job: Partial<JobPostingItem>): api.UpdateJobPostingInput {
  const input: api.UpdateJobPostingInput = {};

  if (job.jobTitle !== undefined) input.title = job.jobTitle;
  if (job.description !== undefined) input.description = job.description;
  if (job.location !== undefined) input.location = job.location;
  if (job.client !== undefined) input.client = job.client;
  if (job.clientJobId !== undefined) input.clientJobId = job.clientJobId;
  if (job.businessUnit !== undefined) input.businessUnit = job.businessUnit;
  if (job.states !== undefined) input.states = job.states;
  if (job.clientBillRate !== undefined) input.clientBillRate = job.clientBillRate;
  if (job.sources !== undefined) input.sources = job.sources;
  if (job.industry !== undefined) input.industry = job.industry;
  if (job.clearance !== undefined) input.clearance = job.clearance;
  if (job.tags !== undefined) input.tags = job.tags;
  if (job.boardStatus !== undefined) input.boardStatus = job.boardStatus;
  if (job.recruitmentManager !== undefined) input.recruitmentManager = job.recruitmentManager;
  if (job.assignedTo !== undefined) input.assignedTo = job.assignedTo;

  if (job.jobStatus !== undefined) {
    input.status = toApiJobPostingStatus(job.jobStatus);
  }

  if (job.jobType !== undefined) {
    if (job.jobType === 'Contract') input.employmentType = 'CONTRACT';
    else if (job.jobType === 'Part Time') input.employmentType = 'PART_TIME';
    else if (job.jobType === 'Full Time') input.employmentType = 'FULL_TIME';
  }

  if (job.numberOfPositions !== undefined && typeof job.numberOfPositions === 'number' && !isNaN(job.numberOfPositions)) {
    input.targetHeadcount = job.numberOfPositions;
  }

  if (job.currency !== undefined) input.currency = job.currency;
  if (job.salaryPeriod !== undefined) input.salaryPeriod = job.salaryPeriod;
  if (job.budgetMin !== undefined) input.budgetMin = job.budgetMin !== null ? Number(job.budgetMin) : null;
  if (job.budgetMax !== undefined) input.budgetMax = job.budgetMax !== null ? Number(job.budgetMax) : null;

  if (
    input.budgetMin === undefined &&
    input.budgetMax === undefined &&
    (job.payRate !== undefined || job.clientBillRate !== undefined)
  ) {
    const budgetRange = parseBudgetRange(job.clientBillRate, job.payRate);
    if (budgetRange.budgetMin !== undefined) input.budgetMin = budgetRange.budgetMin;
    if (budgetRange.budgetMax !== undefined) input.budgetMax = budgetRange.budgetMax;
  }

  if (job.experience !== undefined) {
    const expNum = parseFloat(job.experience.replace(/[^0-9.]/g, ''));
    if (!isNaN(expNum)) {
      input.minExperienceYears = expNum;
    }
  }

  if (job.primarySkills !== undefined) {
    input.skillsRequired = Array.isArray(job.primarySkills)
      ? job.primarySkills
      : job.primarySkills.split(',').map((s) => s.trim()).filter(Boolean);
  }

  return input;
}

// parseExperienceYears/formatSalary/toApplicantItem/toCandidateProfileInput/
// personName etc. now live in applicant-mappers.ts so they can be unit
// tested without pulling in this whole provider (see applicant-mappers.test.ts).

function toClientItem(c: api.RecruitmentClient): ClientItem {
  return {
    id: c.id,
    name: c.name,
    contactNumber: c.contactNumber || '',
    website: c.website || '',
    industry: c.industry || '',
    status: c.status,
    category: c.category || '',
    primaryOwner: personName(c.primaryOwner) || personName(c.createdBy),
    businessUnit: c.businessUnit || '',
    displayOnJob: c.displayOnJob ? 'Yes' : 'No',
    createdBy: personName(c.createdBy),
    hasBadge: c.hasBadge,
  };
}

function toVendorItem(v: api.RecruitmentVendor): VendorItem {
  return {
    id: v.id,
    name: v.name,
    website: v.website || '',
    contactNumber: v.contactNumber || '',
    state: v.state || '',
    createdBy: personName(v.createdBy),
    createdOn: dateOnly(v.createdAt),
    country: v.country || '',
    ownership: v.ownership || '',
    businessUnit: v.businessUnit || '',
    modifiedOn: dateOnly(v.updatedAt),
    modifiedBy: v.modifiedBy ? personName(v.modifiedBy) : personName(v.createdBy),
    contactPerson: v.contactPerson || undefined,
    email: v.email || undefined,
    category: v.category || undefined,
  };
}

function leadAgeLabel(createdAt: string): string {
  const days = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000)));
  return `${days}d`;
}

function toLeadItem(l: api.RecruitmentLead): LeadItem {
  return {
    id: l.id,
    name: l.name,
    company: l.company || undefined,
    status: l.status,
    source: l.source || '',
    website: l.website || '',
    contactNumber: l.contactNumber || '',
    email: l.email || undefined,
    notes: l.notes || undefined,
    createdOn: dateOnly(l.createdAt),
    createdBy: personName(l.createdBy),
    businessUnit: l.businessUnit || '',
    leadAge: leadAgeLabel(l.createdAt),
    modifiedOn: dateOnly(l.updatedAt),
    lastActivity: l.lastActivityAt ? dateOnly(l.lastActivityAt) : '-',
    zipCode: l.zipCode || '',
  };
}

function toPlacementItem(
  o: api.Offer,
  jobs: JobPostingItem[],
  applicants: ApplicantItem[],
): PlacementItem {
  const jobPostingId = o.candidate?.jobPostingId;
  const job = jobs.find((j) => j.id === jobPostingId);
  const applicant = applicants.find(
    (a) => a.name.toLowerCase() === personName(o.candidate).toLowerCase(),
  );
  return {
    id: o.id,
    applicantName: personName(o.candidate),
    placementCode: o.placementCode || '',
    jobCode: job?.jobCode || '',
    jobTitle: job?.jobTitle || '',
    placementType: o.placementType || '',
    clientPrimeVendor: o.clientPrimeVendor || '',
    businessUnit: o.businessUnit || '',
    clientBillRate: o.clientBillRate || '',
    payRate: o.payRate || '',
    perDiemHr: o.perDiemHr || '',
    overhead: o.overhead || '',
    margin: o.margin || '',
    createdOn: dateOnly(o.createdAt),
    createdBy: personName(o.createdBy),
    status: api.OFFER_STATUS_LABELS[o.status] || o.status,
    clientJobId: job?.clientJobId || '',
    mobileNumber: applicant?.mobile || '',
    location: [applicant?.city, applicant?.state].filter(Boolean).join(', '),
  };
}

function toEboardingItem(e: api.EboardingRecord): EboardingItem {
  return {
    id: e.id,
    name: e.name,
    email: e.email,
    jobTitle: e.jobTitle || '',
    phone: e.phone || '',
    initiatedOn: e.initiatedOn || dateOnly(e.createdAt),
    joiningDate: e.joiningDate || '',
    taxTerms: e.taxTerms || '',
    vendorName: e.vendorName || '',
    vendorEmail: e.vendorEmail || '',
    atsBu: e.atsBu || '',
    status: API_TO_EBOARDING_STATUS[e.status],
    gender: (e.gender as EboardingItem['gender']) || undefined,
    middleName: e.middleName || undefined,
    lastName: e.lastName || undefined,
    country: e.country || undefined,
    state: e.state || undefined,
    city: e.city || undefined,
    zipCode: e.zipCode || undefined,
    employmentType: e.employmentType || undefined,
    streetAddress: e.streetAddress || undefined,
    onboardingCode: e.onboardingCode || undefined,
    alternateEmail: e.alternateEmail || undefined,
    comments: e.comments || undefined,
    client: e.client || undefined,
    startDate: e.startDate || undefined,
    endDate: e.endDate || undefined,
    billRate: e.billRate || undefined,
    payRate: e.payRate || undefined,
    placementType: e.placementType || undefined,
    checklists: e.checklist || undefined,
    createdBy: personName(e.createdBy),
  };
}

function toCreateEboardingInput(item: Partial<EboardingItem>): api.CreateEboardingInput {
  return {
    name: item.name || 'Unknown',
    middleName: item.middleName || null,
    lastName: item.lastName || null,
    email: item.email || '',
    alternateEmail: item.alternateEmail || null,
    phone: item.phone || null,
    gender: item.gender || null,
    jobTitle: item.jobTitle || null,
    country: item.country || null,
    state: item.state || null,
    city: item.city || null,
    zipCode: item.zipCode || null,
    streetAddress: item.streetAddress || null,
    employmentType: item.employmentType || null,
    onboardingCode: item.onboardingCode || null,
    taxTerms: item.taxTerms || null,
    vendorName: item.vendorName || null,
    vendorEmail: item.vendorEmail || null,
    atsBu: item.atsBu || null,
    client: item.client || null,
    startDate: item.startDate || null,
    endDate: item.endDate || null,
    joiningDate: item.joiningDate || null,
    billRate: item.billRate || null,
    payRate: item.payRate || null,
    placementType: item.placementType || null,
    comments: item.comments || null,
    status: item.status ? EBOARDING_STATUS_TO_API[item.status] : 'DRAFT',
    checklist: item.checklists || null,
    initiatedOn: item.initiatedOn || null,
  };
}

// Ceipal's JobActivityItem.type (./types) is lowercase_snake for display; the
// Prisma enum backing it is UPPER_SNAKE_CASE. Map explicitly rather than
// casting, same as EBOARDING_STATUS_TO_API above.
const JOB_ACTIVITY_TYPE_TO_API: Record<JobActivityItem['type'], api.JobActivityType> = {
  creation: 'CREATION',
  status_change: 'STATUS_CHANGE',
  board: 'BOARD',
  task: 'TASK',
  submission: 'SUBMISSION',
  broadcast: 'BROADCAST',
  general: 'GENERAL',
};
const API_TO_JOB_ACTIVITY_TYPE: Record<api.JobActivityType, JobActivityItem['type']> = {
  CREATION: 'creation',
  STATUS_CHANGE: 'status_change',
  BOARD: 'board',
  TASK: 'task',
  SUBMISSION: 'submission',
  BROADCAST: 'broadcast',
  GENERAL: 'general',
};

// Groups a flat, backend-fetched list of a job-detail-panel sub-entity by
// jobPostingId, matching the Record<string, T[]> shape the views already
// consume (job-detail-panel.tsx reads e.g. `jobTasks[job.id]`).
function groupByJobPostingId<TApi extends { jobPostingId: string }, TItem>(
  items: TApi[] | undefined,
  adapt: (item: TApi) => TItem,
): Record<string, TItem[]> {
  const grouped: Record<string, TItem[]> = {};
  for (const item of items ?? []) {
    (grouped[item.jobPostingId] ??= []).push(adapt(item));
  }
  return grouped;
}

function toJobTaskItem(t: api.JobTask): JobTaskItem {
  return {
    id: t.id,
    jobId: t.jobPostingId,
    taskName: t.taskName,
    dueDate: t.dueDate || '',
    timeZone: t.timeZone || '',
    assignedTo: t.assignedTo || '',
    assignedBy: t.assignedBy || '',
    createdOn: dateOnly(t.createdAt),
    modified: dateOnly(t.updatedAt),
    completed: t.completed,
    status: t.status || undefined,
  };
}

function toJobActivityItem(a: api.JobActivity): JobActivityItem {
  return {
    id: a.id,
    jobId: a.jobPostingId,
    timestamp: a.createdAt,
    user: a.user,
    description: a.description,
    type: API_TO_JOB_ACTIVITY_TYPE[a.type],
  };
}

function toJobEmailMergeItem(m: api.JobEmailMerge): JobEmailMergeItem {
  return {
    id: m.id,
    jobId: m.jobPostingId,
    sentBy: m.sentBy,
    sentOn: dateOnly(m.createdAt),
    sentTo: m.sentTo,
    searchString: m.searchString || '',
    zipLocation: m.zipLocation || '',
    subject: m.subject,
    details: m.details,
  };
}

function toJobSubmissionItem(s: api.JobSubmission): JobSubmissionItem {
  return {
    id: s.id,
    jobId: s.jobPostingId,
    candidateId: s.candidateId || undefined,
    name: s.name,
    submittedBy: s.submittedBy,
    submittedOn: dateOnly(s.createdAt),
    contact: s.contact || '',
    location: s.location || '',
    status: s.status,
    statusLabel: s.statusLabel || s.status,
    payRate: s.payRate || 'N/A',
    billRate: s.billRate || 'N/A',
  };
}

function toJobNoteItem(n: api.JobNote): JobNoteItem {
  return {
    id: n.id,
    jobId: n.jobPostingId,
    addedBy: n.addedBy,
    onDate: dateOnly(n.createdAt),
    text: n.text,
    action: n.action || undefined,
  };
}

function toJobDocumentItem(d: api.JobDocument): JobDocumentItem {
  return {
    id: d.id,
    jobId: d.jobPostingId,
    name: d.name,
    addedBy: d.addedBy,
    onDate: dateOnly(d.createdAt),
    type: d.type || '',
    size: d.size || undefined,
  };
}

interface CeipalContextType {
  // Navigation
  activeModule: CeipalModule;
  setActiveModule: (mod: CeipalModule) => void;
  eboardingSubModule: EboardingSubModule;
  setEboardingSubModule: (sub: EboardingSubModule) => void;
  eboardingStatusFilter: EboardingStatus | 'All';
  setEboardingStatusFilter: (status: EboardingStatus | 'All') => void;

  // Views Tabs
  views: CeipalViewTab[];
  activeViewId: string;
  setActiveViewId: (id: string) => void;
  addView: (name: string) => void;

  // Data
  jobs: JobPostingItem[];
  addJob: (job: Partial<Omit<JobPostingItem, 'id'>>) => Promise<JobPostingItem>;
  updateJob: (id: string, partial: Partial<JobPostingItem>) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;

  // Job Sub-Entities (Tasks, Activities, Email Merges, Submissions, Notes, Documents)
  jobTasks: Record<string, JobTaskItem[]>;
  addJobTask: (task: Omit<JobTaskItem, 'id' | 'createdOn' | 'modified'>) => Promise<void>;
  deleteJobTask: (taskId: string, jobId: string) => Promise<void>;
  jobActivities: Record<string, JobActivityItem[]>;
  addJobActivity: (
    activityOrJobId: Omit<JobActivityItem, 'id' | 'timestamp'> | string,
    maybeActivity?: { description: string; type?: JobActivityItem['type']; user?: string },
  ) => Promise<void>;
  jobEmailMerges: Record<string, JobEmailMergeItem[]>;
  addJobEmailMerge: (merge: Omit<JobEmailMergeItem, 'id' | 'sentOn'>) => Promise<void>;
  jobSubmissions: Record<string, JobSubmissionItem[]>;
  addJobSubmission: (submission: Omit<JobSubmissionItem, 'id'>) => Promise<void>;
  deleteJobSubmission: (jobId: string, subId: string) => Promise<void>;
  jobNotes: Record<string, JobNoteItem[]>;
  addJobNote: (note: Omit<JobNoteItem, 'id'>) => Promise<void>;
  deleteJobNote: (jobId: string, noteId: string) => Promise<void>;
  jobDocuments: Record<string, JobDocumentItem[]>;
  addJobDocument: (doc: Omit<JobDocumentItem, 'id'>) => Promise<void>;
  deleteJobDocument: (jobId: string, docId: string) => Promise<void>;
  toggleJobBoardStatus: (jobId: string, board: string) => Promise<void>;
  submitCandidateToJob: (
    jobId: string,
    candidateId: string,
    candidateName?: string,
    stage?: string,
    payRate?: string,
    billRate?: string
  ) => Promise<void>;

  // Applicants
  totalApplicantsCount: number;
  customApplicants: ApplicantItem[];
  addApplicant: (app: Omit<ApplicantItem, 'id'>) => Promise<void>;
  updateApplicant: (id: string, partial: Partial<ApplicantItem>) => Promise<void>;
  toggleApplicantStar: (id: string) => Promise<void>;
  autoScreenApplicant: (id: string) => Promise<api.AutoScreenResult | undefined>;

  // Clients
  clients: ClientItem[];
  addClient: (client: Omit<ClientItem, 'id'>) => Promise<void>;

  // Vendors
  vendors: VendorItem[];
  addVendor: (vendor: Omit<VendorItem, 'id'>) => Promise<void>;

  // Placements
  placements: PlacementItem[];
  addPlacement: (placement: Omit<PlacementItem, 'id'>) => Promise<void>;

  // Leads
  leads: LeadItem[];
  addLead: (lead: Omit<LeadItem, 'id'>) => Promise<void>;

  // eBoarding
  eboardingList: EboardingItem[];
  addEboarding: (item: Omit<EboardingItem, 'id'>) => Promise<void>;
  updateEboardingStatus: (id: string, status: EboardingStatus) => Promise<void>;
  updateEboarding: (id: string, partial: Partial<EboardingItem>) => Promise<void>;
  deleteEboarding: (id: string) => Promise<void>;

  // Side drawer
  isRightDrawerOpen: boolean;
  toggleRightDrawer: () => void;
  // Direct Panel State
  isCreatingJob: boolean;
  setIsCreatingJob: (creating: boolean) => void;
  isCreatingApplicant: boolean;
  setIsCreatingApplicant: (creating: boolean) => void;
  selectedApplicantDetail: ApplicantItem | null;
  setSelectedApplicantDetail: (app: ApplicantItem | null) => void;
  selectedJobDetail: JobPostingItem | null;
  setSelectedJobDetail: (job: JobPostingItem | null) => void;

  // Global search & filters
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  columnFilters: Record<string, ColumnFilter>;
  setColumnFilter: (field: string, filter: ColumnFilter | null) => void;
  clearColumnFilters: () => void;
}

const CeipalContext = createContext<CeipalContextType | undefined>(undefined);

export const CeipalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeModule, setActiveModuleState] = useState<CeipalModule>('home');
  const [eboardingSubModule, setEboardingSubModule] = useState<EboardingSubModule>('dashboard');
  const [eboardingStatusFilter, setEboardingStatusFilter] = useState<EboardingStatus | 'All'>('All');

  // Custom views per module
  const [views, setViews] = useState<CeipalViewTab[]>([
    { id: 'jobs-default', module: 'jobs', label: 'All Jobs' },
    { id: 'applicants-default', module: 'applicants', label: 'All Profiles' },
    { id: 'clients-default', module: 'clients', label: 'Client' },
    { id: 'vendors-default', module: 'vendors', label: 'Vendors' },
    { id: 'leads-default', module: 'leads', label: 'Leads' },
    { id: 'placements-default', module: 'placements', label: 'All Placements' },
  ]);
  const [activeViewId, setActiveViewId] = useState<string>('jobs-default');

  // Right-edge drawer
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(false);

  // Direct Panel Open states
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [isCreatingApplicant, setIsCreatingApplicant] = useState(false);
  const [selectedApplicantDetail, setSelectedApplicantDetail] = useState<ApplicantItem | null>(null);
  const [selectedJobDetail, setSelectedJobDetail] = useState<JobPostingItem | null>(null);

  // Search & column filters
  const [searchQuery, setSearchQuery] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilter>>({});

  // --- Backend-backed data ---

  const { data: jobPostingsRaw } = useJobPostings();
  const createJobPostingMutation = useCreateJobPosting();
  const updateJobPostingMutation = useUpdateJobPosting();
  const closeJobPostingMutation = useCloseJobPosting();
  const deleteJobPostingMutation = useDeleteJobPosting();

  // Client-side persistent state for job extensions, tasks, activities, and email merges
  const [jobExtras, setJobExtras] = useState<Record<string, Partial<JobPostingItem>>>(() =>
    loadFromStorage('ceipal_job_extras', {})
  );

  // Job-detail-panel collaboration sub-entities -- real, shared data now
  // (see server/src/modules/job-collaboration), grouped by jobPostingId to
  // match the Record<string, T[]> shape the views already consume.
  const { data: jobTasksRaw } = useJobTasks();
  const createJobTaskMutation = useCreateJobTask();
  const deleteJobTaskMutation = useDeleteJobTask();
  const jobTasks = useMemo(() => groupByJobPostingId(jobTasksRaw, toJobTaskItem), [jobTasksRaw]);

  const { data: jobActivitiesRaw } = useJobActivities();
  const createJobActivityMutation = useCreateJobActivity();
  const jobActivities = useMemo(
    () => groupByJobPostingId(jobActivitiesRaw, toJobActivityItem),
    [jobActivitiesRaw],
  );

  const { data: jobEmailMergesRaw } = useJobEmailMerges();
  const createJobEmailMergeMutation = useCreateJobEmailMerge();
  const jobEmailMerges = useMemo(
    () => groupByJobPostingId(jobEmailMergesRaw, toJobEmailMergeItem),
    [jobEmailMergesRaw],
  );

  const { data: jobSubmissionsRaw } = useJobSubmissions();
  const createJobSubmissionMutation = useCreateJobSubmission();
  const deleteJobSubmissionMutation = useDeleteJobSubmission();
  const jobSubmissions = useMemo(
    () => groupByJobPostingId(jobSubmissionsRaw, toJobSubmissionItem),
    [jobSubmissionsRaw],
  );

  const { data: jobNotesRaw } = useJobNotes();
  const createJobNoteMutation = useCreateJobNote();
  const deleteJobNoteMutation = useDeleteJobNote();
  const jobNotes = useMemo(() => groupByJobPostingId(jobNotesRaw, toJobNoteItem), [jobNotesRaw]);

  const { data: jobDocumentsRaw } = useJobDocuments();
  const createJobDocumentMutation = useCreateJobDocument();
  const deleteJobDocumentMutation = useDeleteJobDocument();
  const jobDocuments = useMemo(
    () => groupByJobPostingId(jobDocumentsRaw, toJobDocumentItem),
    [jobDocumentsRaw],
  );

  useEffect(() => {
    saveToStorage('ceipal_job_extras', jobExtras);
  }, [jobExtras]);

  const jobs = useMemo(() => {
    return (jobPostingsRaw ?? []).map((jp) => {
      const base = toJobPostingItem(jp);
      const extra = jobExtras[jp.id] || {};
      return {
        ...base,
        // jobExtras is a per-browser localStorage cache, not shared across
        // users/devices. It must never shadow a field the backend actually
        // persists -- industry/clearance/tags/boardStatus round-trip for
        // real now too (see toJobPostingItem), same reasoning as
        // primarySkills/payRate/experience/numberOfPositions/owner below.
        // assignedTo is the one remaining field with no backend column.
        assignedTo: extra.assignedTo ?? base.assignedTo,
      };
    });
  }, [jobPostingsRaw, jobExtras]);

  const addJobTask = async (task: Omit<JobTaskItem, 'id' | 'createdOn' | 'modified'>) => {
    await createJobTaskMutation.mutateAsync({
      jobPostingId: task.jobId,
      taskName: task.taskName,
      dueDate: task.dueDate,
      timeZone: task.timeZone,
      assignedTo: task.assignedTo,
      assignedBy: task.assignedBy,
      status: task.status,
      completed: task.completed,
    });
    await addJobActivity({
      jobId: task.jobId,
      user: task.assignedBy,
      description: `Task "${task.taskName}" assigned to ${task.assignedTo} with due date ${task.dueDate}`,
      type: 'task',
    });
    toast.success(`Task "${task.taskName}" added successfully`);
  };

  const deleteJobTask = async (taskId: string, _jobId: string) => {
    await deleteJobTaskMutation.mutateAsync(taskId);
    toast.success('Task removed');
  };

  const addJobActivity = async (
    activityOrJobId: Omit<JobActivityItem, 'id' | 'timestamp'> | string,
    maybeActivity?: { description: string; type?: JobActivityItem['type']; user?: string },
  ) => {
    const activity: Omit<JobActivityItem, 'id' | 'timestamp'> =
      typeof activityOrJobId === 'string' && maybeActivity
        ? {
            jobId: activityOrJobId,
            description: maybeActivity.description,
            type: maybeActivity.type || 'general',
            user: maybeActivity.user || 'Admin',
          }
        : (activityOrJobId as Omit<JobActivityItem, 'id' | 'timestamp'>);

    await createJobActivityMutation.mutateAsync({
      jobPostingId: activity.jobId,
      description: activity.description,
      user: activity.user,
      type: JOB_ACTIVITY_TYPE_TO_API[activity.type],
    });
  };

  const addJobEmailMerge = async (merge: Omit<JobEmailMergeItem, 'id' | 'sentOn'>) => {
    await createJobEmailMergeMutation.mutateAsync({
      jobPostingId: merge.jobId,
      subject: merge.subject,
      details: merge.details,
      sentBy: merge.sentBy,
      sentTo: merge.sentTo,
      searchString: merge.searchString,
      zipLocation: merge.zipLocation,
    });
    await addJobActivity({
      jobId: merge.jobId,
      user: merge.sentBy,
      description: `Email broadcast "${merge.subject}" sent to ${merge.sentTo}`,
      type: 'broadcast',
    });
    toast.success(`Email merge broadcast sent to ${merge.sentTo}!`);
  };

  // boardStatus has no real backend column (see the `jobs` useMemo comment
  // above), so it stays in the jobExtras local cache -- everything else
  // this triggers (the activity log entry) is real.
  const toggleJobBoardStatus = async (jobId: string, board: string) => {
    const bKey = board.toLowerCase();
    const current = jobs.find((j) => j.id === jobId)?.boardStatus || {
      linkedin: true,
      indeed: true,
      ziprecruiter: true,
      glassdoor: false,
    };
    const nextState = !current[bKey];
    const updated = { ...current, [bKey]: nextState };
    await updateJobPostingMutation.mutateAsync({ id: jobId, input: { boardStatus: updated } });
    await addJobActivity({
      jobId,
      user: 'System',
      description: `Job has been ${nextState ? 'published to' : 'unpublished from'} ${board}`,
      type: 'board',
    });
    toast.info(`Job ${nextState ? 'published to' : 'unpublished from'} ${board}`);
  };

  const submitCandidateToJob = async (
    jobId: string,
    candidateId: string,
    candidateName?: string,
    stage: string = 'client_submissions',
    payRate?: string,
    billRate?: string,
  ) => {
    const cand = customApplicants.find((c) => c.id === candidateId);
    const finalName = candidateName || (cand ? cand.name : 'Applicant');
    try {
      await updateCandidateMutation.mutateAsync({
        id: candidateId,
        input: { jobPostingId: jobId, stage: 'SOURCED' },
      });
    } catch {
      // Non-blocking fallback
    }
    const statusLabel =
      stage === 'client_submissions'
        ? 'Under Client Review'
        : stage === 'interviews'
          ? 'Client Interview'
          : stage === 'confirmations'
            ? 'Offer Confirmed'
            : stage === 'placements'
              ? 'Placed'
              : 'Screening Passed';
    await createJobSubmissionMutation.mutateAsync({
      jobPostingId: jobId,
      candidateId,
      name: finalName,
      status: stage,
      submittedBy: 'Recruiter',
      contact: cand?.email || 'N/A',
      location: [cand?.city, cand?.state].filter(Boolean).join(', ') || 'Canada',
      statusLabel,
      payRate: payRate || 'N/A',
      billRate: billRate || 'N/A',
    });
    await addJobActivity({
      jobId,
      user: 'Recruiter',
      description: `Candidate ${finalName} submitted to requisition`,
      type: 'submission',
    });
    toast.success(`Candidate ${finalName} submitted to this job!`);
  };

  const addJobSubmission = async (sub: Omit<JobSubmissionItem, 'id'>) => {
    await createJobSubmissionMutation.mutateAsync({
      jobPostingId: sub.jobId,
      candidateId: sub.candidateId,
      name: sub.name,
      status: sub.status,
      submittedBy: sub.submittedBy,
      contact: sub.contact,
      location: sub.location,
      statusLabel: sub.statusLabel,
      payRate: sub.payRate,
      billRate: sub.billRate,
    });
  };

  const deleteJobSubmission = async (_jobId: string, subId: string) => {
    await deleteJobSubmissionMutation.mutateAsync(subId);
    toast.success('Submission removed');
  };

  const addJobNote = async (note: Omit<JobNoteItem, 'id'>) => {
    await createJobNoteMutation.mutateAsync({
      jobPostingId: note.jobId,
      text: note.text,
      action: note.action,
      addedBy: note.addedBy,
    });
  };

  const deleteJobNote = async (_jobId: string, noteId: string) => {
    await deleteJobNoteMutation.mutateAsync(noteId);
    toast.success('Note removed');
  };

  const addJobDocument = async (doc: Omit<JobDocumentItem, 'id'>) => {
    await createJobDocumentMutation.mutateAsync({
      jobPostingId: doc.jobId,
      name: doc.name,
      type: doc.type,
      size: doc.size,
      addedBy: doc.addedBy,
    });
  };

  const deleteJobDocument = async (_jobId: string, docId: string) => {
    await deleteJobDocumentMutation.mutateAsync(docId);
    toast.success('Document removed');
  };

  const { data: candidatesRaw } = useCandidates();
  const createCandidateMutation = useCreateCandidate();
  const updateCandidateMutation = useUpdateCandidate();
  const customApplicants = useMemo(
    () => (candidatesRaw ?? []).map((c, idx) => toApplicantItem(c, idx)),
    [candidatesRaw]
  );

  const { data: clientsRaw } = useClients();
  const createClientMutation = useCreateClient();
  const clients = useMemo(() => (clientsRaw ?? []).map(toClientItem), [clientsRaw]);

  const { data: vendorsRaw } = useVendors();
  const createVendorMutation = useCreateVendor();
  const vendors = useMemo(() => (vendorsRaw ?? []).map(toVendorItem), [vendorsRaw]);

  const { data: leadsRaw } = useRecruitmentLeads();
  const createLeadMutation = useCreateRecruitmentLead();
  const leads = useMemo(() => (leadsRaw ?? []).map(toLeadItem), [leadsRaw]);

  const { data: offersRaw } = useOffers();
  const createOfferMutation = useCreateOffer();
  const placements = useMemo(
    () => (offersRaw ?? []).map((o) => toPlacementItem(o, jobs, customApplicants)),
    [offersRaw, jobs, customApplicants],
  );

  const { data: eboardingRaw } = useEboardings();
  const createEboardingMutation = useCreateEboarding();
  const updateEboardingRecordMutation = useUpdateEboardingRecord();
  const updateEboardingStatusMutation = useUpdateEboardingStatus();
  const deleteEboardingRecordMutation = useDeleteEboardingRecord();
  const eboardingList = useMemo(() => (eboardingRaw ?? []).map(toEboardingItem), [eboardingRaw]);

  const totalApplicantsCount = customApplicants.length;

  const setActiveModule = useCallback((mod: CeipalModule) => {
    setActiveModuleState(mod);
    setSearchQuery('');
    setColumnFilters({});
  }, []);

  const toggleRightDrawer = () => {
    setIsRightDrawerOpen((prev) => !prev);
  };

  const addView = (name: string) => {
    const newTab: CeipalViewTab = {
      id: `view-${Date.now()}`,
      module: activeModule,
      label: name,
      isCustom: true,
    };
    setViews((prev) => [...prev, newTab]);
    setActiveViewId(newTab.id);
  };

  // Resolves a job posting by title (case-insensitive), auto-creating a
  // minimal one if the Ceipal form's free-typed title doesn't match an
  // existing posting -- see file header.
  async function resolveJobPostingId(jobTitle: string | undefined): Promise<string> {
    const title = (jobTitle || '').trim();
    const existing = jobs.find((j) => j.jobTitle.toLowerCase() === title.toLowerCase());
    if (existing) return existing.id;
    const created = await createJobPostingMutation.mutateAsync(
      toCreateJobPostingInput({ jobTitle: title || 'Untitled Role' }),
    );
    return created.id;
  }

  // Every mutation below uses mutateAsync and lets its error propagate
  // (rather than fire-and-forget .mutate()) so the calling view's try/catch
  // can tell a real failure apart from success -- otherwise a validation or
  // network error would leave the "Add" modal closing and the form resetting
  // as if the record had actually been saved.

  const addJob = async (newJob: Partial<Omit<JobPostingItem, 'id'>>): Promise<JobPostingItem> => {
    const created = await createJobPostingMutation.mutateAsync(toCreateJobPostingInput(newJob));
    // assignedTo is the only field jobExtras still needs to carry -- it has
    // no backend column (see the `jobs` useMemo comment).
    if (newJob.assignedTo) {
      setJobExtras((prev) => ({ ...prev, [created.id]: { assignedTo: newJob.assignedTo } }));
    }
    const user = newJob.recruitmentManager || 'Admin';
    addJobActivity({
      jobId: created.id,
      user,
      description: `Job ${created.jobCode || 'posting'} "${newJob.jobTitle}" created for client "${newJob.client || 'Direct Client'}"`,
      type: 'creation',
    });
    return toJobPostingItem(created);
  };

  const updateJob = async (id: string, partial: Partial<JobPostingItem>) => {
    if (partial.assignedTo !== undefined) {
      setJobExtras((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), assignedTo: partial.assignedTo } }));
    }
    await updateJobPostingMutation.mutateAsync({ id, input: toUpdateJobPostingInput(partial) });
    if (partial.jobStatus) {
      addJobActivity({
        jobId: id,
        user: 'Recruitment Team',
        description: `Job status updated to [ ${partial.jobStatus} ]`,
        type: 'status_change',
      });
    }
  };

  const deleteJob = async (id: string) => {
    try {
      await deleteJobPostingMutation.mutateAsync(id);
    } catch {
      await closeJobPostingMutation.mutateAsync(id).catch(() => {});
    }

    // Remove from local storage extras
    setJobExtras((prev) => {
      const next = { ...prev };
      delete next[id];
      saveToStorage('ceipal_job_extras', next);
      return next;
    });
  };

  const addApplicant = async (app: Omit<ApplicantItem, 'id'>) => {
    const jobPostingId = await resolveJobPostingId(app.jobTitle);
    const { firstName, lastName } = splitName(app.name);
    await createCandidateMutation.mutateAsync({
      ...toCandidateProfileInput(app),
      firstName,
      lastName,
      jobPostingId,
    });
  };

  const updateApplicant = async (id: string, partial: Partial<ApplicantItem>) => {
    const input = toCandidateProfileInput(partial);
    if (partial.name !== undefined) {
      const { firstName, lastName } = splitName(partial.name);
      input.firstName = firstName;
      input.lastName = lastName;
    }
    await updateCandidateMutation.mutateAsync({ id, input });
  };

  const toggleApplicantStar = async (id: string) => {
    const current = customApplicants.find((a) => a.id === id);
    if (!current) return;
    await updateCandidateMutation.mutateAsync({ id, input: { isStarred: !current.isStarred } });
  };

  const autoScreenApplicant = async (id: string) => {
    try {
      const res = await api.autoScreenCandidate(id);
      if (res?.message) {
        toast.success(res.message);
      }
      return res;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Auto-screening failed');
      return undefined;
    }
  };

  const addClient = async (client: Omit<ClientItem, 'id'>) => {
    await createClientMutation.mutateAsync({
      name: client.name,
      contactNumber: client.contactNumber,
      website: client.website,
      industry: client.industry,
      status: client.status,
      category: client.category,
      businessUnit: client.businessUnit,
      displayOnJob: client.displayOnJob !== 'No',
    });
  };

  const addVendor = async (vendor: Omit<VendorItem, 'id'>) => {
    await createVendorMutation.mutateAsync({
      name: vendor.name,
      website: vendor.website,
      contactNumber: vendor.contactNumber,
      state: vendor.state,
      country: vendor.country,
      ownership: vendor.ownership,
      businessUnit: vendor.businessUnit,
      contactPerson: vendor.contactPerson,
      email: vendor.email,
      category: vendor.category,
    });
  };

  const addPlacement = async (placement: Omit<PlacementItem, 'id'>) => {
    const existingCandidate = customApplicants.find(
      (a) => a.name.toLowerCase() === placement.applicantName.trim().toLowerCase(),
    );
    let candidateId = existingCandidate?.id;
    if (!candidateId) {
      const jobPostingId = await resolveJobPostingId(placement.jobTitle);
      const { firstName, lastName } = splitName(placement.applicantName);
      const createdCandidate = await createCandidateMutation.mutateAsync({ firstName, lastName, jobPostingId });
      candidateId = createdCandidate.id;
    }
    await createOfferMutation.mutateAsync({
      candidateId,
      // The ATS's Offer.salary is an annual number; this staffing-placement
      // form tracks rates as display strings (payRate/clientBillRate)
      // instead, so there's no real number to put here.
      salary: 0,
      placementCode: placement.placementCode,
      placementType: placement.placementType,
      clientPrimeVendor: placement.clientPrimeVendor,
      businessUnit: placement.businessUnit,
      clientBillRate: placement.clientBillRate,
      payRate: placement.payRate,
      perDiemHr: placement.perDiemHr,
      overhead: placement.overhead,
      margin: placement.margin,
    });
  };

  const addLead = async (lead: Omit<LeadItem, 'id'>) => {
    await createLeadMutation.mutateAsync({
      name: lead.name,
      company: lead.company,
      status: lead.status,
      source: lead.source,
      website: lead.website,
      contactNumber: lead.contactNumber,
      email: lead.email,
      notes: lead.notes,
      businessUnit: lead.businessUnit,
      zipCode: lead.zipCode,
    });
  };

  const addEboarding = async (item: Omit<EboardingItem, 'id'>) => {
    await createEboardingMutation.mutateAsync(toCreateEboardingInput(item));
  };

  const updateEboardingStatusFn = async (id: string, status: EboardingStatus) => {
    await updateEboardingStatusMutation.mutateAsync({ id, status: EBOARDING_STATUS_TO_API[status] });
  };

  const updateEboardingFn = async (id: string, partial: Partial<EboardingItem>) => {
    await updateEboardingRecordMutation.mutateAsync({ id, input: toCreateEboardingInput(partial) });
  };

  const deleteEboardingFn = async (id: string) => {
    await deleteEboardingRecordMutation.mutateAsync(id);
  };

  const setColumnFilter = (field: string, filter: ColumnFilter | null) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      if (!filter || !filter.value.trim()) {
        delete next[field];
      } else {
        next[field] = filter;
      }
      return next;
    });
  };

  const clearColumnFilters = () => {
    setColumnFilters({});
  };

  return (
    <CeipalContext.Provider
      value={{
        activeModule,
        setActiveModule,
        eboardingSubModule,
        setEboardingSubModule,
        eboardingStatusFilter,
        setEboardingStatusFilter,
        views,
        activeViewId,
        setActiveViewId,
        addView,
        jobs,
        addJob,
        updateJob,
        deleteJob,
        jobTasks,
        addJobTask,
        deleteJobTask,
        jobActivities,
        addJobActivity,
        jobEmailMerges,
        addJobEmailMerge,
        jobSubmissions,
        addJobSubmission,
        deleteJobSubmission,
        jobNotes,
        addJobNote,
        deleteJobNote,
        jobDocuments,
        addJobDocument,
        deleteJobDocument,
        toggleJobBoardStatus,
        submitCandidateToJob,
        totalApplicantsCount,
        customApplicants,
        addApplicant,
        updateApplicant,
        toggleApplicantStar,
        autoScreenApplicant,
        clients,
        addClient,
        vendors,
        addVendor,
        placements,
        addPlacement,
        leads,
        addLead,
        eboardingList,
        addEboarding,
        updateEboardingStatus: updateEboardingStatusFn,
        updateEboarding: updateEboardingFn,
        deleteEboarding: deleteEboardingFn,
        isRightDrawerOpen,
        toggleRightDrawer,
        isCreatingJob,
        setIsCreatingJob,
        isCreatingApplicant,
        setIsCreatingApplicant,
        selectedApplicantDetail,
        setSelectedApplicantDetail,
        selectedJobDetail,
        setSelectedJobDetail,
        searchQuery,
        setSearchQuery,
        columnFilters,
        setColumnFilter,
        clearColumnFilters,
      }}
    >
      {children}
    </CeipalContext.Provider>
  );
};

export function useCeipal() {
  const ctx = useContext(CeipalContext);
  if (!ctx) {
    throw new Error('useCeipal must be used within CeipalProvider');
  }
  return ctx;
}
