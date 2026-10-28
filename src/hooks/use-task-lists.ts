import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listTaskLists,
  createTaskList,
  updateTaskList,
  deleteTaskList,
} from "@/lib/api/task-lists";

export function useTaskLists(projectId: string | undefined) {
  return useQuery({
    queryKey: ["task-lists", projectId],
    queryFn: () => listTaskLists(projectId as string),
    enabled: !!projectId,
  });
}

function useInvalidateTaskLists() {
  const queryClient = useQueryClient();
  return (projectId?: string) => {
    queryClient.invalidateQueries({ queryKey: ["task-lists"] });
    // A project's own detail query embeds its taskLists array too.
    if (projectId) queryClient.invalidateQueries({ queryKey: ["projects", "detail", projectId] });
  };
}

export function useCreateTaskList() {
  const invalidate = useInvalidateTaskLists();
  return useMutation({
    mutationFn: ({ projectId, name }: { projectId: string; name: string }) => createTaskList(projectId, name),
    onSuccess: (_data, variables) => invalidate(variables.projectId),
  });
}

export function useUpdateTaskList() {
  const invalidate = useInvalidateTaskLists();
  return useMutation({
    mutationFn: ({
      id,
      projectId,
      input,
    }: {
      id: string;
      projectId?: string;
      input: { name?: string; position?: number };
    }) => updateTaskList(id, input),
    onSuccess: (_data, variables) => invalidate(variables.projectId),
  });
}

export function useDeleteTaskList() {
  const invalidate = useInvalidateTaskLists();
  return useMutation({
    mutationFn: ({ id }: { id: string; projectId?: string }) => deleteTaskList(id),
    onSuccess: (_data, variables) => invalidate(variables.projectId),
  });
}
