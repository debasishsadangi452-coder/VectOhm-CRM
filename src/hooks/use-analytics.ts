import { useQuery } from "@tanstack/react-query";
import { getAnalyticsSummary } from "@/lib/api/analytics";

export function useAnalyticsSummary() {
  return useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: getAnalyticsSummary,
  });
}
