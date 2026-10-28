// Searches the crawler runs on every pass. All go through Google News RSS:
// it covers press wires and trade sites via `site:` and needs no API key.
export const INTENT_SEARCH_QUERIES: string[] = [
  // ERP / AI modernization
  '"S/4HANA" (selects OR migration OR "go-live" OR implements)',
  '("Oracle Cloud ERP" OR "Oracle Fusion" OR NetSuite) (selects OR implements OR deploys)',
  '"Dynamics 365" (selects OR implements OR "goes live")',
  '(Workday OR ServiceNow) (selects OR deploys OR implements)',
  '"ERP" (modernization OR transformation OR migration) company',
  '"generative AI" (rollout OR deploys) enterprise CIO',
  // Funding / expansion
  'raises ("Series A" OR "Series B" OR "Series C" OR "Series D") funding',
  '(opens OR expands) ("new headquarters" OR "new office" OR "new facility")',
  '(acquires OR acquisition) "to expand" company',
  // Hiring surges
  '("to hire" OR "plans to hire" OR "hiring spree") (jobs OR employees OR engineers)',
  // Press release wires
  'site:prnewswire.com (ERP OR "digital transformation" OR "Series" OR expansion)',
  'site:businesswire.com (ERP OR "digital transformation" OR "Series" OR expansion)',
  'site:globenewswire.com (ERP OR "digital transformation" OR "Series" OR expansion)',
  // Tech & industry news
  "site:erp.today",
  "site:diginomica.com",
  "site:ciodive.com",
  "site:techcrunch.com raises",
];

export function googleNewsRssUrl(query: string, window = "2d"): string {
  const q = encodeURIComponent(`${query} when:${window}`);
  return `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
}

export interface RssItem {
  title: string;
  link: string;
  publishedAt: string | null;
  sourceName: string | null;
  sourceDomain: string | null;
}

function decode(s: string): string {
  return s
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .trim();
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : null;
}

// shortcut: regex RSS parsing, fine for Google News' flat <item> feed; switch to an XML parser if other feed formats are added.
export function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  for (const m of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const block = m[1];
    const rawTitle = tag(block, "title");
    const link = tag(block, "link");
    if (!rawTitle || !link) continue;
    const sourceName = tag(block, "source");
    const sourceUrl = block.match(/<source\b[^>]*url="([^"]+)"/i)?.[1] ?? null;
    let sourceDomain: string | null = null;
    try {
      sourceDomain = sourceUrl ? new URL(sourceUrl).hostname.replace(/^www\./, "") : null;
    } catch {
      sourceDomain = null;
    }
    const pub = tag(block, "pubDate");
    const pubDate = pub ? new Date(pub) : null;
    // Google News appends " - Publisher" to every headline.
    const title = sourceName && rawTitle.endsWith(` - ${sourceName}`) ? rawTitle.slice(0, -(sourceName.length + 3)) : rawTitle;
    items.push({
      title,
      link,
      publishedAt: pubDate && !isNaN(pubDate.getTime()) ? pubDate.toISOString() : null,
      sourceName,
      sourceDomain,
    });
  }
  return items;
}
