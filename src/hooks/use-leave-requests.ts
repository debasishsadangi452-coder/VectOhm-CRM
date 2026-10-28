import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listLeaveRequests,
  createLeaveRequest,
  updateLeaveRequest,
  deleteLeaveRequest,
  getLeaveStats,
  type CreateLeaveRequestInput,
  type UpdateLeaveRequestInput,
} from "@/lib/api/leave-requests";
import type { LeaveStatus } from "@/lib/api/types";

const LEAVE_KEY = ["leave-requests"] as const;
const LEAVE_STATS_KEY = ["leave-stats"] as const;

function useInvalidateLeave() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: LEAVE_KEY }),
      qc.invalidateQueries({ queryKey: LEAVE_STATS_KEY }),
    ]);
}

export function useLeaveRequests(filters?: { userId?: string; status?: LeaveStatus }) {
  return useQuery({
    queryKey: [...LEAVE_KEY, filters],
    queryFn: () => listLeaveRequests(filters),
  });
}

export function useLeaveStats() {
  return useQuery({
    queryKey: LEAVE_STATS_KEY,
    queryFn: getLeaveStats,
  });
}

export function useCreateLeaveRequest() {
  const invalidate = useInvalidateLeave();
  return useMutation({
    mutationFn: (input: CreateLeaveRequestInput) => createLeaveRequest(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateLeaveRequest() {
  const invalidate = useInvalidateLeave();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateLeaveRequestInput }) =>
      updateLeaveRequest(id, input),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteLeaveRequest() {
  const invalidate = useInvalidateLeave();
  return useMutation({
    mutationFn: (id: string) => deleteLeaveRequest(id),
    onSuccess: () => invalidate(),
  });
}
