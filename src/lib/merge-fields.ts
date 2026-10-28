// Mirrors server/src/common/utils/merge-fields.ts -- kept in sync manually
// since server/ is a standalone package, not shared with the frontend.
// Used for the Templates live preview only; the real send (once Sequences
// exist) renders server-side against the actual Contact.
export interface MergeFieldSample {
  firstName: string;
  lastName: string;
  title?: string;
  companyName?: string;
  email?: string;
}

export function renderMergeFields(template: string, sample: MergeFieldSample): string {
  const firstName = sample.firstName ?? "";
  const lastName = sample.lastName ?? "";
  const fullName = `${firstName} ${lastName}`.trim();
  const company = sample.companyName ?? "";
  const title = sample.title ?? "";
  const email = sample.email ?? "";

  const values: Record<string, string> = {
    firstName,
    first_name: firstName,
    firstname: firstName,
    lastName,
    last_name: lastName,
    lastname: lastName,
    name: fullName || firstName,
    fullName: fullName || firstName,
    full_name: fullName || firstName,
    title,
    jobTitle: title,
    job_title: title,
    companyName: company,
    company_name: company,
    companyname: company,
    company,
    email,
  };
  return template.replace(/\{\{\s*([\w]+)\s*\}\}/g, (match, key: string) =>
    key in values ? values[key] : match,
  );
}

