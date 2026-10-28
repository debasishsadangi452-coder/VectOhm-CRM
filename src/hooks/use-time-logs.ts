import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listTimeLogs,
  createTimeLog,
  updateTimeLog,
  reviewTimeLog,
  deleteTimeLog,
  type TimeLogFilters,
  type CreateTimeLogInput,
  type UpdateTimeLogInput,
  type ReviewTimeLogInput,
} from "@/lib/api/time-logs";

export function useTimeLogs(filters: TimeLogFilters = {}, enabled = true) {
  return useQuery({
    queryKey: ["time-logs", filters],
    queryFn: () => listTimeLogs(filters),
    enabled,
  });
}

function useInvalidateTimeLogs() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["time-logs"] });
    // The Tasks panel's Duration column is derived from each task's
    // timeLogs, so a log change needs the tasks list to refetch too.
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };
}

export function useCreateTimeLog() {
  const invalidate = useInvalidateTimeLogs();
  return useMutation({
    mutationFn: (input: CreateTimeLogInput) => createTimeLog(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateTimeLog() {
  const invalidate = useInvalidateTimeLogs();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTimeLogInput }) => updateTimeLog(id, input),
    onSuccess: () => invalidate(),
  });
}

export function useReviewTimeLog() {
  const invalidate = useInvalidateTimeLogs();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReviewTimeLogInput }) => reviewTimeLog(id, input),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteTimeLog() {
  const invalidate = useInvalidateTimeLogs();
  return useMutation({
    mutationFn: (id: string) => deleteTimeLog(id),
    onSuccess: () => invalidate(),
  });
}
