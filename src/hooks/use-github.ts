import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  connectGithub,
  disconnectGithub,
  getGithubConnection,
  testGithubConnection,
  type ConnectGithubInput,
} from "@/lib/api/github";

export function useGithubConnection() {
  return useQuery({ queryKey: ["github-connection"], queryFn: getGithubConnection });
}

function useInvalidateGithub() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["github-connection"] });
}

export function useConnectGithub() {
  const invalidate = useInvalidateGithub();
  return useMutation({
    mutationFn: (input: ConnectGithubInput) => connectGithub(input),
    onSuccess: () => invalidate(),
  });
}

export function useTestGithubConnection() {
  return useMutation({ mutationFn: testGithubConnection });
}

export function useDisconnectGithub() {
  const invalidate = useInvalidateGithub();
  return useMutation({
    mutationFn: () => disconnectGithub(),
    onSuccess: () => invalidate(),
  });
}
