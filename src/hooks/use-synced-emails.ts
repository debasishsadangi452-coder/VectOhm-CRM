import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/client";
import {
  listSyncedEmails,
  markSyncedEmailRead,
  triggerSyncEmails,
  sendDirectEmail,
  deleteSyncedEmail,
  type SendDirectEmailInput,
  type SyncedEmailFilters,
} from "@/lib/api/synced-emails";

export function useSyncedEmails(filters: SyncedEmailFilters = {}, enabled = true) {
  return useQuery({
    queryKey: ["synced-emails", filters],
    queryFn: () => listSyncedEmails(filters),
    enabled,
  });
}

export function useMarkSyncedEmailRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markSyncedEmailRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["synced-emails"] }),
  });
}

export function useSyncEmails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: triggerSyncEmails,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["synced-emails"] });
      if (data.syncedCount > 0) {
        toast.success(`Synced ${data.syncedCount} email${data.syncedCount === 1 ? "" : "s"} from your mailbox!`);
      } else {
        toast.info("Mailbox checked: No new emails found.");
      }
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : (err as Error).message || "Failed to sync mailbox";
      toast.error(msg);
    },
  });
}

export function useSendEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SendDirectEmailInput) => sendDirectEmail(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["synced-emails"] });
      toast.success("Email sent successfully and synced to your Zoho mail platform!");
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : (err as Error).message || "Failed to send email";
      toast.error(msg);
    },
  });
}

export function useDeleteSyncedEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSyncedEmail(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["synced-emails"] });
      toast.success("Email removed from sent list");
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : (err as Error).message || "Failed to delete email";
      toast.error(msg);
    },
  });
}


