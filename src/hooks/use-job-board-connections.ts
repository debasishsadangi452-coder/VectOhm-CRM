import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { connectJobBoard, disconnectJobBoard, getJobBoardConnections } from "@/lib/api/job-board-connections";
import type { JobBoard } from "@/lib/api/recruitment";

export function useJobBoardConnections() {
  return useQuery({ queryKey: ["job-board-connections"], queryFn: getJobBoardConnections });
}

function useInvalidateJobBoardConnections() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["job-board-connections"] });
}

export function useConnectJobBoard() {
  const invalidate = useInvalidateJobBoardConnections();
  return useMutation({
    mutationFn: ({ board, apiKey }: { board: JobBoard; apiKey: string }) => connectJobBoard(board, apiKey),
    onSuccess: () => invalidate(),
  });
}

export function useDisconnectJobBoard() {
  const invalidate = useInvalidateJobBoardConnections();
  return useMutation({
    mutationFn: (board: JobBoard) => disconnectJobBoard(board),
    onSuccess: () => invalidate(),
  });
}
