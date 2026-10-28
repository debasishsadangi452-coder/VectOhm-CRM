import { createFileRoute } from "@tanstack/react-router";
import { HrmsPortalPanel } from "@/components/hrms-portal-panel";

export const Route = createFileRoute("/_app/hr")({
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  component: HrPage,
});

function HrPage() {
  const search = Route.useSearch();

  return (
    <div className="p-6 max-w-[1400px] mx-auto font-sans select-none pb-16">
      <HrmsPortalPanel showHeader={true} defaultTab={(search.tab as any) ?? "employees"} />
    </div>
  );
}
