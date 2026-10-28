import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CreateTaskPanel } from "@/components/create-task-panel";

export const Route = createFileRoute("/_app/tasks/new")({
  component: NewTaskPage,
});

function NewTaskPage() {
  const navigate = useNavigate();

  return (
    <CreateTaskPanel
      onBack={() => navigate({ to: "/tasks", search: { taskId: undefined } })}
      onCreated={() => navigate({ to: "/tasks", search: { taskId: undefined } })}
    />
  );
}
