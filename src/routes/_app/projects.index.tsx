import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, KanbanSquare, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CreateProjectPanel } from "@/components/create-project-panel";
import { useDeleteProject, useProjects, useUpdateProject } from "@/hooks/use-projects";
import { useDepartmentGuard } from "@/hooks/use-department-guard";
import { useAuthStore } from "@/stores/auth-store";
import { PROJECT_STATUSES, type Project, type ProjectStatus } from "@/lib/api/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/projects/")({
  component: ProjectsPage,
});

const STATUS_TONE: Record<ProjectStatus, string> = {
  ACTIVE: "text-blue-600 font-bold bg-blue-50 border-blue-200",
  ON_HOLD: "text-amber-600 font-bold bg-amber-50 border-amber-200",
  COMPLETED: "text-emerald-600 font-bold bg-emerald-50 border-emerald-200",
  ARCHIVED: "text-slate-500 font-medium bg-slate-100 border-slate-200",
};

const STATUS_LABEL: Record<ProjectStatus, string> = {
  ACTIVE: "Active",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

function ProjectsPage() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role.name === "ADMIN";
  const isManager = currentUser?.role.name === "MANAGER";

  // Admins monitor all projects across the company.
  // Managers view their department projects (or all scoped if unscoped).
  const { data: projects = [], isLoading } = useProjects(
    isAdmin
      ? {}
      : isManager && currentUser?.department?.id
        ? { departmentId: currentUser.department.id }
        : {},
  );
  const updateProject = useUpdateProject();
  const deleteProjectMutation = useDeleteProject();
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  if (showCreatePanel) {
    return (
      <CreateProjectPanel
        onBack={() => setShowCreatePanel(false)}
        onCreated={(projectId) => {
          setShowCreatePanel(false);
          navigate({ to: "/projects/$id", params: { id: projectId } });
        }}
      />
    );
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6 select-none animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="size-11 rounded-xl bg-blue-50 border border-blue-200 grid place-items-center text-blue-600 shrink-0">
            <KanbanSquare className="size-5" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Projects</h1>
            <p className="text-xs text-slate-500 mt-0.5">Every active initiative, with live task progress.</p>
          </div>
        </div>
        <Button
          onClick={() => setShowCreatePanel(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-2xs gap-1.5"
        >
          <Plus className="size-4" />
          New Project
        </Button>
      </div>

      {isLoading && <p className="text-slate-500 text-xs">Loading projects...</p>}
      {!isLoading && projects?.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 text-xs shadow-2xs">
          No projects yet. Create your first one to get started.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects?.map((project) => (
          <Link
            key={project.id}
            to="/projects/$id"
            params={{ id: project.id }}
            className="bg-white border border-slate-200 hover:border-blue-500/50 rounded-2xl p-5 hover:shadow-md transition-all duration-200 flex flex-col gap-3 group"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-bold text-sm tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                {project.name}
              </h2>
              <div className="flex items-center gap-1 shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    asChild
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      title="Click to change project status"
                      className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 border rounded-full shrink-0 font-semibold cursor-pointer hover:ring-2 hover:ring-blue-400/50 transition-all ${STATUS_TONE[project.status]}`}
                    >
                      <span>{STATUS_LABEL[project.status]}</span>
                      <ChevronDown className="size-2.5 opacity-70" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-36 text-xs bg-white border border-slate-200 shadow-lg rounded-xl p-1 z-50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {PROJECT_STATUSES.map((st) => (
                      <DropdownMenuItem
                        key={st}
                        disabled={st === project.status || updateProject.isPending}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          updateProject.mutate(
                            { id: project.id, input: { status: st } },
                            {
                              onSuccess: () =>
                                toast.success(
                                  `Project "${project.name}" status updated to ${STATUS_LABEL[st]}`,
                                ),
                              onError: (err) =>
                                toast.error(
                                  err instanceof Error
                                    ? err.message
                                    : "Failed to update project status",
                                ),
                            },
                          );
                        }}
                        className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                          st === project.status
                            ? "bg-slate-100 font-bold text-blue-600"
                            : "hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <span>{STATUS_LABEL[st]}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {(isAdmin || isManager || currentUser?.id === project.owner?.id || currentUser?.id === (project as { ownerId?: string }).ownerId) && (
                  <button
                    type="button"
                    title="Delete project"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setProjectToDelete(project);
                    }}
                    className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
            {(() => {
              const cleanDesc = project.description
                ? project.description.split(/\*\*Key Deliverables:\*\*/i)[0]?.trim()
                : "";
              return cleanDesc ? (
                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{cleanDesc}</p>
              ) : null;
            })()}
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-auto pt-3 border-t border-slate-100 font-medium">
              <span className="font-semibold text-slate-700">
                {project._count.tasks} task{project._count.tasks === 1 ? "" : "s"}
              </span>
              <span className="text-slate-600 font-semibold">
                {project.owner.firstName} {project.owner.lastName}
              </span>
            </div>
          </Link>
        ))}
      </div>

      <AlertDialog
        open={!!projectToDelete}
        onOpenChange={(open) => !open && !isDeletingProject && setProjectToDelete(null)}
      >
        <AlertDialogContent className="max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
                <Trash2 className="size-5" />
              </span>
              Delete Project?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600 space-y-2 mt-2">
              <p>
                Are you sure you want to permanently delete project{" "}
                <strong className="text-slate-900 font-semibold">{projectToDelete?.name}</strong>?
              </p>
              <p className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200/80">
                <strong>Note:</strong> Associated tasks will be detached and retained as standalone tasks. Sprints and member assignments for this project will be removed.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-5 flex items-center justify-end gap-2">
            <AlertDialogCancel
              disabled={isDeletingProject}
              className="text-xs font-semibold rounded-xl px-4 py-2 hover:bg-slate-100"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingProject}
              onClick={(e) => {
                e.preventDefault();
                if (!projectToDelete) return;
                setIsDeletingProject(true);
                deleteProjectMutation.mutate(
                  { id: projectToDelete.id, permanent: true },
                  {
                    onSuccess: () => {
                      toast.success(`Project "${projectToDelete.name}" deleted successfully.`);
                      setProjectToDelete(null);
                      setIsDeletingProject(false);
                    },
                    onError: (err) => {
                      toast.error(
                        err instanceof Error ? err.message : "Failed to delete project",
                      );
                      setIsDeletingProject(false);
                    },
                  },
                );
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl px-4 py-2 transition-colors"
            >
              {isDeletingProject ? "Deleting..." : "Delete Project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
