import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getTaskMessages,
  sendTaskMessage,
  requestTaskUpdate,
  submitTaskUpdate,
  type SendTaskMessageInput,
  type RequestTaskUpdateInput,
  type SubmitTaskUpdateInput,
} from "@/lib/api/task-communication";
import { toast } from "sonner";

const MESSAGES_POLL_MS = 5_000;

export function useTaskCommunication(taskId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["task-messages", taskId],
    queryFn: () => getTaskMessages(taskId!),
    enabled: !!taskId && enabled,
    refetchInterval: enabled ? MESSAGES_POLL_MS : false,
  });
}

export function useSendTaskMessage(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SendTaskMessageInput) => sendTaskMessage(taskId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-messages", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["chat"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Message sent and synced to Team Chat");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to send message");
    },
  });
}

export function useRequestTaskUpdate(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RequestTaskUpdateInput = {}) => requestTaskUpdate(taskId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-messages", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["chat"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Update request sent to employee and logged in Team Chat");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to request update");
    },
  });
}

export function useSubmitTaskUpdate(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitTaskUpdateInput) => submitTaskUpdate(taskId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-messages", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["chat"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Task update submitted and posted to Team Chat");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to submit update");
    },
  });
}
