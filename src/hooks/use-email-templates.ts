import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listEmailTemplates,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  type CreateEmailTemplateInput,
  type UpdateEmailTemplateInput,
} from "@/lib/api/email-templates";

const TEMPLATES_KEY = ["email-templates"] as const;

export function useEmailTemplates() {
  return useQuery({ queryKey: TEMPLATES_KEY, queryFn: listEmailTemplates });
}

function useInvalidateTemplates() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY });
}

export function useCreateEmailTemplate() {
  const invalidate = useInvalidateTemplates();
  return useMutation({
    mutationFn: (input: CreateEmailTemplateInput) => createEmailTemplate(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateEmailTemplate() {
  const invalidate = useInvalidateTemplates();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateEmailTemplateInput }) =>
      updateEmailTemplate(id, input),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteEmailTemplate() {
  const invalidate = useInvalidateTemplates();
  return useMutation({
    mutationFn: (id: string) => deleteEmailTemplate(id),
    onSuccess: () => invalidate(),
  });
}
