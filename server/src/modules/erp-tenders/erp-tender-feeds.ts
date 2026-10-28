import { Logger } from "@nestjs/common";
import { clean, parseCsv, parseDate, type TenderCandidate } from "./erp-tender.util";

const logger = new Logger("ErpTenderFeeds");

const CANADABUYS_URL =
  "https://canadabuys.canada.ca/opendata/pub/openTenderNotice-ouvertAvisAppelOffres.csv";
const USER_AGENT = "VenusCRM-TenderWatcher/1.0 (public procurement feed reader)";

async function fetchWithTimeout(url: string, ms: number, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, ...(init.headers ?? {}) },
    });
  } finally {
    clearTimeout(timer);
  }
}

// CanadaBuys open data: one CSV of every open federal tender notice, published
// by the Government of Canada with no key or login. Column names are bilingual
// ("title-titre-eng"); the English column is always the first with that prefix.
export async function fetchCanadaBuysTenders(): Promise<TenderCandidate[]> {
  const res = await fetchWithTimeout(CANADABUYS_URL, 90_000);
  if (!res.ok) throw new Error(`CanadaBuys feed returned HTTP ${res.status}`);
  const rows = parseCsv(await res.text());
  if (rows.length < 2) return [];

  const header = rows[0];
  const col = (prefix: string) => header.findIndex((h) => h.startsWith(prefix));
  const idx = {
    title: col("title-titre-eng"),
    ref: col("referenceNumber"),
    published: col("publicationDate"),
    closing: col("tenderClosingDate"),
    status: col("tenderStatus-appelOffresStatut-eng"),
    buyer: col("contractingEntityName"),
    province: col("contractingEntityAddressProvince"),
    contactName: col("contactInfoName"),
    contactEmail: col("contactInfoEmail"),
    contactPhone: col("contactInfoPhone"),
    url: col("noticeURL"),
    description: col("tenderDescription"),
  };
  if (idx.title < 0 || idx.ref < 0) {
    throw new Error("CanadaBuys feed format changed (title/reference column missing)");
  }

  const out: TenderCandidate[] = [];
  for (const r of rows.slice(1)) {
    const externalId = clean(r[idx.ref], 200);
    const title = clean(r[idx.title], 500);
    if (!externalId || !title) continue;
    out.push({
      source: "CANADABUYS",
      externalId,
      country: "CA",
      title,
      description: clean(idx.description >= 0 ? r[idx.description] : null, 20000),
      buyerName: clean(idx.buyer >= 0 ? r[idx.buyer] : null, 300),
      buyerRegion: clean(idx.province >= 0 ? r[idx.province] : null, 100),
      publishedAt: parseDate(idx.published >= 0 ? r[idx.published] : null),
      closesAt: parseDate(idx.closing >= 0 ? r[idx.closing] : null),
      noticeUrl: clean(idx.url >= 0 ? r[idx.url] : null, 1000),
      contactName: clean(idx.contactName >= 0 ? r[idx.contactName] : null, 200),
      contactEmail: clean(idx.contactEmail >= 0 ? r[idx.contactEmail] : null, 200),
      contactPhone: clean(idx.contactPhone >= 0 ? r[idx.contactPhone] : null, 100),
      isOpen: idx.status < 0 ? true : /open/i.test(r[idx.status] ?? ""),
    });
  }
  return out;
}

const SAM_SEARCH_TERMS = [
  "ERP",
  "enterprise resource planning",
  "financial management system",
  "SAP",
  "Oracle",
  "NetSuite",
  "Dynamics 365",
  "Workday",
];

function samDate(d: Date): string {
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getUTCFullYear()}`;
}

// SAM.gov Opportunities API (US federal). Needs a free API key from
// sam.gov (Account Details -> Public API Key) in SAM_GOV_API_KEY; without it
// this source is skipped. Looks back 30 days, one title search per term.
export async function fetchSamGovTenders(apiKey: string): Promise<TenderCandidate[]> {
  const now = new Date();
  const from = new Date(now.getTime() - 30 * 86_400_000);
  const byId = new Map<string, TenderCandidate>();

  for (const term of SAM_SEARCH_TERMS) {
    const url =
      "https://api.sam.gov/opportunities/v2/search?" +
      new URLSearchParams({
        api_key: apiKey,
        postedFrom: samDate(from),
        postedTo: samDate(now),
        limit: "100",
        title: term,
      }).toString();
    try {
      const res = await fetchWithTimeout(url, 30_000);
      if (!res.ok) {
        logger.warn(`SAM.gov search "${term}" returned HTTP ${res.status}`);
        continue;
      }
      const body: any = await res.json();
      for (const o of body?.opportunitiesData ?? []) {
        const externalId = clean(o.noticeId, 200);
        const title = clean(o.title, 500);
        if (!externalId || !title || byId.has(externalId)) continue;
        const poc = Array.isArray(o.pointOfContact) ? o.pointOfContact[0] : null;
        byId.set(externalId, {
          source: "SAM_GOV",
          externalId,
          country: "US",
          title,
          description: null,
          buyerName: clean(o.fullParentPathName, 300),
          buyerRegion: clean(o.officeAddress?.state, 100),
          publishedAt: parseDate(o.postedDate),
          closesAt: parseDate(o.responseDeadLine),
          noticeUrl: clean(o.uiLink, 1000),
          contactName: clean(poc?.fullName, 200),
          contactEmail: clean(poc?.email, 200),
          contactPhone: clean(poc?.phone, 100),
          isOpen: String(o.active ?? "Yes").toLowerCase() !== "no",
        });
      }
    } catch (err: any) {
      logger.warn(`SAM.gov search "${term}" failed: ${err?.message}`);
    }
  }
  return [...byId.values()];
}
