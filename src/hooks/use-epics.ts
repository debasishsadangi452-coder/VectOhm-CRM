import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listEpics,
  createEpic,
  updateEpic,
  deleteEpic,
  type CreateEpicInput,
  type UpdateEpicInput,
} from "@/lib/api/epics";

export function useEpics(departmentId?: string) {
  return useQuery({
    queryKey: ["epics", departmentId],
    queryFn: () => listEpics(departmentId),
    enabled: !!departmentId,
  });
}

function useInvalidateEpics() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["epics"] });
}

export function useCreateEpic() {
  const invalidate = useInvalidateEpics();
  return useMutation({
    mutationFn: (input: CreateEpicInput) => createEpic(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateEpic() {
  const invalidate = useInvalidateEpics();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateEpicInput }) => updateEpic(id, input),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteEpic() {
  const invalidate = useInvalidateEpics();
  return useMutation({
    mutationFn: (id: string) => deleteEpic(id),
    onSuccess: () => invalidate(),
  });
}
