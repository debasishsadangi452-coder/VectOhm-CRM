import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveAllIntentOutreach,
  approveIntentOutreach,
  createIntentAutomation,
  deleteIntentAutomation,
  listIntentAutomationLeads,
  listIntentAutomationRuns,
  listIntentAutomations,
  listIntentOutreach,
  rejectIntentOutreach,
  runIntentAutomation,
  updateIntentAutomation,
  updateIntentOutreachDraft,
  type IntentAutomationInput,
  type IntentLeadOutcome,
  type IntentOutreachStatus,
} from "@/lib/api/intent-automations";

const KEY = ["intent-automations"] as const;
const OUTREACH_KEY = ["intent-automations", "outreach"] as const;

function useRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: KEY });
}

export function useIntentAutomations() {
  return useQuery({ queryKey: KEY, queryFn: listIntentAutomations, refetchInterval: 60_000 });
}

export function useIntentOutreach(params: { status?: IntentOutreachStatus; automationId?: string } = {}) {
  return useQuery({
    queryKey: [...OUTREACH_KEY, params],
    queryFn: () => listIntentOutreach(params),
    refetchInterval: 60_000,
  });
}

export function useIntentAutomationRuns(id: string | null) {
  return useQuery({
    queryKey: [...KEY, "runs", id],
    queryFn: () => listIntentAutomationRuns(id as string),
    enabled: !!id,
  });
}

export function useIntentAutomationLeads(id: string | null, params: { runId?: string; outcome?: IntentLeadOutcome } = {}) {
  return useQuery({
    queryKey: [...KEY, "leads", id, params],
    queryFn: () => listIntentAutomationLeads(id as string, params),
    enabled: !!id,
  });
}

export function useCreateIntentAutomation() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (input: IntentAutomationInput) => createIntentAutomation(input), onSuccess: refresh });
}

export function useUpdateIntentAutomation() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<IntentAutomationInput> }) => updateIntentAutomation(id, input),
    onSuccess: refresh,
  });
}

export function useDeleteIntentAutomation() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (id: string) => deleteIntentAutomation(id), onSuccess: refresh });
}

export function useRunIntentAutomation() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (id: string) => runIntentAutomation(id), onSuccess: refresh });
}

export function useUpdateOutreachDraft() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { subject?: string; body?: string } }) =>
      updateIntentOutreachDraft(id, input),
    onSuccess: refresh,
  });
}

export function useApproveOutreach() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (id: string) => approveIntentOutreach(id), onSuccess: refresh });
}

export function useRejectOutreach() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (id: string) => rejectIntentOutreach(id), onSuccess: refresh });
}

export function useApproveAllOutreach() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (automationId: string) => approveAllIntentOutreach(automationId), onSuccess: refresh });
}
