import { Badge } from "@/components/ui/badge";
import type { EngagementTier } from "@/lib/api/types";

const TIER_STYLES: Record<EngagementTier, { label: string; className: string }> = {
  COLD: { label: "Cold", className: "bg-info/15 text-info border-info/30" },
  WARM: { label: "Warm", className: "bg-warning/15 text-warning border-warning/30" },
  HOT: { label: "Hot", className: "bg-destructive/15 text-destructive border-destructive/30" },
  SALES_READY: { label: "Sales Ready", className: "bg-success/15 text-success border-success/30" },
};

export function EngagementBadge({
  tier,
  score,
  className,
}: {
  tier: EngagementTier;
  score?: number;
  className?: string;
}) {
  const style = TIER_STYLES[tier] ?? TIER_STYLES.COLD;
  return (
    <Badge variant="outline" className={`${style.className} ${className ?? ""}`}>
      {style.label}
      {typeof score === "number" ? ` · ${score}` : ""}
    </Badge>
  );
}
