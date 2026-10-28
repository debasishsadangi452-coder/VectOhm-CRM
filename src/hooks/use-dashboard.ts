import { useQuery } from "@tanstack/react-query";
import { getSalesStats } from "@/lib/api/dashboard";

export function useSalesStats(enabled = true) {
  return useQuery({ queryKey: ["dashboard", "sales"], queryFn: getSalesStats, enabled });
}
