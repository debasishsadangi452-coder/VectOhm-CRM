import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listCommits, createCommit, mergePR, declinePR, type CreateCommitInput } from "@/lib/api/commits";
import { useAuthStore } from "@/stores/auth-store";

export function useCommits() {
  const isAuthenticated = useAuthStore((s) => s.status === "authenticated" && !!s.accessToken);
  return useQuery({
    queryKey: ["commits"],
    queryFn: listCommits,
    enabled: isAuthenticated,
    refetchInterval: isAuthenticated ? 5000 : false, // Fetch recent commits every 5s
  });
}

export function useCreateCommit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCommitInput) => createCommit(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commits"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["sprints"] });
    },
  });
}

export function useMergePR() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => mergePR(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commits"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["sprints"] });
    },
  });
}

export function useDeclinePR() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => declinePR(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commits"] });
    },
  });
}
