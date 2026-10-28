import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTask,
  deleteTask,
  getTask,
  listTasks,
  updateTask,
  type CreateTaskInput,
  type TaskFilters,
  type UpdateTaskInput,
} from "@/lib/api/tasks";

// Polls rather than relying only on mount/refocus -- when a Manager/Admin
// assigns someone a task, the only signal sent today is a Notification row
// (see TasksService.create/update); nothing pushes to the assignee's own
// Tasks query. Polling closes that gap so a task assigned to you shows up
// in your own panel within a few seconds, not just as a toast you have to
// act on to see the actual task. Same pattern already used for
// notifications (30s) and chat (5s/15s) -- see use-notifications.ts/use-chat.ts.
const TASKS_POLL_MS = 20_000;

export function useTasks(filters: TaskFilters = {}, enabled = true) {
  return useQuery({
    queryKey: ["tasks", filters],
    queryFn: () => listTasks(filters),
    enabled,
    refetchInterval: enabled ? TASKS_POLL_MS : false,
  });
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: ["tasks", "detail", id],
    queryFn: () => getTask(id!),
    enabled: !!id,
  });
}

// "tasks" invalidation covers ["tasks", filters] and ["tasks", "detail", id] alike
// (React Query matches by key prefix). The project's nested task list lives under
// a different top-level key, so it needs its own explicit invalidation.
function useInvalidateTasks() {
  const queryClient = useQueryClient();
  return (projectId?: string | null) => {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["analytics"] });
    if (projectId) {
      queryClient.invalidateQueries({ queryKey: ["projects", "detail", projectId] });
    }
  };
}

export function useCreateTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(input),
    onSuccess: (task) => invalidate(task.projectId),
  });
}

export function useUpdateTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTaskInput }) => updateTask(id, input),
    onSuccess: (task) => invalidate(task.projectId),
  });
}

export function useDeleteTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: ({ id, projectId }: { id: string; projectId?: string | null }) =>
      deleteTask(id).then(() => projectId),
    onSuccess: (projectId) => invalidate(projectId),
  });
}
