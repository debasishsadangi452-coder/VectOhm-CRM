import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listKBArticles,
  getKBArticle,
  createKBArticle,
  updateKBArticle,
  deleteKBArticle,
  type CreateKBArticleInput,
  type UpdateKBArticleInput,
} from "@/lib/api/knowledge";

export function useKBArticles(q?: string, category?: string) {
  return useQuery({
    queryKey: ["knowledge", "list", { q, category }],
    queryFn: () => listKBArticles(q, category),
  });
}

export function useKBArticle(id: string | undefined) {
  return useQuery({
    queryKey: ["knowledge", "detail", id],
    queryFn: () => getKBArticle(id!),
    enabled: !!id,
  });
}

function useInvalidateKB() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["knowledge"] });
  };
}

export function useCreateKBArticle() {
  const invalidate = useInvalidateKB();
  return useMutation({
    mutationFn: (input: CreateKBArticleInput) => createKBArticle(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateKBArticle() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateKB();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateKBArticleInput }) =>
      updateKBArticle(id, input),
    onSuccess: (data, variables) => {
      invalidate();
      // Invalidate detail cache specifically
      queryClient.invalidateQueries({ queryKey: ["knowledge", "detail", variables.id] });
    },
  });
}

export function useDeleteKBArticle() {
  const invalidate = useInvalidateKB();
  return useMutation({
    mutationFn: (id: string) => deleteKBArticle(id),
    onSuccess: () => invalidate(),
  });
}
