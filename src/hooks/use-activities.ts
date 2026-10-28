import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createActivity,
  deleteActivity,
  listActivities,
  updateActivity,
  type CreateActivityInput,
  type UpdateActivityInput,
} from "@/lib/api/activities";

export function useActivities(dealId: string | undefined) {
  return useQuery({
    queryKey: ["activities", { dealId }],
    queryFn: () => listActivities({ dealId }),
    enabled: !!dealId,
  });
}

// Scoped invalidation -- activities are always viewed scoped to one deal, so
// there's no broad ["activities"] list to keep fresh, unlike tasks/deals.
function useInvalidateActivities(dealId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["activities", { dealId }] });
}

export function useCreateActivity(dealId: string) {
  const invalidate = useInvalidateActivities(dealId);
  return useMutation({
    mutationFn: (input: CreateActivityInput) => createActivity(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateActivity(dealId: string) {
  const invalidate = useInvalidateActivities(dealId);
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateActivityInput }) => updateActivity(id, input),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteActivity(dealId: string) {
  const invalidate = useInvalidateActivities(dealId);
  return useMutation({
    mutationFn: (id: string) => deleteActivity(id),
    onSuccess: () => invalidate(),
  });
}
