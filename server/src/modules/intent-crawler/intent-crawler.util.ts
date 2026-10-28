import type { CrawlItem } from "./intent-crawler.sources";

const ERP_TERM =
  /\b(erp|netsuite|s\/?4\s?hana|sap (?:ecc|business one|s\/4)|dynamics 365|business central|dynamics (?:ax|nav|gp)|odoo|acumatica|oracle (?:fusion|erp)|workday financials|infor (?:cloudsuite|m3|ln)|epicor|sage intacct|sage x3|microsoft dynamics)\b/i;

// Company-side news: it is doing something with an ERP.
const NEWS_INTENT =
  /\b(implement(?:s|ing|ation|ed)?|migrat(?:es|ing|ion|ed)?|go[- ]live|goes live|rolls? out|rollout|selects?|chooses?|chosen|adopts?|replac(?:es|ing|e)|upgrad(?:es|ing|e)|moderni[sz](?:es|ing|ation)|deploys?|launch(?:es|ed)? new|rfp|vendor selection|new erp)\b/i;

// Person-side posts: they are asking for help choosing.
const COMMUNITY_INTENT =
  /\b(looking for|need(?:ing)? an?|recommend(?:ation)?s?|which|best|alternatives?|switch(?:ing)? from|replac(?:e|ing)|migrat(?:e|ing)|evaluat(?:e|ing)|selecting|suggest(?:ions)?|compare|vs\.?)\b/i;

// Content marketing and noise, not a buyer or a company event.
const NEWS_NOISE =
  /^\s*(\d+\s+(best|ways|tips|reasons|steps|top|common)|top\s+\d+|how to|what is|what are|why you|guide to|a guide|the (ultimate|complete) guide)\b|best practices|\b(checklist|methodology|tutorial|webinar|whitepaper|definition)\b/i;
const COMMUNITY_NOISE =
  /who is hiring|who wants to be hired|^\[dead\]$|\b(python|javascript|typescript|react|nextjs|django|laravel|framework|library|sdk|pdf|templating|regex)\b/i;

export function hasErpIntent(item: CrawlItem): boolean {
  if (!item.title.trim()) return false;
  if ((item.kind === "community" ? COMMUNITY_NOISE : NEWS_NOISE).test(item.title)) return false;
  const text = `${item.title} ${item.snippet ?? ""}`;
  // A buyer's post names the ERP in its title; body text mentions are mostly incidental.
  if (!ERP_TERM.test(item.kind === "community" ? item.title : text)) return false;
  return (item.kind === "community" ? COMMUNITY_INTENT : NEWS_INTENT).test(text);
}

// "Stutz Packing Rolls Out ERP System ..." -> "Stutz Packing". Best effort; null when unclear.
const COMPANY_BEFORE_VERB =
  /^(.{2,60}?)\s+(?:selects?|chooses?|implements?|rolls? out|goes? live|go[- ]live|migrates?|moves?|adopts?|deploys?|upgrades?|completes?|launches?|partners?|announces?|picks?|taps?|turns? to|replaces?|standardi[sz]es?)\b/i;

export function guessCompany(item: CrawlItem): string | null {
  if (item.kind !== "news") return null;
  const m = item.title.match(COMPANY_BEFORE_VERB);
  if (!m) return null;
  const name = m[1].trim();
  const words = name.split(/\s+/);
  if (!name || words.length > 6 || !/^[A-Z0-9]/.test(name) || /^(how|why|what|when|the)\b/i.test(name)) return null;
  return name;
}

export function domainOf(url: string, fallback: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    // Google/Bing news links are redirects; the real outlet is the publisher name.
    return /(^|\.)(news\.google\.com|bing\.com)$/.test(host) ? fallback.slice(0, 255) : host;
  } catch {
    return fallback.slice(0, 255);
  }
}
