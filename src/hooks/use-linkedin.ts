import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  connectLinkedIn,
  disconnectLinkedIn,
  getLinkedInChats,
  getLinkedInConnectionStatus,
  getLinkedInRecentActions,
  sendLinkedInInvite,
  sendLinkedInMessage,
  testLinkedInConnection,
  updateLinkedInLimits,
  type ConnectLinkedInInput,
  type SendLinkedInInviteInput,
  type SendLinkedInMessageInput,
  type UpdateLinkedInLimitsInput,
} from "@/lib/api/linkedin";

export function useLinkedInStatus() {
  return useQuery({
    queryKey: ["linkedin-connection"],
    queryFn: getLinkedInConnectionStatus,
  });
}

function useInvalidateLinkedIn() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["linkedin-connection"] });
    queryClient.invalidateQueries({ queryKey: ["linkedin-actions"] });
    queryClient.invalidateQueries({ queryKey: ["linkedin-chats"] });
  };
}

export function useConnectLinkedIn() {
  const invalidate = useInvalidateLinkedIn();
  return useMutation({
    mutationFn: (input: ConnectLinkedInInput) => connectLinkedIn(input),
    onSuccess: invalidate,
  });
}

export function useTestLinkedInConnection() {
  const invalidate = useInvalidateLinkedIn();
  return useMutation({
    mutationFn: () => testLinkedInConnection(),
    onSuccess: invalidate,
  });
}

export function useDisconnectLinkedIn() {
  const invalidate = useInvalidateLinkedIn();
  return useMutation({
    mutationFn: () => disconnectLinkedIn(),
    onSuccess: invalidate,
  });
}

export function useUpdateLinkedInLimits() {
  const invalidate = useInvalidateLinkedIn();
  return useMutation({
    mutationFn: (input: UpdateLinkedInLimitsInput) => updateLinkedInLimits(input),
    onSuccess: invalidate,
  });
}

export function useSendLinkedInInvite() {
  const invalidate = useInvalidateLinkedIn();
  return useMutation({
    mutationFn: (input: SendLinkedInInviteInput) => sendLinkedInInvite(input),
    onSuccess: invalidate,
  });
}

export function useSendLinkedInMessage() {
  const invalidate = useInvalidateLinkedIn();
  return useMutation({
    mutationFn: (input: SendLinkedInMessageInput) => sendLinkedInMessage(input),
    onSuccess: invalidate,
  });
}

export function useLinkedInActions(limit = 20) {
  return useQuery({
    queryKey: ["linkedin-actions", limit],
    queryFn: () => getLinkedInRecentActions(limit),
  });
}

export function useLinkedInChats(limit = 20) {
  return useQuery({
    queryKey: ["linkedin-chats", limit],
    queryFn: () => getLinkedInChats(limit),
  });
}
