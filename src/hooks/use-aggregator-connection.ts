import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  connectAggregator,
  disconnectAggregator,
  getAggregatorConnection,
  type ConnectAggregatorInput,
} from "@/lib/api/aggregator-connection";

export function useAggregatorConnection() {
  return useQuery({ queryKey: ["job-distribution-aggregator"], queryFn: getAggregatorConnection });
}

function useInvalidateAggregatorConnection() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["job-distribution-aggregator"] });
}

export function useConnectAggregator() {
  const invalidate = useInvalidateAggregatorConnection();
  return useMutation({
    mutationFn: (input: ConnectAggregatorInput) => connectAggregator(input),
    onSuccess: () => invalidate(),
  });
}

export function useDisconnectAggregator() {
  const invalidate = useInvalidateAggregatorConnection();
  return useMutation({
    mutationFn: () => disconnectAggregator(),
    onSuccess: () => invalidate(),
  });
}
