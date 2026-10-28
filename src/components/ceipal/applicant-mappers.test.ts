import { describe, expect, it } from 'vitest';
import {
  formatExperienceYears,
  formatNoticePeriodDays,
  formatSalary,
  NOTICE_PERIOD_DAYS,
  parseExperienceYears,
  parseNoticePeriodDays,
  parseSalary,
  personName,
  toApplicantItem,
  toCandidateProfileInput,
} from './applicant-mappers';
import type * as api from '@/lib/api/recruitment';

describe('personName', () => {
  it('joins first and last name', () => {
    expect(personName({ firstName: 'Jane', lastName: 'Doe' })).toBe('Jane Doe');
  });

  it('returns an empty string for null/undefined', () => {
    expect(personName(null)).toBe('');
    expect(personName(undefined)).toBe('');
  });
});

describe('parseExperienceYears / formatExperienceYears', () => {
  it('extracts the leading number from free text', () => {
    expect(parseExperienceYears('6+ Years')).toBe(6);
    expect(parseExperienceYears('4 Years')).toBe(4);
    expect(parseExperienceYears('Senior (10+ yrs)')).toBe(10);
    expect(parseExperienceYears('4.5 Years')).toBe(4.5);
  });

  it('returns undefined for empty/missing input', () => {
    expect(parseExperienceYears('')).toBeUndefined();
    expect(parseExperienceYears(undefined)).toBeUndefined();
    expect(parseExperienceYears('Negotiable')).toBeUndefined();
  });

  it('formats back to the "<n>+ Years" convention used across the app', () => {
    expect(formatExperienceYears(6)).toBe('6+ Years');
    expect(formatExperienceYears(4.5)).toBe('4.5+ Years');
  });

  it('formats zero/undefined/negative as an empty string rather than "0+ Years"', () => {
    expect(formatExperienceYears(0)).toBe('');
    expect(formatExperienceYears(undefined)).toBe('');
    expect(formatExperienceYears(-1)).toBe('');
  });
});

describe('parseSalary / formatSalary', () => {
  it('strips currency formatting down to a number', () => {
    expect(parseSalary('$115,000 / yr')).toBe(115000);
    expect(parseSalary('135000')).toBe(135000);
  });

  it('returns undefined when there is nothing numeric to parse', () => {
    expect(parseSalary('')).toBeUndefined();
    expect(parseSalary(undefined)).toBeUndefined();
    expect(parseSalary('Negotiable')).toBeUndefined();
  });

  it('formats back into the "$X / yr" display convention', () => {
    expect(formatSalary(115000)).toBe('$115,000 / yr');
  });

  it('formats zero/null/undefined as an empty string', () => {
    expect(formatSalary(0)).toBe('');
    expect(formatSalary(null)).toBe('');
    expect(formatSalary(undefined)).toBe('');
  });
});

describe('parseNoticePeriodDays / formatNoticePeriodDays', () => {
  it('round-trips every option the create/detail panel selects offer without collisions', () => {
    for (const label of Object.keys(NOTICE_PERIOD_DAYS)) {
      const days = parseNoticePeriodDays(label);
      expect(days).toBeDefined();
      expect(formatNoticePeriodDays(days)).toBe(label);
    }
  });

  it('returns undefined/empty for an unrecognized value', () => {
    expect(parseNoticePeriodDays('Whenever')).toBeUndefined();
    expect(parseNoticePeriodDays(undefined)).toBeUndefined();
    expect(formatNoticePeriodDays(undefined)).toBe('');
    expect(formatNoticePeriodDays(9999)).toBe('');
  });
});

describe('toCandidateProfileInput', () => {
  it('only includes fields that were actually present on the partial applicant', () => {
    const input = toCandidateProfileInput({ email: 'jane@doe.com' });
    expect(input).toEqual({ email: 'jane@doe.com' });
    expect(input).not.toHaveProperty('city');
    expect(input).not.toHaveProperty('skills');
  });

  it('converts a comma-separated skills string into an array', () => {
    const input = toCandidateProfileInput({ skills: 'TypeScript, React,  AWS ' });
    expect(input.skills).toEqual(['TypeScript', 'React', 'AWS']);
  });

  it('passes an already-array skills value through unchanged', () => {
    const input = toCandidateProfileInput({ skills: ['Go', 'Kubernetes'] });
    expect(input.skills).toEqual(['Go', 'Kubernetes']);
  });

  it('drops blob: resume URLs instead of persisting a dead link', () => {
    const input = toCandidateProfileInput({ resumeUrl: 'blob:http://localhost/abc-123' });
    expect(input.resumeUrl).toBeUndefined();
  });

  it('keeps a real backend resume URL', () => {
    const input = toCandidateProfileInput({ resumeUrl: '/candidates/resumes/abc.pdf' });
    expect(input.resumeUrl).toBe('/candidates/resumes/abc.pdf');
  });

  it('converts free-text experience/salary/notice period fields to their typed backend equivalents', () => {
    const input = toCandidateProfileInput({
      totalExperience: '6+ Years',
      currentSalary: '$115,000 / yr',
      expectedSalary: '$135,000 / yr',
      noticePeriod: '1 Month',
    });
    expect(input.totalExperienceYears).toBe(6);
    expect(input.currentSalary).toBe(115000);
    expect(input.expectedSalary).toBe(135000);
    expect(input.noticePeriodDays).toBe(30);
  });

  it('maps jobTitle onto the backend currentTitle column', () => {
    const input = toCandidateProfileInput({ jobTitle: 'Senior Full Stack Engineer' });
    expect(input.currentTitle).toBe('Senior Full Stack Engineer');
  });
});

