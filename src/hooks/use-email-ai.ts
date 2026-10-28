import { useMutation, useQuery } from "@tanstack/react-query";
import {
  generateEmailTemplate,
  getEmailAiStatus,
  previewPersonalized,
  rewriteEmail,
  suggestSubjects,
} from "@/lib/api/email-ai";

/** Whether an Admin has set up Gemini, so the AI buttons know whether they can work. */
export function useEmailAiStatus() {
  return useQuery({ queryKey: ["email-ai", "status"], queryFn: getEmailAiStatus, staleTime: 5 * 60_000 });
}

export const useGenerateEmailTemplate = () => useMutation({ mutationFn: generateEmailTemplate });
export const useRewriteEmail = () => useMutation({ mutationFn: rewriteEmail });
export const useSuggestSubjects = () => useMutation({ mutationFn: suggestSubjects });
export const usePreviewPersonalized = () => useMutation({ mutationFn: previewPersonalized });
