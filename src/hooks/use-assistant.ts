import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelAssistantAction,
  confirmAssistantAction,
  deleteAssistantConversation,
  getAssistantCapabilities,
  getAssistantConversation,
  listAssistantConversations,
  sendAssistantMessage,
  type AssistantConversation,
} from "@/lib/api/assistant";

const LIST_KEY = ["assistant", "conversations"] as const;
const convKey = (id: string | null) => ["assistant", "conversation", id] as const;

export function useAssistantCapabilities() {
  return useQuery({ queryKey: ["assistant", "capabilities"], queryFn: getAssistantCapabilities, staleTime: 5 * 60_000 });
}

export function useAssistantConversations() {
  return useQuery({ queryKey: LIST_KEY, queryFn: listAssistantConversations });
}

export function useAssistantConversation(id: string | null) {
  return useQuery({
    queryKey: convKey(id),
    queryFn: () => getAssistantConversation(id as string),
    enabled: !!id,
  });
}

// Every call that changes a conversation returns the whole updated conversation.
function useStoreConversation() {
  const qc = useQueryClient();
  return (conversation: AssistantConversation) => {
    qc.setQueryData(convKey(conversation.id), conversation);
    qc.invalidateQueries({ queryKey: LIST_KEY });
  };
}

export function useSendAssistantMessage() {
  const store = useStoreConversation();
  return useMutation({ mutationFn: sendAssistantMessage, onSuccess: store });
}

export function useConfirmAssistantAction() {
  const store = useStoreConversation();
  return useMutation({ mutationFn: (id: string) => confirmAssistantAction(id), onSuccess: store });
}

export function useCancelAssistantAction() {
  const store = useStoreConversation();
  return useMutation({ mutationFn: (id: string) => cancelAssistantAction(id), onSuccess: store });
}

export function useDeleteAssistantConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAssistantConversation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}
