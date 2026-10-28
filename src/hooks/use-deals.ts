import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveDeal,
  archiveDeal,
  createDeal,
  getDeal,
  listDeals,
  listDealFollowUps,
  rejectDeal,
  updateDeal,
  type CreateDealInput,
  type DealFilters,
  type UpdateDealInput,
} from "@/lib/api/deals";

export function useDeals(filters: DealFilters = {}, enabled = true) {
  return useQuery({ queryKey: ["deals", filters], queryFn: () => listDeals(filters), enabled });
}

export function useDealFollowUps() {
  return useQuery({ queryKey: ["deals", "follow-ups"], queryFn: listDealFollowUps });
}

export function useDeal(id: string | undefined) {
  return useQuery({
    queryKey: ["deals", "detail", id],
    queryFn: () => getDeal(id!),
    enabled: !!id,
  });
}

// Deal mutations also touch companies' _count.deals.
function useInvalidateDeals() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["deals"] });
    queryClient.invalidateQueries({ queryKey: ["companies"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["analytics"] });
    queryClient.invalidateQueries({ queryKey: ["google-ads"] });
  };
}

export function useCreateDeal() {
  const invalidate = useInvalidateDeals();
  return useMutation({
    mutationFn: (input: CreateDealInput) => createDeal(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateDeal() {
  const invalidate = useInvalidateDeals();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateDealInput }) => updateDeal(id, input),
    onSuccess: () => invalidate(),
  });
}

export function useArchiveDeal() {
  const invalidate = useInvalidateDeals();
  return useMutation({
    mutationFn: (id: string) => archiveDeal(id),
    onSuccess: () => invalidate(),
  });
}

export function useApproveDeal() {
  const invalidate = useInvalidateDeals();
  return useMutation({
    mutationFn: (id: string) => approveDeal(id),
    onSuccess: () => invalidate(),
  });
}

export function useRejectDeal() {
  const invalidate = useInvalidateDeals();
  return useMutation({
    mutationFn: (id: string) => rejectDeal(id),
    onSuccess: () => invalidate(),
  });
}
