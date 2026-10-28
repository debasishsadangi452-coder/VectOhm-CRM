import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listTaskUpdates,
  listSprintTaskUpdates,
  listDepartmentTaskUpdates,
  listProjectTaskUpdates,
  createTaskUpdate,
  deleteTaskUpdate,
  type CreateTaskUpdateInput,
} from "@/lib/api/task-updates";

const TASK_UPDATES_KEY = ["task-updates"] as const;
const SPRINT_TASK_UPDATES_KEY = ["sprint-task-updates"] as const;
const DEPARTMENT_TASK_UPDATES_KEY = ["department-task-updates"] as const;
const PROJECT_TASK_UPDATES_KEY = ["project-task-updates"] as const;

export function useTaskUpdates(taskId: string | undefined) {
  return useQuery({
    queryKey: [...TASK_UPDATES_KEY, taskId],
    queryFn: () => listTaskUpdates(taskId as string),
    enabled: !!taskId,
  });
}

export function useSprintTaskUpdates(sprintId: string | undefined) {
  return useQuery({
    queryKey: [...SPRINT_TASK_UPDATES_KEY, sprintId],
    queryFn: () => listSprintTaskUpdates(sprintId as string),
    enabled: !!sprintId,
  });
}

export function useDepartmentTaskUpdates() {
  return useQuery({
    queryKey: DEPARTMENT_TASK_UPDATES_KEY,
    queryFn: () => listDepartmentTaskUpdates(),
  });
}

export function useProjectTaskUpdates(projectId: string | undefined) {
  return useQuery({
    queryKey: [...PROJECT_TASK_UPDATES_KEY, projectId],
    queryFn: () => listProjectTaskUpdates(projectId as string),
    enabled: !!projectId,
  });
}

export function useCreateTaskUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskUpdateInput) => createTaskUpdate(input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: [...TASK_UPDATES_KEY, variables.taskId] });
      qc.invalidateQueries({ queryKey: SPRINT_TASK_UPDATES_KEY });
      qc.invalidateQueries({ queryKey: DEPARTMENT_TASK_UPDATES_KEY });
      qc.invalidateQueries({ queryKey: PROJECT_TASK_UPDATES_KEY });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useDeleteTaskUpdate(taskId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTaskUpdate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...TASK_UPDATES_KEY, taskId] });
      qc.invalidateQueries({ queryKey: SPRINT_TASK_UPDATES_KEY });
      qc.invalidateQueries({ queryKey: DEPARTMENT_TASK_UPDATES_KEY });
      qc.invalidateQueries({ queryKey: PROJECT_TASK_UPDATES_KEY });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
