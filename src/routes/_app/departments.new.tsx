import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DepartmentFormPagePanel } from "@/components/department-form-page-panel";
import { useDepartmentGuard } from "@/hooks/use-department-guard";

export const Route = createFileRoute("/_app/departments/new")({
  component: NewDepartmentPage,
});

function NewDepartmentPage() {
  useDepartmentGuard("HR");
  const navigate = useNavigate();

  return (
    <DepartmentFormPagePanel
      onBack={() => navigate({ to: "/hr" })}
      onCreated={() => navigate({ to: "/hr" })}
    />
  );
}
