import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { useSearchStore } from "@/stores/search-store";
import { DealFormPagePanel } from "@/components/deal-form-page-panel";
import { ContactFormPagePanel } from "@/components/contact-form-page-panel";
import { CompanyFormPagePanel } from "@/components/company-form-page-panel";
import { CreateProjectPanel } from "@/components/create-project-panel";
import { CreateTaskPanel } from "@/components/create-task-panel";
import { DepartmentFormPagePanel } from "@/components/department-form-page-panel";
import { LeaveRequestPagePanel } from "@/components/leave-request-page-panel";
import { UserFormPagePanel } from "@/components/user-form-page-panel";

export function GlobalDialogs() {
  const navigate = useNavigate();
  const activeDialog = useSearchStore((s) => s.activeDialog);
  const setActiveDialog = useSearchStore((s) => s.setActiveDialog);

  React.useEffect(() => {
    if (activeDialog === "candidate") {
      setActiveDialog(null);
      navigate({ to: "/recruitment", search: { tab: "applicants", action: "create-applicant" } });
    } else if (activeDialog === "job-posting") {
      setActiveDialog(null);
      navigate({ to: "/recruitment", search: { tab: "jobs", action: "create-job" } });
    }
  }, [activeDialog, navigate, setActiveDialog]);

  return (
    <>
      {activeDialog === "deal" && (
        <div className="fixed inset-0 z-50 bg-canvas overflow-y-auto">
          <DealFormPagePanel
            onBack={() => setActiveDialog(null)}
            onCreated={() => setActiveDialog(null)}
          />
        </div>
      )}

      {activeDialog === "contact" && (
        <div className="fixed inset-0 z-50 bg-canvas overflow-y-auto">
          <ContactFormPagePanel
            onBack={() => setActiveDialog(null)}
            onCreated={() => setActiveDialog(null)}
          />
        </div>
      )}

      {activeDialog === "company" && (
        <div className="fixed inset-0 z-50 bg-canvas overflow-y-auto">
          <CompanyFormPagePanel
            onBack={() => setActiveDialog(null)}
            onCreated={() => setActiveDialog(null)}
          />
        </div>
      )}

      {activeDialog === "project" && (
        <div className="fixed inset-0 z-50 bg-canvas overflow-y-auto">
          <CreateProjectPanel
            onBack={() => setActiveDialog(null)}
            onCreated={() => setActiveDialog(null)}
          />
        </div>
      )}

      {activeDialog === "task" && (
        <div className="fixed inset-0 z-50 bg-canvas overflow-y-auto">
          <CreateTaskPanel
            onBack={() => setActiveDialog(null)}
            onCreated={() => setActiveDialog(null)}
          />
        </div>
      )}

      {activeDialog === "employee" && (
        <div className="fixed inset-0 z-50 bg-canvas overflow-y-auto">
          <UserFormPagePanel
            onBack={() => setActiveDialog(null)}
            onCreated={() => setActiveDialog(null)}
          />
        </div>
      )}

      {activeDialog === "department" && (
        <div className="fixed inset-0 z-50 bg-canvas overflow-y-auto">
          <DepartmentFormPagePanel
            onBack={() => setActiveDialog(null)}
            onCreated={() => setActiveDialog(null)}
          />
        </div>
      )}

      {activeDialog === "leave-request" && (
        <div className="fixed inset-0 z-50 bg-canvas overflow-y-auto">
          <LeaveRequestPagePanel
            onBack={() => setActiveDialog(null)}
            onCreated={() => setActiveDialog(null)}
          />
        </div>
      )}
    </>
  );
}
