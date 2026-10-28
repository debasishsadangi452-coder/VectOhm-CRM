export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseRawEmails(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,;]/)
        .map((s) => s.trim().replace(/^<|>$/g, "").replace(/^"|"$/g, ""))
        .filter((s) => EMAIL_RE.test(s)),
    ),
  );
}

// Scans every cell of every sheet row for anything email-shaped rather than
// trying to identify "the" email column -- the file might be a plain list
// with no header at all, or a full contacts export (like the one Export CSV
// on the Contacts page produces) where the email column could be anywhere.
// Since this feature only ever wants emails out of the file, brute-force
// cell scanning is both simpler and more robust than column mapping.
export function extractEmailsFromSheet(rows: string[][]): string[] {
  const found = new Set<string>();
  for (const row of rows) {
    for (const cell of row) {
      const raw = String(cell ?? "").trim();
      if (!raw) continue;
      // Handle comma/semicolon delimited emails in a single cell
      const parts = raw.split(/[\n,;]/).map((p) => p.trim().replace(/^<|>$/g, "").replace(/^"|"$/g, ""));
      for (const part of parts) {
        const lower = part.toLowerCase();
        if (EMAIL_RE.test(lower)) {
          found.add(lower);
        }
      }
    }
  }
  return Array.from(found);
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

function cleanCompanyName(val: string | undefined): string | undefined {
  if (!val) return undefined;
  const cleaned = val
    .trim()
    .replace(/^["'`]|["'`]$/g, "")
    .trim();
  if (!cleaned) return undefined;
  const lower = cleaned.toLowerCase();
  if (
    lower === "none" ||
    lower === "n/a" ||
    lower === "na" ||
    lower === "-" ||
    lower === "unknown" ||
    lower === "not shown" ||
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("www.")
  ) {
    return undefined;
  }
  return cleaned;
}

function normalizeHeader(header: string): string {
  return String(header ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

interface ColumnIndices {
  email?: number;
  firstName?: number;
  lastName?: number;
  fullName?: number;
  companyName?: number;
  title?: number;
  phone?: number;
  linkedinUrl?: number;
  location?: number;
  website?: number;
}

// Scans headers and maps each CRM field to at most ONE best column index.
// This prevents multi-column spreadsheets (like Apollo exports with "Company",
// "Company Linkedin Url", "Company Address", "Company Country", "Company Phone")
// from overwriting the actual Company Name with an address or phone number.
function findHeaderColumnIndices(row: string[]): ColumnIndices {
  const indices: ColumnIndices = {};
  const headers = row.map((cell) => normalizeHeader(cell));

  // 1. Email (critical)
  headers.forEach((h, idx) => {
    if (indices.email == null) {
      if (
        h === "email" ||
        h === "email address" ||
        h === "contact email" ||
        h === "work email" ||
        h === "mail" ||
        h === "e mail"
      ) {
        indices.email = idx;
      }
    }
  });
  if (indices.email == null) {
    headers.forEach((h, idx) => {
      if (indices.email == null && (h.endsWith(" email") || h.includes("email"))) {
        indices.email = idx;
      }
    });
  }

  // 2. Company Name
  // Priority: "company name for emails" > "company name" > "company" > "organization" > "account name"
  // Explicitly ignore columns that describe company attributes (address, city, phone, etc.)
  const isExcludedCompanyHeader = (h: string) => {
    return (
      h.includes("address") ||
      h.includes("city") ||
      h.includes("state") ||
      h.includes("country") ||
      h.includes("phone") ||
      h.includes("linkedin") ||
      h.includes("website") ||
      h.includes("url") ||
      h.includes("size") ||
      h.includes("revenue") ||
      h.includes("technologies") ||
      h.includes("description") ||
      h.includes("funding") ||
      h.includes("domain")
    );
  };

  headers.forEach((h, idx) => {
    if (h === "company name for emails" || h === "company name") {
      indices.companyName = idx;
    }
  });
  if (indices.companyName == null) {
    headers.forEach((h, idx) => {
      if (
        h === "company" ||
        h === "organization" ||
        h === "organisation" ||
        h === "account name" ||
        h === "employer" ||
        h === "account"
      ) {
        indices.companyName = idx;
      }
    });
  }
  if (indices.companyName == null) {
    headers.forEach((h, idx) => {
      if (
        indices.companyName == null &&
        !isExcludedCompanyHeader(h) &&
        (h.includes("company") || h.includes("organization"))
      ) {
        indices.companyName = idx;
      }
    });
  }

  // 3. First Name, Last Name, Full Name
  headers.forEach((h, idx) => {
    if (h === "first name" || h === "firstname" || h === "given name") {
      indices.firstName = idx;
    } else if (h === "last name" || h === "lastname" || h === "surname") {
      indices.lastName = idx;
    } else if (
      h === "full name" ||
      h === "contact name" ||
      h === "lead name" ||
      h === "person name"
    ) {
      indices.fullName = idx;
    }
  });
  if (indices.firstName == null && indices.fullName == null) {
    headers.forEach((h, idx) => {
      if (h === "name") indices.fullName = idx;
      else if (h === "first") indices.firstName = idx;
      else if (h === "last") indices.lastName = idx;
    });
  }

  // 4. Title / Position
  headers.forEach((h, idx) => {
    if (
      h === "title" ||
      h === "job title" ||
      h === "position" ||
      h === "role" ||
      h === "headline" ||
      h === "designation"
    ) {
      indices.title = idx;
    }
  });

  // 5. Phone
  headers.forEach((h, idx) => {
    if (
      h === "phone" ||
      h === "phone number" ||
      h === "mobile" ||
      h === "cell" ||
      h === "direct phone" ||
      h === "work phone"
    ) {
      indices.phone = idx;
    }
  });

  // 6. LinkedIn
  headers.forEach((h, idx) => {
    if (
      h === "person linkedin url" ||
      h === "linkedin url" ||
      h === "linkedin" ||
      h === "linkedin profile"
    ) {
      indices.linkedinUrl = idx;
    }
  });

  // 7. Location
  headers.forEach((h, idx) => {
    if (
      h === "location" ||
      h === "city" ||
      h === "state" ||
      h === "country" ||
      h === "address"
    ) {
      indices.location = idx;
    }
  });

  // 8. Website
  headers.forEach((h, idx) => {
    if (
      h === "website" ||
      h === "company website" ||
      h === "web site" ||
      h === "homepage" ||
      h === "domain"
    ) {
      indices.website = idx;
    }
  });

  return indices;
}

export interface ParsedSpreadsheetContact {
  firstName: string;
  lastName: string;
  email: string;
  companyName?: string;
  title?: string;
  phone?: string;
  linkedinUrl?: string;
  location?: string;
  website?: string;
}

// Parses contacts intelligently from a spreadsheet, extracting full contact
// metadata (first name, last name, email, company, title) when columns exist,
// or gracefully falling back to raw cell scan. Automatically infers company
// name from business email domain when company column is missing.
export function parseSpreadsheetContacts(allRows: string[][]): ParsedSpreadsheetContact[] {
  const result: ParsedSpreadsheetContact[] = [];
  const seenEmails = new Set<string>();
  if (!allRows || allRows.length === 0) return result;

  // Search first 5 rows for a header containing an email column
  let headerRowIdx = -1;
  let indices: ColumnIndices = {};

  for (let r = 0; r < Math.min(5, allRows.length); r++) {
    const row = allRows[r];
    if (!row) continue;
    const detected = findHeaderColumnIndices(row);
    if (detected.email != null) {
      headerRowIdx = r;
      indices = detected;
      break;
    }
  }

  if (headerRowIdx !== -1 && indices.email != null) {
    for (let r = headerRowIdx + 1; r < allRows.length; r++) {
      const row = allRows[r];
      if (!row || row.length === 0) continue;

      const rawEmailCell = indices.email != null ? row[indices.email] : undefined;
      const rawEmail = String(rawEmailCell ?? "")
        .replace(/^["'<]|["'>]$/g, "")
        .trim()
        .toLowerCase();

      if (!rawEmail || !EMAIL_RE.test(rawEmail) || seenEmails.has(rawEmail)) continue;
      seenEmails.add(rawEmail);

      let firstName =
        indices.firstName != null ? String(row[indices.firstName] ?? "").trim() : "";
      let lastName =
        indices.lastName != null ? String(row[indices.lastName] ?? "").trim() : "";
      const fullName =
        indices.fullName != null ? String(row[indices.fullName] ?? "").trim() : "";

      if (!firstName && !lastName && fullName) {
        const parts = fullName.split(/\s+/);
        firstName = parts[0];
        lastName = parts.slice(1).join(" ");
      }

      if (!firstName) {
        const prefix = rawEmail.split("@")[0].split(/[._-]/)[0];
        firstName = prefix.charAt(0).toUpperCase() + prefix.slice(1);
      }

      const rawCompany =
        indices.companyName != null ? String(row[indices.companyName] ?? "").trim() : undefined;
      const companyName = cleanCompanyName(rawCompany) || inferCompanyFromEmail(rawEmail);

      const title =
        indices.title != null ? String(row[indices.title] ?? "").trim() || undefined : undefined;
      const phone =
        indices.phone != null ? String(row[indices.phone] ?? "").trim() || undefined : undefined;
      const linkedinUrl =
        indices.linkedinUrl != null
          ? String(row[indices.linkedinUrl] ?? "").trim() || undefined
          : undefined;
      const location =
        indices.location != null
          ? String(row[indices.location] ?? "").trim() || undefined
          : undefined;
      const website =
        indices.website != null
          ? String(row[indices.website] ?? "").trim() || undefined
          : undefined;

      result.push({
        firstName,
        lastName: lastName || "",
        email: rawEmail,
        companyName,
        title,
        phone,
        linkedinUrl,
        location,
        website,
      });
    }
  } else {
    // Fallback: scan all cells for emails
    for (const row of allRows) {
      if (!row) continue;
      for (const cell of row) {
        const raw = String(cell ?? "").trim();
        if (!raw) continue;
        const parts = raw
          .split(/[\n,;]/)
          .map((p) => p.trim().replace(/^["'<]|["'>]$/g, "").toLowerCase());
        for (const p of parts) {
          if (EMAIL_RE.test(p) && !seenEmails.has(p)) {
            seenEmails.add(p);
            const prefix = p.split("@")[0].split(/[._-]/)[0];
            const firstName = prefix.charAt(0).toUpperCase() + prefix.slice(1);
            const companyName = inferCompanyFromEmail(p);
            result.push({
              firstName,
              lastName: "",
              email: p,
              companyName,
            });
          }
        }
      }
    }
  }

  return result;
}


