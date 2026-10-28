// Renders {{firstName}} {{lastName}} {{title}} {{companyName}} placeholders
// in an EmailTemplate's subject/bodyHtml against a real Contact. Shared by
// the Templates preview and (once built) the Sequence send engine, so both
// paths render identically. Unknown/blank fields resolve to "" rather than
// leaving the raw placeholder in the sent email.
export interface MergeFieldSource {
  firstName: string;
  lastName: string;
  title?: string | null;
  companyName?: string | null;
  email?: string | null;
}

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "aol.com",
  "protonmail.com",
  "zoho.com",
  "mail.com",
  "yandex.com",
  "live.com",
  "msn.com",
  "gmx.com",
  "me.com",
  "mac.com",
]);

export function inferCompanyFromEmail(email: string | undefined | null): string | undefined {
  if (!email || !email.includes("@")) return undefined;
  const parts = email.split("@");
  const domain = parts[1]?.toLowerCase().trim();
  if (!domain || FREE_EMAIL_DOMAINS.has(domain)) return undefined;
  const hostParts = domain.split(".");
  const name = hostParts[0];
  if (!name || name.length <= 1) return undefined;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function renderMergeFields(template: string, contact: MergeFieldSource): string {
  const firstName = contact.firstName ?? "";
  const lastName = contact.lastName ?? "";
  const fullName = `${firstName} ${lastName}`.trim();
  const company = contact.companyName ?? "";
  const title = contact.title ?? "";
  const email = contact.email ?? "";

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

