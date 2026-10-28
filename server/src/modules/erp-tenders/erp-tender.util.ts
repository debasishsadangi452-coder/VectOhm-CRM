// Parsing and ERP-keyword matching for public tender feeds.

export interface TenderCandidate {
  source: "CANADABUYS" | "SAM_GOV";
  externalId: string;
  country: "CA" | "US";
  title: string;
  description: string | null;
  buyerName: string | null;
  buyerRegion: string | null;
  publishedAt: Date | null;
  closesAt: Date | null;
  noticeUrl: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  isOpen: boolean;
}

// Minimal RFC-4180 CSV parser (quoted fields, escaped quotes, newlines in fields).
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

// Terms that mean the buyer is acquiring, replacing or implementing an
// enterprise business system. Matched terms are stored so a reviewer can see
// why a tender was picked up.
//
// "strong" terms are specific enough to trust anywhere in the notice text.
// "title-only" terms are ordinary words in procurement boilerplate (e.g. SAP
// appears in supplier-registration text, HRIS/EAM/Workday in unrelated
// requirements), so they only count when they appear in the title.
const STRONG_TERMS: Array<{ label: string; re: RegExp }> = [
  { label: "ERP", re: /\bERP\b/ },
  { label: "enterprise resource planning", re: /\benterprise resource planning\b/i },
  { label: "financial management system", re: /\b(financial management|enterprise financial|financial (?:and|&) materiel management) (?:information )?system/i },
  { label: "financial system replacement", re: /\bfinancial system (?:replacement|modernization|modernisation)\b/i },
  { label: "S/4HANA", re: /\bS\/?4\s?HANA\b/i },
  { label: "Oracle ERP", re: /\b(oracle (?:fusion|e-?business|cloud erp)|peoplesoft|jd edwards)\b/i },
  { label: "NetSuite", re: /\bnetsuite\b/i },
  { label: "Dynamics 365", re: /\bdynamics 365\b|\bbusiness central\b/i },
];

const TITLE_ONLY_TERMS: Array<{ label: string; re: RegExp }> = [
  { label: "SAP", re: /\bSAP\b/ },
  { label: "Workday", re: /\bworkday\b/i },
  { label: "HRIS", re: /\b(HRIS|HRMS|human resources information system)\b/i },
  { label: "asset management system", re: /\benterprise asset management\b|\b(?:EAM|CMMS)\b/i },
];

export function matchErpTerms(title: string, description: string | null): string[] {
  const text = `${title}\n${description ?? ""}`;
  const found: string[] = [];
  for (const { label, re } of STRONG_TERMS) {
    if (re.test(text)) found.push(label);
  }
  for (const { label, re } of TITLE_ONLY_TERMS) {
    if (re.test(title) && !found.includes(label)) found.push(label);
  }
  return found;
}

export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value.trim().replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function clean(value: string | null | undefined, max = 2000): string | null {
  const v = (value ?? "").trim();
  return v ? v.slice(0, max) : null;
}
