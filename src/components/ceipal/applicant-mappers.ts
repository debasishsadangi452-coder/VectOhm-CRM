import * as api from '@/lib/api/recruitment';
import { ApplicantItem } from './types';

// Pulled out of ceipal-context.tsx so these pure mapping/conversion
// functions can be unit tested directly (see applicant-mappers.test.ts)
// without pulling in the whole CeipalProvider + TanStack Query stack.

export function personName(p: { firstName: string; lastName: string } | null | undefined): string {
  return p ? `${p.firstName} ${p.lastName}`.trim() : '';
}

// Create/detail panel free-text and select fields (src/components/ceipal/views)
// don't line up 1:1 with the backend's typed columns (totalExperienceYears is a
// Float, noticePeriodDays an Int, ...), so these convert between the two
// instead of silently dropping the value on write or blanking it on read.

export function parseExperienceYears(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const match = text.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : undefined;
}

export function formatExperienceYears(years: number | undefined): string {
  if (years === undefined || years === null || years <= 0) return '';
  return `${Number.isInteger(years) ? years : years.toFixed(1)}+ Years`;
}

export function parseSalary(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const digits = text.replace(/[^0-9.]/g, '');
  const num = parseFloat(digits);
  return isNaN(num) ? undefined : num;
}

export function formatSalary(amount: number | null | undefined): string {
  if (!amount) return '';
  return `$${amount.toLocaleString('en-US')} / yr`;
}

// Distinct day counts per option so the mapping round-trips without collisions.
export const NOTICE_PERIOD_DAYS: Record<string, number> = {
  'Immediate': 0,
  '2 Weeks / Immediate': 14,
  '1 Month': 30,
  '2 Months': 60,
  'Negotiable': 45,
};
const DAYS_TO_NOTICE_PERIOD: Record<number, string> = Object.fromEntries(
  Object.entries(NOTICE_PERIOD_DAYS).map(([label, days]) => [days, label]),
);

export function parseNoticePeriodDays(text: string | undefined): number | undefined {
  if (!text) return undefined;
  return NOTICE_PERIOD_DAYS[text];
}

export function formatNoticePeriodDays(days: number | undefined): string {
  if (days === undefined || days === null) return '';
  return DAYS_TO_NOTICE_PERIOD[days] || '';
}

// Shared by addApplicant (create) and updateApplicant (patch) so the two
// don't drift on which ApplicantItem fields actually reach the backend --
// this is the exact set that create-applicant-panel/applicant-detail-panel
// collect but that used to only ever land in resume-storage.ts's localStorage.
export function toCandidateProfileInput(app: Partial<ApplicantItem>): api.UpdateCandidateInput {
  const input: api.UpdateCandidateInput = {};
  if (app.email !== undefined) input.email = app.email || undefined;
  if (app.mobile !== undefined) input.phone = app.mobile || undefined;
  if (app.city !== undefined) input.city = app.city || undefined;
  if (app.state !== undefined) input.state = app.state || undefined;
  if (app.isStarred !== undefined) input.isStarred = app.isStarred;
  if (app.source !== undefined) input.source = app.source;
  if (app.jobTitle !== undefined) input.currentTitle = app.jobTitle || undefined;
  if (app.totalExperience !== undefined) input.totalExperienceYears = parseExperienceYears(app.totalExperience);
  if (app.currentSalary !== undefined) input.currentSalary = parseSalary(app.currentSalary);
  if (app.expectedSalary !== undefined) input.expectedSalary = parseSalary(app.expectedSalary);
  if (app.noticePeriod !== undefined) input.noticePeriodDays = parseNoticePeriodDays(app.noticePeriod);
  if (app.summary !== undefined) input.summary = app.summary || undefined;
  if (app.educationDegree !== undefined) input.educationDegree = app.educationDegree || undefined;
  if (app.educationInstitution !== undefined) input.educationInstitution = app.educationInstitution || undefined;
  if (app.educationYear !== undefined) input.educationYear = app.educationYear || undefined;
  if (app.workAuthorization !== undefined) input.workAuthorization = app.workAuthorization || undefined;
  if (app.willingToRelocate !== undefined) input.willingToRelocate = app.willingToRelocate || undefined;
  if (app.skills !== undefined) {
    const skills = Array.isArray(app.skills)
      ? app.skills
      : app.skills
        ? app.skills.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
    input.skills = skills;
  }
  if (app.certifications !== undefined) input.certifications = app.certifications ?? [];
  if (app.resumeUrl !== undefined) {
    // blob: URLs only resolve in the tab that created them (the backend
    // upload failed and the caller fell back to one) -- never worth
    // persisting server-side since they'd be dead links everywhere else.
    input.resumeUrl = app.resumeUrl && !app.resumeUrl.startsWith('blob:') ? app.resumeUrl : undefined;
  }
  return input;
}

export function toApplicantItem(c: api.Candidate, index: number = 0): ApplicantItem {
  const isNumeric = /^\d{5,}$/.test(c.id);
  const displayId = isNumeric ? c.id : String(10000 + index);
  return {
    id: c.id,
    displayId,
    name: `${c.firstName} ${c.lastName}`.trim(),
    email: c.email || '',
    mobile: c.phone || '',
    city: c.city || '',
    source: (c.source as ApplicantItem['source']) || 'Resume Inbox',
    state: c.state || '',
    status: api.CANDIDATE_STAGE_LABELS[c.stage] || c.stage,
    jobTitle: c.jobPosting?.title || c.currentTitle || '',
    owner: personName(c.owner),
    badgeCount: c.badgeCount ?? 0,
    isStarred: c.isStarred ?? false,
    createdAt: c.appliedAt,
    skills: c.skills,
    totalExperience: formatExperienceYears(c.totalExperienceYears),
    currentSalary: formatSalary(c.currentSalary),
    expectedSalary: formatSalary(c.expectedSalary),
    noticePeriod: formatNoticePeriodDays(c.noticePeriodDays),
    workAuthorization: c.workAuthorization || undefined,
    willingToRelocate: c.willingToRelocate || undefined,
    summary: c.summary || undefined,
    educationDegree: c.educationDegree || undefined,
    educationInstitution: c.educationInstitution || undefined,
    educationYear: c.educationYear || undefined,
    certifications: c.certifications,
    // Kept as the backend-relative path the API returns; resolved to an
    // absolute URL at render time (see resolveApiAssetUrl in
    // applicant-detail-panel.tsx) so it isn't locked to one environment's origin.
    resumeUrl: c.resumeUrl || undefined,
    // AI Match Scores & Assessment
    aiMatchScore: c.aiMatchScore,
    fitBadge: c.fitBadge,
    aiSummary: c.aiSummary || undefined,
  };
}