describe('toApplicantItem', () => {
  const baseCandidate: api.Candidate = {
    id: '11000',
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@doe.com',
    phone: '+1 555 234 5678',
    resumeUrl: '/candidates/resumes/abc.pdf',
    source: 'Resume Inbox',
    stage: 'APPLIED' as api.CandidateStage,
    position: 0,
    rejectionReason: null,
    jobPostingId: 'job-1',
    jobPosting: { id: 'job-1', title: 'Senior Full Stack Engineer' },
    ownerId: 'owner-1',
    owner: { firstName: 'Megan', lastName: 'Foster' } as any,
    departmentId: 'dept-1',
    city: 'Toronto',
    state: 'ON',
    isStarred: true,
    badgeCount: 2,
    skills: ['TypeScript', 'React'],
    totalExperienceYears: 6,
    currentSalary: 115000,
    expectedSalary: 135000,
    noticePeriodDays: 30,
    workAuthorization: 'Authorized / Citizen',
    willingToRelocate: 'Yes (Hybrid / Remote)',
    summary: 'Full stack engineer.',
    educationDegree: 'B.S. Computer Science',
    educationInstitution: 'University of Toronto',
    educationYear: '2018',
    certifications: ['AWS Certified Solutions Architect'],
    currentTitle: 'Senior Full Stack Engineer',
    appliedAt: '2026-01-01T00:00:00.000Z',
    closedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as unknown as api.Candidate;

  it('maps every persisted profile field back onto the ApplicantItem the UI reads', () => {
    const item = toApplicantItem(baseCandidate, 0);

    expect(item).toMatchObject({
      id: '11000',
      name: 'Jane Doe',
      email: 'jane@doe.com',
      mobile: '+1 555 234 5678',
      city: 'Toronto',
      state: 'ON',
      jobTitle: 'Senior Full Stack Engineer',
      owner: 'Megan Foster',
      isStarred: true,
      badgeCount: 2,
      skills: ['TypeScript', 'React'],
      totalExperience: '6+ Years',
      currentSalary: '$115,000 / yr',
      expectedSalary: '$135,000 / yr',
      noticePeriod: '1 Month',
      workAuthorization: 'Authorized / Citizen',
      willingToRelocate: 'Yes (Hybrid / Remote)',
      summary: 'Full stack engineer.',
      educationDegree: 'B.S. Computer Science',
      educationInstitution: 'University of Toronto',
      educationYear: '2018',
      certifications: ['AWS Certified Solutions Architect'],
      resumeUrl: '/candidates/resumes/abc.pdf',
    });
  });

  it('maps AI match scores, fit badges, and AI summary to the applicant item', () => {
    const aiCandidate = {
      ...baseCandidate,
      aiMatchScore: 92.5,
      fitBadge: 'PLATINUM_FIT' as any,
      aiSummary: '92.5% composite match for Senior Full Stack Engineer.',
    };

    const item = toApplicantItem(aiCandidate, 0);
    expect(item.aiMatchScore).toBe(92.5);
    expect(item.fitBadge).toBe('PLATINUM_FIT');
    expect(item.aiSummary).toBe('92.5% composite match for Senior Full Stack Engineer.');
  });

  it('falls back to currentTitle when the candidate has no linked job posting title', () => {
    const item = toApplicantItem({ ...baseCandidate, jobPosting: undefined as any }, 0);
    expect(item.jobTitle).toBe('Senior Full Stack Engineer');
  });

  it('gives a 5-digit displayId to candidates whose id is not already one', () => {
    const item = toApplicantItem({ ...baseCandidate, id: 'uuid-abc-123' }, 3);
    expect(item.displayId).toBe('10003');
  });

  it('keeps a numeric id as its own displayId', () => {
    const item = toApplicantItem({ ...baseCandidate, id: '20456' }, 0);
    expect(item.displayId).toBe('20456');
  });
});

