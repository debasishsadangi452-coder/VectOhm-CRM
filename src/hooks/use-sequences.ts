import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listSequences,
  getSequence,
  createSequence,
  updateSequence,
  deleteSequence,
  addSequenceStep,
  updateSequenceStep,
  removeSequenceStep,
  enrollContacts,
  stopEnrollment,
  getSequenceActivity,
  listSequenceFollowUps,
  dismissSequenceFollowUp,
  runSequenceEngine,
  type CreateSequenceInput,
  type UpdateSequenceInput,
  type CreateSequenceStepInput,
} from "@/lib/api/sequences";
import { useAuthStore } from "@/stores/auth-store";

const SEQUENCES_KEY = ["sequences"] as const;
const ACTIVITY_KEY = ["sequences-activity"] as const;

export function useSequences() {
  return useQuery({ queryKey: SEQUENCES_KEY, queryFn: listSequences });
}

export function useSequence(id: string | undefined) {
  return useQuery({
    queryKey: [...SEQUENCES_KEY, "detail", id],
    queryFn: () => getSequence(id as string),
    enabled: !!id,
  });
}

export function useSequenceActivity() {
  return useQuery({ queryKey: ACTIVITY_KEY, queryFn: getSequenceActivity });
}

// Backend restricts this to Sales dept / Admin (see canUseSalesOutreach on
// the server) -- gated here too so non-Sales users don't fire a request
// that's always going to 403.
export function useSequenceFollowUps() {
  const user = useAuthStore((s) => s.user);
  const canUse = user?.role.name === "ADMIN" || user?.department?.name === "Sales";
  return useQuery({
    queryKey: [...SEQUENCES_KEY, "follow-ups"],
    queryFn: listSequenceFollowUps,
    enabled: canUse,
  });
}

export function useDismissSequenceFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sendId: string) => dismissSequenceFollowUp(sendId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...SEQUENCES_KEY, "follow-ups"] }),
  });
}

function useInvalidateSequences() {
  const qc = useQueryClient();
  return (id?: string) => {
    qc.invalidateQueries({ queryKey: SEQUENCES_KEY });
    qc.invalidateQueries({ queryKey: ACTIVITY_KEY });
    if (id) qc.invalidateQueries({ queryKey: [...SEQUENCES_KEY, "detail", id] });
  };
}

export function useCreateSequence() {
  const invalidate = useInvalidateSequences();
  return useMutation({
    mutationFn: (input: CreateSequenceInput) => createSequence(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateSequence() {
  const invalidate = useInvalidateSequences();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSequenceInput }) =>
      updateSequence(id, input),
    onSuccess: (_data, variables) => invalidate(variables.id),
  });
}

export function useDeleteSequence() {
  const invalidate = useInvalidateSequences();
  return useMutation({
    mutationFn: (id: string) => deleteSequence(id),
    onSuccess: () => invalidate(),
  });
}

export function useAddSequenceStep() {
  const invalidate = useInvalidateSequences();
  return useMutation({
    mutationFn: ({ sequenceId, input }: { sequenceId: string; input: CreateSequenceStepInput }) =>
      addSequenceStep(sequenceId, input),
    onSuccess: (_data, variables) => invalidate(variables.sequenceId),
  });
}

export function useUpdateSequenceStep() {
  const invalidate = useInvalidateSequences();
  return useMutation({
    mutationFn: ({
      sequenceId,
      stepId,
      input,
    }: {
      sequenceId: string;
      stepId: string;
      input: Partial<CreateSequenceStepInput>;
    }) => updateSequenceStep(sequenceId, stepId, input),
    onSuccess: (_data, variables) => invalidate(variables.sequenceId),
  });
}

export function useRemoveSequenceStep() {
  const invalidate = useInvalidateSequences();
  return useMutation({
    mutationFn: ({ sequenceId, stepId }: { sequenceId: string; stepId: string }) =>
      removeSequenceStep(sequenceId, stepId),
    onSuccess: (_data, variables) => invalidate(variables.sequenceId),
  });
}

export function useEnrollContacts() {
  const invalidate = useInvalidateSequences();
  return useMutation({
    mutationFn: ({ sequenceId, contactIds }: { sequenceId: string; contactIds: string[] }) =>
      enrollContacts(sequenceId, contactIds),
    onSuccess: (_data, variables) => invalidate(variables.sequenceId),
  });
}

export function useStopEnrollment() {
  const invalidate = useInvalidateSequences();
  return useMutation({
    mutationFn: ({
      sequenceId,
      enrollmentId,
      reason,
    }: {
      sequenceId: string;
      enrollmentId: string;
      reason?: string;
    }) => stopEnrollment(sequenceId, enrollmentId, reason),
    onSuccess: (_data, variables) => invalidate(variables.sequenceId),
  });
}

export function useRunSequenceEngine() {
  const invalidate = useInvalidateSequences();
  return useMutation({
    mutationFn: () => runSequenceEngine(),
    onSuccess: () => invalidate(),
  });
}
