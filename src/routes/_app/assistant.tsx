import { createFileRoute } from "@tanstack/react-router";
import { AssistantChat } from "@/components/assistant-chat";

export const Route = createFileRoute("/_app/assistant")({
  component: AssistantPage,
});

function AssistantPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <AssistantChat />
    </div>
  );
}
