import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CreateProjectPanel } from "@/components/create-project-panel";
import { useDepartmentGuard } from "@/hooks/use-department-guard";

export const Route = createFileRoute("/_app/projects/new")({
  component: NewProjectPage,
});

function NewProjectPage() {
  useDepartmentGuard("Dev");
  const navigate = useNavigate();

  return (
    <CreateProjectPanel
      onBack={() => navigate({ to: "/projects" })}
      onCreated={() => navigate({ to: "/projects" })}
    />
  );
}
