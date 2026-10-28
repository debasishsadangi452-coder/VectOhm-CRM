import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ContactFormPagePanel } from "@/components/contact-form-page-panel";
import { useDepartmentGuard } from "@/hooks/use-department-guard";

export const Route = createFileRoute("/_app/contacts/new")({
  component: NewContactPage,
});

function NewContactPage() {
  useDepartmentGuard("Sales");
  const navigate = useNavigate();

  return (
    <ContactFormPagePanel
      onBack={() => navigate({ to: "/crm" })}
      onCreated={() => navigate({ to: "/crm" })}
    />
  );
}
