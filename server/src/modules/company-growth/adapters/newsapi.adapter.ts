import { Injectable, Logger } from "@nestjs/common";

export interface NewsApiArticle {
  title: string;
  description: string | null;
  url: string;
  publishedAt: string;
  sourceName: string | null;
}

// NewsAPI.org's self-serve developer API (https://newsapi.org) -- requires
// the user's own free NEWSAPI_KEY, same env-var-driven pattern as every
// other integration in this codebase (see AdzunaAdapter). There is no
// public "Google News API"; this is the standard self-serve substitute.
@Injectable()
export class NewsApiAdapter {
  private readonly logger = new Logger(NewsApiAdapter.name);

  isConfigured(): boolean {
    return Boolean(process.env.NEWSAPI_KEY);
  }

  // `sinceISODate` bounds the search to recent articles only -- both to
  // avoid re-surfacing old news on every run and because the free NewsAPI
  // tier only serves articles from the last month anyway.
  async search(companyName: string, sinceISODate: string): Promise<NewsApiArticle[]> {
    const apiKey = process.env.NEWSAPI_KEY;
    if (!apiKey) return [];

    try {
      const params = new URLSearchParams({
        q: `"${companyName}"`,
        from: sinceISODate,
        sortBy: "publishedAt",
        language: "en",
        pageSize: "10",
        apiKey,
      });
      const res = await fetch(`https://newsapi.org/v2/everything?${params}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [];

      const data = (await res.json()) as {
        articles?: Array<{
          title?: string;
          description?: string | null;
          url?: string;
          publishedAt?: string;
          source?: { name?: string };
        }>;
      };

      return (data.articles ?? [])
        .filter((a) => a.title && a.url)
        .map((a) => ({
          title: a.title!,
          description: a.description ?? null,
          url: a.url!,
          publishedAt: a.publishedAt ?? new Date().toISOString(),
          sourceName: a.source?.name ?? null,
        }));
    } catch (err) {
      this.logger.debug(`NewsAPI search failed for "${companyName}": ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }
}
