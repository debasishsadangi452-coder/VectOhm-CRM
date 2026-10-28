import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listSprints,
  createSprint,
  updateSprint,
  assignTasksToSprint,
  type CreateSprintInput,
} from "@/lib/api/sprints";

export function useSprints(projectId?: string, enabled = true) {
  return useQuery({
    queryKey: ["sprints", { projectId }],
    queryFn: () => listSprints(projectId),
    enabled,
  });
}

export function useCreateSprint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSprintInput) => createSprint(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sprints"] });
    },
  });
}

export function useUpdateSprint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreateSprintInput> }) =>
      updateSprint(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sprints"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useAssignTasksToSprint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sprintId, taskIds }: { sprintId: string; taskIds: string[] }) =>
      assignTasksToSprint(sprintId, taskIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sprints"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
