import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listReleases,
  createRelease,
  updateRelease,
  deleteRelease,
  type CreateReleaseInput,
  type UpdateReleaseInput,
} from "@/lib/api/releases";

export function useReleases(departmentId?: string) {
  return useQuery({
    queryKey: ["releases", departmentId],
    queryFn: () => listReleases(departmentId),
    enabled: !!departmentId,
  });
}

function useInvalidateReleases() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["releases"] });
}

export function useCreateRelease() {
  const invalidate = useInvalidateReleases();
  return useMutation({
    mutationFn: (input: CreateReleaseInput) => createRelease(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateRelease() {
  const invalidate = useInvalidateReleases();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateReleaseInput }) => updateRelease(id, input),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteRelease() {
  const invalidate = useInvalidateReleases();
  return useMutation({
    mutationFn: (id: string) => deleteRelease(id),
    onSuccess: () => invalidate(),
  });
}
