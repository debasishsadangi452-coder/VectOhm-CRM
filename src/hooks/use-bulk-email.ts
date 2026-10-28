import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listBulkEmailCampaigns,
  getBulkEmailCampaign,
  createBulkEmailCampaign,
  runBulkEmailEngine,
  listFollowUps,
  dismissBulkEmailFollowUp,
  deleteBulkEmailCampaign,
  retryFailedBulkEmailSends,
  cancelPendingBulkEmailSends,
  type CreateBulkEmailInput,
} from "@/lib/api/bulk-email";
import { useAuthStore } from "@/stores/auth-store";

const BULK_EMAIL_KEY = ["bulk-email"] as const;

export function useBulkEmailCampaigns() {
  return useQuery({
    queryKey: BULK_EMAIL_KEY,
    queryFn: listBulkEmailCampaigns,
    // The send engine runs on its own 5-minute cron (BulkEmailEngineService)
    // whether or not anyone has this page open -- without polling, a
    // campaign that finishes sending in the background looks permanently
    // "stuck" on Pending until a manual page refresh. Only poll while
    // something's actually still in flight, so a fully-sent campaign doesn't
    // keep polling forever.
    refetchInterval: (query) => {
      const campaigns = query.state.data;
      const stillPending = campaigns?.some((c) => (c.statusCounts?.PENDING ?? 0) > 0);
      return stillPending ? 5000 : false;
    },
  });
}

export function useBulkEmailCampaign(id: string | undefined) {
  return useQuery({
    queryKey: [...BULK_EMAIL_KEY, "detail", id],
    queryFn: () => getBulkEmailCampaign(id as string),
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      if ((data.statusCounts?.PENDING ?? 0) > 0) return 5000;
      if (data.recipients?.some((r) => r.status === "PENDING")) return 5000;
      return false;
    },
  });
}

function useInvalidateBulkEmail() {
  const qc = useQueryClient();
  return (id?: string) => {
    qc.invalidateQueries({ queryKey: BULK_EMAIL_KEY });
    if (id) {
      qc.invalidateQueries({ queryKey: [...BULK_EMAIL_KEY, "detail", id] });
      qc.invalidateQueries({ queryKey: ["campaign-metrics", id] });
    }
  };
}

export function useCreateBulkEmailCampaign() {
  const invalidate = useInvalidateBulkEmail();
  return useMutation({
    mutationFn: (input: CreateBulkEmailInput) => createBulkEmailCampaign(input),
    onSuccess: () => invalidate(),
  });
}

export function useRunBulkEmailEngine() {
  const invalidate = useInvalidateBulkEmail();
  return useMutation({
    mutationFn: () => runBulkEmailEngine(),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteBulkEmailCampaign() {
  const invalidate = useInvalidateBulkEmail();
  return useMutation({
    mutationFn: (id: string) => deleteBulkEmailCampaign(id),
    onSuccess: (_data, id) => invalidate(id),
  });
}

export function useRetryFailedBulkEmailSends() {
  const invalidate = useInvalidateBulkEmail();
  return useMutation({
    mutationFn: (id: string) => retryFailedBulkEmailSends(id),
    onSuccess: (_data, id) => invalidate(id),
  });
}

export function useCancelPendingBulkEmailSends() {
  const invalidate = useInvalidateBulkEmail();
  return useMutation({
    mutationFn: (id: string) => cancelPendingBulkEmailSends(id),
    onSuccess: (_data, id) => invalidate(id),
  });
}

// Backend allows Sales and Recruitment depts & Admin (canUseSalesOrRecruitment)
export function useFollowUps() {
  const user = useAuthStore((s) => s.user);
  const dept = user?.department?.name?.toLowerCase().trim() || "";
  const canUse =
    user?.role.name === "ADMIN" ||
    dept === "sales" ||
    dept.includes("sales") ||
    dept === "recruitment" ||
    dept.includes("recruit");
  return useQuery({
    queryKey: [...BULK_EMAIL_KEY, "follow-ups"],
    queryFn: listFollowUps,
    enabled: canUse,
  });
}

export function useDismissFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (recipientId: string) => dismissBulkEmailFollowUp(recipientId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...BULK_EMAIL_KEY, "follow-ups"] }),
  });
}

