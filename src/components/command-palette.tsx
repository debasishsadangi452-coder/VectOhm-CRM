import * as React from "react";
import { useSearchStore } from "@/stores/search-store";
import { toast } from "sonner";
import { useAuthStore, userCanSignOut } from "@/stores/auth-store";
import { isDepartmentMatch } from "@/hooks/use-department-guard";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { useContacts } from "@/hooks/use-contacts";
import { useDeals } from "@/hooks/use-deals";
import { useCompanies } from "@/hooks/use-companies";
import { useProjects } from "@/hooks/use-projects";
import { useTasks } from "@/hooks/use-tasks";
import { useCandidates, useJobPostings } from "@/hooks/use-recruitment";
import { useUsers } from "@/hooks/use-users";
import { useNavigate } from "@tanstack/react-router";
import { logout as logoutApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useMySignOutRequest, useRequestSignOut } from "@/hooks/use-signout-requests";
import {
  Search,
  Briefcase,
  User,
  Building,
  CheckSquare,
  FolderKanban,
  FileText,
  Users,
  Compass,
  MessageSquare,
  BookOpen,
  LogOut,
  Plus,
} from "lucide-react";

export function CommandPalette() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { data: mySignOutRequest } = useMySignOutRequest();
  const signOutRequest = mySignOutRequest?.status === "PENDING" ? mySignOutRequest : null;
  const requestSignOutMutation = useRequestSignOut();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  
  const searchOpen = useSearchStore((s) => s.searchOpen);
  const setSearchOpen = useSearchStore((s) => s.setSearchOpen);
  const setActiveDialog = useSearchStore((s) => s.setActiveDialog);

  const isAdmin = user?.role?.name === "ADMIN";
  const isHR = isDepartmentMatch(user?.department?.name, "HR") || isAdmin;
  const isSales = isDepartmentMatch(user?.department?.name, "Sales") || isAdmin;
  const isDev = isDepartmentMatch(user?.department?.name, "Development") || isAdmin;
  const isRecruitment = isDepartmentMatch(user?.department?.name, "Recruitment") || isAdmin;

  // Query resources based on role access
  const { data: contacts } = useContacts({}, isSales && searchOpen);
  const { data: deals } = useDeals({}, isSales && searchOpen);
  const { data: companies } = useCompanies(isSales && searchOpen);

  const { data: projects } = useProjects({}, isDev && searchOpen);
  const { data: tasks } = useTasks({}, isDev && searchOpen);

  const { data: candidates } = useCandidates({}, isRecruitment && searchOpen);
  const { data: jobPostings } = useJobPostings({}, isRecruitment && searchOpen);

  const { data: employees } = useUsers(isHR && searchOpen);

  // Listen to keyboard shortcut (Cmd/Ctrl + K)
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen(!searchOpen);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [searchOpen, setSearchOpen]);

  function handleSelect(action: () => void) {
    action();
    setSearchOpen(false);
  }

  // Same as the sidebar's Sign Out: end the server session too. Clearing only
  // local state left the refresh cookie valid, so the login page would just
  // sign the person straight back in.
  async function handleLogout() {
    try {
      await logoutApi();
    } catch (err) {
      // The server refuses sign-out for accounts an Admin hasn't allowed.
      if (err instanceof ApiError && err.status === 403) {
        toast.error(err.message);
        return;
      }
      // other errors -- still sign out locally
    }
    clearAuth();
    navigate({ to: "/login" });
  }

  return (
    <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
      <CommandInput placeholder="Search for anything..." />
      <CommandList className="max-h-[450px]">
        <CommandEmpty>No results found.</CommandEmpty>

        {/* --- Sales/CRM Section --- */}
        {isSales && (
          <>
            {deals && deals.length > 0 && (
              <CommandGroup heading="Deals (CRM)">
                {deals.slice(0, 5).map((deal) => (
                  <CommandItem
                    key={deal.id}
                    value={`deal ${deal.title}`}
                    onSelect={() => handleSelect(() => navigate({ to: "/crm" }))}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Briefcase className="size-4 text-text-dim" />
                      <span>{deal.title}</span>
                    </div>
                    <span className="text-xs text-text-dim">${deal.value.toLocaleString()}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {contacts && contacts.length > 0 && (
              <CommandGroup heading="Contacts (CRM)">
                {contacts.slice(0, 5).map((contact) => (
                  <CommandItem
                    key={contact.id}
                    value={`contact ${contact.firstName} ${contact.lastName}`}
                    onSelect={() => handleSelect(() => navigate({ to: "/crm" }))}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <User className="size-4 text-text-dim" />
                      <span>{contact.firstName} {contact.lastName}</span>
                    </div>
                    <span className="text-xs text-text-dim">{contact.email ?? ""}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {companies && companies.length > 0 && (
              <CommandGroup heading="Companies (CRM)">
                {companies.slice(0, 5).map((company) => (
                  <CommandItem
                    key={company.id}
                    value={`company ${company.name}`}
                    onSelect={() => handleSelect(() => navigate({ to: "/crm" }))}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Building className="size-4 text-text-dim" />
                      <span>{company.name}</span>
                    </div>
                    <span className="text-xs text-text-dim">{company.domain ?? ""}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}

        {/* --- Dev Section --- */}
        {isDev && (
          <>
            {projects && projects.length > 0 && (
              <CommandGroup heading="Projects">
                {projects.slice(0, 5).map((project) => (
                  <CommandItem
                    key={project.id}
                    value={`project ${project.name}`}
                    onSelect={() =>
                      handleSelect(() => navigate({ to: "/projects/$id", params: { id: project.id } }))
                    }
                  >
                    <FolderKanban className="size-4 text-text-dim mr-2" />
                    <span>{project.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {tasks && tasks.length > 0 && (
              <CommandGroup heading="Tasks">
                {tasks.slice(0, 5).map((task) => (
                  <CommandItem
                    key={task.id}
                    value={`task ${task.title}`}
                    onSelect={() => handleSelect(() => navigate({ to: "/tasks", search: { taskId: undefined } }))}
                  >
                    <CheckSquare className="size-4 text-text-dim mr-2" />
                    <span>{task.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}

        {/* --- Recruitment Section --- */}
        {isRecruitment && (
          <>
            {candidates && candidates.length > 0 && (
              <CommandGroup heading="Candidates (HR)">
                {candidates.slice(0, 5).map((candidate) => (
                  <CommandItem
                    key={candidate.id}
                    value={`candidate ${candidate.firstName} ${candidate.lastName}`}
                    onSelect={() => handleSelect(() => navigate({ to: "/recruitment" }))}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <User className="size-4 text-text-dim" />
                      <span>{candidate.firstName} {candidate.lastName}</span>
                    </div>
                    <span className="text-xs text-text-dim">{candidate.email ?? ""}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {jobPostings && jobPostings.length > 0 && (
              <CommandGroup heading="Job Postings">
                {jobPostings.slice(0, 5).map((job) => (
                  <CommandItem
                    key={job.id}
                    value={`job ${job.title}`}
                    onSelect={() => handleSelect(() => navigate({ to: "/recruitment" }))}
                  >
                    <FileText className="size-4 text-text-dim mr-2" />
                    <span>{job.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}

        {/* --- HR/Admin Section --- */}
        {isHR && employees && employees.length > 0 && (
          <CommandGroup heading="Employees (Directory)">
            {employees.slice(0, 5).map((emp) => (
              <CommandItem
                key={emp.id}
                value={`employee ${emp.firstName} ${emp.lastName}`}
                onSelect={() => handleSelect(() => navigate({ to: "/hr" }))}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-text-dim" />
                  <span>{emp.firstName} {emp.lastName}</span>
                </div>
                <span className="text-xs text-text-dim">{emp.department?.name ?? "No Dept"}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* --- Quick Links / Actions --- */}
        <CommandSeparator />
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => handleSelect(() => navigate({ to: "/" }))}>
            <Compass className="size-4 mr-2 text-text-dim" />
            <span>Go to Dashboard</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate({ to: "/chat" }))}>
            <MessageSquare className="size-4 mr-2 text-text-dim" />
            <span>Team Chat</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate({ to: "/knowledge" }))}>
            <BookOpen className="size-4 mr-2 text-text-dim" />
            <span>Knowledge Base</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Account">
          <CommandItem onSelect={() => handleSelect(() => navigate({ to: "/account" }))}>
            <User className="size-4 mr-2 text-text-dim" />
            <span>Profile & Settings</span>
          </CommandItem>
          {!userCanSignOut(user) && (
            <CommandItem
              disabled={!!signOutRequest || requestSignOutMutation.isPending}
              onSelect={() => handleSelect(() => requestSignOutMutation.mutate(undefined))}
            >
              <LogOut className="size-4 mr-2 text-amber-500" />
              <span className="text-amber-500">
                {signOutRequest ? "Sign-out request pending…" : "Request Sign Out"}
              </span>
            </CommandItem>
          )}
          {userCanSignOut(user) && (
            <CommandItem onSelect={() => handleSelect(() => void handleLogout())}>
              <LogOut className="size-4 mr-2 text-destructive" />
              <span className="text-destructive">Sign Out</span>
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
