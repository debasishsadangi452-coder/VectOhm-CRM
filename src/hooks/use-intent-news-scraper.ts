import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchScrapedArticles,
  fetchScrapedSummaryStats,
  updateScrapedArticleStatus,
  deleteScrapedArticle,
} from "@/lib/api/intent-news-scraper";

const SCRAPED_ARTICLES_KEY = ["scraped-intent-articles"] as const;
const SCRAPED_STATS_KEY = ["scraped-intent-stats"] as const;

export function useScrapedIntentArticles(params?: {
  isErpAiPriority?: boolean;
  tier?: string;
  status?: string;
  search?: string;
  take?: number;
  skip?: number;
}) {
  return useQuery({
    queryKey: [...SCRAPED_ARTICLES_KEY, params],
    queryFn: () => fetchScrapedArticles(params),
    refetchInterval: 3000, // Refresh automatically every 3s for real-time live news updates
    refetchOnWindowFocus: true,
  });
}

export function useScrapedSummaryStats() {
  return useQuery({
    queryKey: SCRAPED_STATS_KEY,
    queryFn: fetchScrapedSummaryStats,
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });
}

export function useUpdateScrapedStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateScrapedArticleStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SCRAPED_ARTICLES_KEY });
      qc.invalidateQueries({ queryKey: SCRAPED_STATS_KEY });
    },
  });
}

export function useDeleteScrapedArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteScrapedArticle(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SCRAPED_ARTICLES_KEY });
      qc.invalidateQueries({ queryKey: SCRAPED_STATS_KEY });
    },
  });
}
