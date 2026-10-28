// Open, bot-friendly sources of people and companies shopping for an ERP. Each
// source returns plain items; the service filters them for buying intent and
// feeds the survivors through the same ingest as the Chrome extension.
//
// Checked reachable from a server: Google News RSS, Bing News RSS, Hacker News
// (Algolia) and the Stack Exchange API. Reddit and GlobeNewswire answer 403 to
// server requests, so they are deliberately not here.

export interface CrawlItem {
  title: string;
  url: string;
  publisher: string;
  publishedAt?: string;
  snippet?: string;
  kind: "news" | "community";
}

export interface CrawlSource {
  id: string;
  label: string;
  kind: CrawlItem["kind"];
  fetch: () => Promise<CrawlItem[]>;
}

const UA = "VenusCRM-IntentCrawler/1.0 (+https://venushiring.com)";
const TIMEOUT_MS = 20_000;

// What a company says or does when it is choosing or changing an ERP.
const NEWS_QUERIES = [
  '"ERP implementation"',
  '"selects NetSuite" OR "implements NetSuite" OR "chooses NetSuite"',
  '"S/4HANA" migration OR implementation OR "go-live"',
  '"Dynamics 365" OR "Business Central" implementation OR rollout',
  '"replace legacy ERP" OR "new ERP system" OR "ERP upgrade"',
  '"ERP" "go-live" OR "goes live" OR "rolls out"',
];

// Google News editions: [hl, gl, ceid]
const GOOGLE_REGIONS: Array<[string, string, string]> = [
  ["en-US", "US", "US:en"],
  ["en-CA", "CA", "CA:en"],
  ["en-GB", "GB", "GB:en"],
  ["en-AU", "AU", "AU:en"],
  ["en-IN", "IN", "IN:en"],
];

const COMMUNITY_QUERIES = ["looking for ERP", "which ERP", "ERP recommendation", "replace our ERP", "ERP alternative"];

async function get(url: string): Promise<Response> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "*/*" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
  return res;
}

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : "";
}

export function parseRss(xml: string, fallbackPublisher: string): CrawlItem[] {
  const items: CrawlItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    const title = tag(block, "title");
    const url = tag(block, "link");
    if (!title || !url) continue;
    items.push({
      title,
      url,
      publisher: tag(block, "source") || tag(block, "News:Source") || fallbackPublisher,
      publishedAt: tag(block, "pubDate") || undefined,
      snippet: tag(block, "description").slice(0, 1000) || undefined,
      kind: "news",
    });
  }
  return items;
}

function googleNews(): CrawlSource {
  return {
    id: "google-news",
    label: "Google News (US, CA, UK, AU, IN)",
    kind: "news",
    fetch: async () => {
      const out: CrawlItem[] = [];
      for (const [hl, gl, ceid] of GOOGLE_REGIONS) {
        for (const q of NEWS_QUERIES) {
          try {
            const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:14d`)}&hl=${hl}&gl=${gl}&ceid=${encodeURIComponent(ceid)}`;
            out.push(...parseRss(await (await get(url)).text(), "Google News"));
          } catch {
            // one bad query must not lose the rest
          }
        }
      }
      return out;
    },
  };
}

function bingNews(): CrawlSource {
  return {
    id: "bing-news",
    label: "Bing News",
    kind: "news",
    fetch: async () => {
      const out: CrawlItem[] = [];
      for (const q of NEWS_QUERIES) {
        try {
          const url = `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss`;
          out.push(...parseRss(await (await get(url)).text(), "Bing News"));
        } catch {
          // skip this query
        }
      }
      return out;
    },
  };
}

function hackerNews(): CrawlSource {
  return {
    id: "hacker-news",
    label: "Hacker News",
    kind: "community",
    fetch: async () => {
      const out: CrawlItem[] = [];
      for (const q of COMMUNITY_QUERIES) {
        try {
          const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(q)}&tags=(story,comment)&hitsPerPage=40`;
          const json: any = await (await get(url)).json();
          for (const h of json.hits ?? []) {
            const text = decode(String(h.story_text ?? h.comment_text ?? ""));
            out.push({
              title: String(h.title ?? h.story_title ?? text.slice(0, 120)),
              url: `https://news.ycombinator.com/item?id=${h.objectID}`,
              publisher: "Hacker News",
              publishedAt: h.created_at,
              snippet: text.slice(0, 1000),
              kind: "community",
            });
          }
        } catch {
          // skip this query
        }
      }
      return out;
    },
  };
}

function stackExchange(): CrawlSource {
  return {
    id: "stack-exchange",
    label: "Stack Exchange (Software Recommendations)",
    kind: "community",
    fetch: async () => {
      const out: CrawlItem[] = [];
      for (const q of ["ERP", "ERP system small business", "accounting inventory ERP"]) {
        try {
          const url = `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=creation&q=${encodeURIComponent(q)}&site=softwarerecs&pagesize=40&filter=withbody`;
          const json: any = await (await get(url)).json();
          for (const it of json.items ?? []) {
            out.push({
              title: decode(String(it.title ?? "")),
              url: String(it.link),
              publisher: "Stack Exchange",
              publishedAt: it.creation_date ? new Date(it.creation_date * 1000).toISOString() : undefined,
              snippet: decode(String(it.body ?? "")).slice(0, 1000),
              kind: "community",
            });
          }
        } catch {
          // skip this query
        }
      }
      return out;
    },
  };
}

export const CRAWL_SOURCES: CrawlSource[] = [googleNews(), bingNews(), hackerNews(), stackExchange()];
