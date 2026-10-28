import { apiFetch, apiUploadForm } from "./client";

// Public, unauthenticated careers-site API -- backs src/routes/careers.tsx
// and careers.$jobId.tsx. Every call passes skipAuthRetry: true: apiFetch's
// proactive-refresh check treats "no token" as "expired session" and would
// otherwise force-redirect an anonymous visitor to /login before the request
// even sends (see client.ts).

export interface PublicJobPosting {
  id: string;
  jobCode: string | null;
  title: string;
  description: string | null;
  location: string | null;
  employmentType: string;
  skillsRequired: string[];
  minExperienceYears: number;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string;
  salaryPeriod: string;
  createdAt: string;
  hiringDepartment: { name: string } | null;
}

export function getOpenJobPostings() {
  return apiFetch<PublicJobPosting[]>("/careers/jobs", { skipAuthRetry: true });
}

export function getOpenJobPosting(id: string) {
  return apiFetch<PublicJobPosting>(`/careers/jobs/${id}`, { skipAuthRetry: true });
}

// apiUploadForm has no proactive-refresh redirect logic at all, so it's
// already safe for anonymous use as-is -- no skipAuthRetry needed there.
export function uploadApplicationResume(file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiUploadForm<{ url: string }>("/careers/apply/upload-resume", form);
}

export interface SubmitApplicationInput {
  jobPostingId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  resumeUrl?: string;
  source?: string;
  honeypot?: string;
}

export function submitApplication(input: SubmitApplicationInput) {
  return apiFetch<{ id: string }>("/careers/apply", {
    method: "POST",
    body: JSON.stringify(input),
    skipAuthRetry: true,
  });
}
