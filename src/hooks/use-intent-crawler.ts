import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCrawledArticles, runCrawlNow } from "@/lib/api/intent-crawler";

const CRAWLED_KEY = ["intent-crawler-articles"] as const;

export function useCrawledArticles(params: {
  days?: number;
  source?: string;
  status?: string;
  search?: string;
  take?: number;
  skip?: number;
}) {
  return useQuery({
    queryKey: [...CRAWLED_KEY, params],
    queryFn: () => fetchCrawledArticles(params),
    // The server crawls every 6 hours; a minute is plenty to pick that up, and faster while a crawl runs.
    refetchInterval: (q) => (q.state.data?.crawl.running ? 5_000 : 60_000),
    refetchOnWindowFocus: true,
  });
}

export function useRunCrawl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: runCrawlNow,
    onSuccess: () => qc.invalidateQueries({ queryKey: CRAWLED_KEY }),
  });
}
