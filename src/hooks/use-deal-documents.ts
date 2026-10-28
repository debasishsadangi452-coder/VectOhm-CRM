import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteDealDocument,
  listDealDocuments,
  uploadDealDocument,
} from "@/lib/api/deal-documents";

const key = (dealId: string) => ["deal-documents", dealId];

export function useDealDocuments(dealId: string | undefined) {
  return useQuery({
    queryKey: key(dealId ?? ""),
    queryFn: () => listDealDocuments(dealId as string),
    enabled: !!dealId,
  });
}

// Uploading also writes a SYSTEM activity server-side, so the deal's activity
// log has to refetch too.
function useInvalidate(dealId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: key(dealId) });
    queryClient.invalidateQueries({ queryKey: ["activities"] });
  };
}

export function useUploadDealDocument(dealId: string) {
  const invalidate = useInvalidate(dealId);
  return useMutation({
    mutationFn: ({ file, note }: { file: File; note?: string }) =>
      uploadDealDocument(dealId, file, note),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteDealDocument(dealId: string) {
  const invalidate = useInvalidate(dealId);
  return useMutation({
    mutationFn: (id: string) => deleteDealDocument(id),
    onSuccess: () => invalidate(),
  });
}
