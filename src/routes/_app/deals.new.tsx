import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DealFormPagePanel } from "@/components/deal-form-page-panel";
import { useDepartmentGuard } from "@/hooks/use-department-guard";

export const Route = createFileRoute("/_app/deals/new")({
  component: NewDealPage,
});

function NewDealPage() {
  useDepartmentGuard("Sales");
  const navigate = useNavigate();

  return (
    <DealFormPagePanel
      onBack={() => navigate({ to: "/crm" })}
      onCreated={() => navigate({ to: "/crm" })}
    />
  );
}
