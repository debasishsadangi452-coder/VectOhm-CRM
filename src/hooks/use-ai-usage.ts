import { useQuery } from "@tanstack/react-query";
import { getAiUsageSummary, AiUsageSummary } from "@/lib/api/ai-usage";
import { useAuthStore } from "@/stores/auth-store";

export function useAiUsageSummary(range: "today" | "7d" | "30d" | "all" = "30d") {
  const user = useAuthStore((s) => s.user);
  const deptName = (user?.department?.name || "").toLowerCase().trim();
  const isDevTeam = deptName.includes("dev") || deptName.includes("engineering");
  const isAuthorized =
    user?.role.name === "ADMIN" || user?.role.name === "MANAGER" || isDevTeam;

  return useQuery<AiUsageSummary>({
    queryKey: ["ai-usage", "summary", range],
    queryFn: () => getAiUsageSummary(range),
    enabled: Boolean(isAuthorized),
    refetchInterval: 5000, // Live real-time polling every 5s
    refetchOnWindowFocus: true,
  });
}
