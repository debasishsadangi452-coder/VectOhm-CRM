// Intent News: classifies an Apollo news article into the buying-signal
// categories a recruiter/sales rep cares about. Apollo's own category labels
// aren't relied on (their vocabulary varies by plan/version) -- the headline,
// snippet and any category labels are matched together instead.
export const NEWS_SIGNAL_CATEGORIES = [
  "FUNDING",
  "EXPANSION",
  "LEADERSHIP",
  "PRODUCT",
  "PARTNERSHIP",
] as const;

export type NewsSignalCategory = (typeof NEWS_SIGNAL_CATEGORIES)[number];

const PATTERNS: Record<NewsSignalCategory, RegExp> = {
  FUNDING:
    /\b(raises?|raised|funding|series\s+[a-f]\b|seed\s+round|secures?|investment|invests?|invested|valuation|venture|ipo)\b/i,
  EXPANSION:
    /\b(expan(?:d|ds|sion|ding|ded)\b|new\s+(?:office|headquarters|hq|facility|market|region|campus)|opens?\s|opening\s|enters?\s|scal(?:es|ing)\s+up|doubl(?:es|ing)\s+(?:its\s+)?(?:team|headcount|workforce))/i,
  LEADERSHIP:
    /\b(appoints?|appointed|names?\s+(?:new\s+)?(?:ceo|cto|cfo|coo|chief|vp|head|president|director)|named\s+(?:ceo|cto|cfo|coo|chief|vp|head|president|director)|joins?\s+as|joins?\s+(?:the\s+)?(?:team|board|company|executive|leadership)|joined\s+as|promot(?:es|ed|ing|ion)?|new\s+(?:ceo|cto|cfo|coo|chief|vp|president|director|executive|head\s+of)|steps?\s+down|hires?\s+(?:new\s+)?(?:ceo|cto|cfo|coo|chief|vp|head|director|president|executive)|welcomes?\s+.*?\bas\b|welcomes?\s+(?:new\s+)?(?:ceo|cto|cfo|coo|chief|vp|head|president)|person\s+joined|person\s+left|person\s+promoted|management\s+change|executive\s+change|board\s+member|leadership\s+(?:change|transition|shakeup|team|announcement|appointment|shuffle))\b/i,
  PRODUCT: /\b(launch(?:es|ed)?|unveils?|releases?|introduces?|rolls?\s+out|new\s+product|is_developing)\b/i,
  PARTNERSHIP:
    /\b(partner(?:s|ship|ships|ed)?|collaborat\w+|acquir\w+|acquisition|merger|merges?|joint\s+venture|alliance|integrat\w+)\b/i,
};

export function classifyNews(text: string): NewsSignalCategory[] {
  const normalized = text.replace(/_/g, " ");
  return NEWS_SIGNAL_CATEGORIES.filter((c) => PATTERNS[c].test(normalized));
}

// Shown for articles that match none of the signals above: still real news
// about the company, just not one of the named buying signals.
export type NewsLeadCategory = NewsSignalCategory | "OTHER";

export const NEWS_CATEGORY_LABELS: Record<NewsLeadCategory, string> = {
  OTHER: "Company news",
  FUNDING: "Funding",
  EXPANSION: "Expansion",
  LEADERSHIP: "Leadership change",
  PRODUCT: "Product launch",
  PARTNERSHIP: "Partnership / M&A",
};
