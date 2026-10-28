import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listEmailSuppressions,
  addEmailSuppression,
  removeEmailSuppression,
  unsubscribeViaToken,
} from "@/lib/api/email-suppression";

const SUPPRESSIONS_KEY = ["email-suppressions"] as const;

export function useEmailSuppressions() {
  return useQuery({ queryKey: SUPPRESSIONS_KEY, queryFn: listEmailSuppressions });
}

function useInvalidateSuppressions() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: SUPPRESSIONS_KEY });
}

export function useAddEmailSuppression() {
  const invalidate = useInvalidateSuppressions();
  return useMutation({
    mutationFn: (email: string) => addEmailSuppression(email),
    onSuccess: () => invalidate(),
  });
}

export function useRemoveEmailSuppression() {
  const invalidate = useInvalidateSuppressions();
  return useMutation({
    mutationFn: (id: string) => removeEmailSuppression(id),
    onSuccess: () => invalidate(),
  });
}

export function useUnsubscribeViaToken() {
  return useMutation({
    mutationFn: ({ email, token }: { email: string; token: string }) =>
      unsubscribeViaToken(email, token),
  });
}
