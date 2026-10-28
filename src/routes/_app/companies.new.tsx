import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CompanyFormPagePanel } from "@/components/company-form-page-panel";
import { useDepartmentGuard } from "@/hooks/use-department-guard";

export const Route = createFileRoute("/_app/companies/new")({
  component: NewCompanyPage,
});

function NewCompanyPage() {
  useDepartmentGuard("Sales");
  const navigate = useNavigate();

  return (
    <CompanyFormPagePanel
      onBack={() => navigate({ to: "/crm" })}
      onCreated={() => navigate({ to: "/crm" })}
    />
  );
}
