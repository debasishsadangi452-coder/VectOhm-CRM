import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addProjectMember,
  archiveProject,
  createProject,
  deleteProject,
  getProject,
  listProjects,
  removeProjectMember,
  updateProject,
  type CreateProjectInput,
  type ProjectFilters,
  type UpdateProjectInput,
} from "@/lib/api/projects";

// Same rationale as useTasks' polling -- being added as a project member (or
// a new project being created under your department) has no push signal
// today either.
const PROJECTS_POLL_MS = 30_000;

export function useProjects(filters: ProjectFilters = {}, enabled = true) {
  return useQuery({
    queryKey: ["projects", filters],
    queryFn: () => listProjects(filters),
    enabled,
    refetchInterval: enabled ? PROJECTS_POLL_MS : false,
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ["projects", "detail", id],
    queryFn: () => getProject(id!),
    enabled: !!id,
  });
}

function useInvalidateProjects() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["analytics"] });
  };
}

export function useCreateProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => createProject(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProjectInput }) => updateProject(id, input),
    onSuccess: () => invalidate(),
  });
}

export function useArchiveProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (id: string) => archiveProject(id),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: ({ id, permanent = true }: { id: string; permanent?: boolean }) =>
      deleteProject(id, permanent),
    onSuccess: () => invalidate(),
  });
}

// Member mutations refresh the project detail (members list lives there) plus
// the project lists.
function useInvalidateProjectDetail() {
  const queryClient = useQueryClient();
  return (projectId: string) => {
    queryClient.invalidateQueries({ queryKey: ["projects", "detail", projectId] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  };
}

export function useAddProjectMember() {
  const invalidate = useInvalidateProjectDetail();
  return useMutation({
    mutationFn: ({ projectId, userId }: { projectId: string; userId: string }) =>
      addProjectMember(projectId, userId),
    onSuccess: (_result, { projectId }) => invalidate(projectId),
  });
}

export function useRemoveProjectMember() {
  const invalidate = useInvalidateProjectDetail();
  return useMutation({
    mutationFn: ({ projectId, userId }: { projectId: string; userId: string }) =>
      removeProjectMember(projectId, userId),
    onSuccess: (_result, { projectId }) => invalidate(projectId),
  });
}
