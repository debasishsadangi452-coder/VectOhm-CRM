import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDepartment,
  deleteDepartment,
  getDepartment,
  listDepartments,
  updateDepartment,
  updateDepartmentSettings,
  type CreateDepartmentInput,
  type UpdateDepartmentInput,
  type UpdateDepartmentSettingsInput,
} from "@/lib/api/departments";

export function useDepartments() {
  return useQuery({ queryKey: ["departments"], queryFn: listDepartments });
}

export function useDepartment(id: string | undefined) {
  return useQuery({
    queryKey: ["departments", "detail", id],
    queryFn: () => getDepartment(id!),
    enabled: !!id,
  });
}

// Department changes affect the employee directory's Department column, so
// mutations invalidate both caches.
function useInvalidateDepartments() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["departments"] });
    queryClient.invalidateQueries({ queryKey: ["users"] });
  };
}

export function useCreateDepartment() {
  const invalidate = useInvalidateDepartments();
  return useMutation({
    mutationFn: (input: CreateDepartmentInput) => createDepartment(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateDepartment() {
  const invalidate = useInvalidateDepartments();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateDepartmentInput }) =>
      updateDepartment(id, input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateDepartmentSettings() {
  const invalidate = useInvalidateDepartments();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateDepartmentSettingsInput }) =>
      updateDepartmentSettings(id, input),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteDepartment() {
  const invalidate = useInvalidateDepartments();
  return useMutation({
    mutationFn: (id: string) => deleteDepartment(id),
    onSuccess: () => invalidate(),
  });
}
