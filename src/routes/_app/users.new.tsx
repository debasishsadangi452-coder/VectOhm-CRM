import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { UserFormPagePanel } from "@/components/user-form-page-panel";
import { useDepartmentGuard } from "@/hooks/use-department-guard";

export const Route = createFileRoute("/_app/users/new")({
  component: NewUserPage,
});

function NewUserPage() {
  useDepartmentGuard("HR");
  const navigate = useNavigate();

  return (
    <UserFormPagePanel
      onBack={() => navigate({ to: "/hr" })}
      onCreated={() => navigate({ to: "/hr" })}
    />
  );
}
