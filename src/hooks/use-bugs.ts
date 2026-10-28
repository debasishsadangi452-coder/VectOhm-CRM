import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addBugComment,
  createBug,
  deleteBug,
  getBug,
  listBugs,
  reviewBugFix,
  submitBugFix,
  updateBug,
  type BugFilters,
  type CreateBugInput,
  type ReviewBugFixInput,
  type SubmitBugFixInput,
  type UpdateBugInput,
} from "@/lib/api/bugs";

export function useBugs(filters: BugFilters = {}, enabled = true) {
  return useQuery({
    queryKey: ["bugs", filters],
    queryFn: () => listBugs(filters),
    enabled,
    refetchInterval: enabled ? 15_000 : false,
  });
}

export function useBug(id: string | undefined) {
  return useQuery({
    queryKey: ["bugs", "detail", id],
    queryFn: () => getBug(id!),
    enabled: !!id,
  });
}

function useInvalidateBugs() {
  const queryClient = useQueryClient();
  return (taskId?: string) => {
    queryClient.invalidateQueries({ queryKey: ["bugs"] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    if (taskId) {
      queryClient.invalidateQueries({ queryKey: ["tasks", "detail", taskId] });
    }
  };
}

export function useCreateBug() {
  const invalidate = useInvalidateBugs();
  return useMutation({
    mutationFn: (input: CreateBugInput) => createBug(input),
    onSuccess: (bug) => invalidate(bug.taskId),
  });
}

export function useUpdateBug() {
  const invalidate = useInvalidateBugs();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateBugInput }) => updateBug(id, input),
    onSuccess: (bug) => invalidate(bug.taskId),
  });
}

export function useSubmitBugFix() {
  const invalidate = useInvalidateBugs();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SubmitBugFixInput }) =>
      submitBugFix(id, input),
    onSuccess: (bug) => invalidate(bug.taskId),
  });
}

export function useReviewBugFix() {
  const invalidate = useInvalidateBugs();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReviewBugFixInput }) =>
      reviewBugFix(id, input),
    onSuccess: (bug) => invalidate(bug.taskId),
  });
}

export function useAddBugComment() {
  const invalidate = useInvalidateBugs();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => addBugComment(id, content),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteBug() {
  const invalidate = useInvalidateBugs();
  return useMutation({
    mutationFn: ({ id, taskId }: { id: string; taskId?: string }) =>
      deleteBug(id).then(() => taskId),
    onSuccess: (taskId) => invalidate(taskId),
  });
}
