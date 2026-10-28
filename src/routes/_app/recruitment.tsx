import { createFileRoute } from "@tanstack/react-router";
import { CeipalApp } from "@/components/ceipal/ceipal-app";
import { useDepartmentGuard } from "@/hooks/use-department-guard";

export const Route = createFileRoute("/_app/recruitment")({
  validateSearch: (search: Record<string, unknown>): { tab?: string; action?: string } => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
    action: typeof search.action === "string" ? search.action : undefined,
  }),
  component: RecruitmentPage,
});

function RecruitmentPage() {
  useDepartmentGuard("Recruitment");
  const search = Route.useSearch();

  return (
    <div className="flex flex-col min-h-screen bg-[#eef1f6] select-text" style={{ backgroundColor: "#eef1f6" }}>
      {/* Full Ceipal ATS & eBoarding Application */}
      <CeipalApp searchTab={search.tab} searchAction={search.action} />
    </div>
  );
}
