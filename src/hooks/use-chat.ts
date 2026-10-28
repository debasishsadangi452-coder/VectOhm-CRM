import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listChannels,
  createChannel,
  createGroup,
  updateGroup,
  addGroupMembers,
  removeGroupMember,
  openDM,
  listMessages,
  sendMessage,
  togglePinMessage,
  getUnreadCount,
  markChannelRead,
  type CreateChannelInput,
  type CreateGroupInput,
} from "@/lib/api/chat";

import { useAuthStore } from "@/stores/auth-store";

export function useChannels() {
  const isAuthenticated = useAuthStore((s) => s.status === "authenticated" && !!s.accessToken);
  return useQuery({
    queryKey: ["chat", "channels"],
    queryFn: listChannels,
    enabled: isAuthenticated,
    refetchInterval: isAuthenticated ? 5000 : false, // Refresh channels list every 5s
  });
}

// Backs the sidebar's Team Chat badge -- polled independently of whether
// the chat page itself is open.
export function useChatUnreadCount() {
  const isAuthenticated = useAuthStore((s) => s.status === "authenticated" && !!s.accessToken);
  return useQuery({
    queryKey: ["chat", "unread-count"],
    queryFn: getUnreadCount,
    enabled: isAuthenticated,
    refetchInterval: isAuthenticated ? 15000 : false,
  });
}

export function useMarkChannelRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (channelId: string) => markChannelRead(channelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", "unread-count"] });
    },
  });
}

export function useMessages(channelId: string | undefined, searchQuery?: string) {
  return useQuery({
    queryKey: ["chat", "messages", channelId, { q: searchQuery }],
    queryFn: () => listMessages(channelId!, searchQuery),
    enabled: !!channelId,
    refetchInterval: searchQuery ? false : 3000, // Pause polling during active search for stable typing UX
  });
}

export function useCreateChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateChannelInput) => createChannel(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", "channels"] });
    },
  });
}

function useInvalidateChannels() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["chat", "channels"] });
    queryClient.invalidateQueries({ queryKey: ["chat", "unread-count"] });
  };
}

export function useCreateGroup() {
  const invalidate = useInvalidateChannels();
  return useMutation({ mutationFn: (input: CreateGroupInput) => createGroup(input), onSuccess: invalidate });
}

export function useUpdateGroup() {
  const invalidate = useInvalidateChannels();
  return useMutation({
    mutationFn: ({ groupId, ...input }: { groupId: string; name?: string; description?: string }) =>
      updateGroup(groupId, input),
    onSuccess: invalidate,
  });
}

export function useAddGroupMembers() {
  const invalidate = useInvalidateChannels();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, userIds }: { groupId: string; userIds: string[] }) => addGroupMembers(groupId, userIds),
    onSuccess: (_data, vars) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["chat", "messages", vars.groupId] });
    },
  });
}

export function useRemoveGroupMember() {
  const invalidate = useInvalidateChannels();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) => removeGroupMember(groupId, userId),
    onSuccess: (_data, vars) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["chat", "messages", vars.groupId] });
    },
  });
}

export function useOpenDM() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recipientId: string) => openDM(recipientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", "channels"] });
    },
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ channelId, content, mentionIds }: { channelId: string; content: string; mentionIds?: string[] }) =>
      sendMessage(channelId, content, mentionIds),
    onSuccess: (data, variables) => {
      // Optimistically invalidate messages for the active channel
      queryClient.invalidateQueries({ queryKey: ["chat", "messages", variables.channelId] });
      // Invalidate channels list to update the order (recently active first)
      queryClient.invalidateQueries({ queryKey: ["chat", "channels"] });
    },
  });
}

export function useTogglePinMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => togglePinMessage(messageId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["chat", "messages", data.channelId] });
    },
  });
}
