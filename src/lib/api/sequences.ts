import { apiFetch } from "./client";
import type {
  Sequence,
  SequenceDetail,
  SequenceEnrollment,
  SequenceEnrollResult,
  SequenceSend,
  SequenceStatus,
  SequenceStep,
} from "./types";

export interface CreateSequenceInput {
  name: string;
  description?: string;
}

export interface UpdateSequenceInput {
  name?: string;
  description?: string;
  status?: SequenceStatus;
}

export interface CreateSequenceStepInput {
  templateId: string;
  delayDays: number;
}

export function listSequences() {
  return apiFetch<Sequence[]>("/sequences");
}

export function getSequence(id: string) {
  return apiFetch<SequenceDetail>(`/sequences/${id}`);
}

export function createSequence(input: CreateSequenceInput) {
  return apiFetch<Sequence>("/sequences", { method: "POST", body: JSON.stringify(input) });
}

export function updateSequence(id: string, input: UpdateSequenceInput) {
  return apiFetch<Sequence>(`/sequences/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteSequence(id: string) {
  return apiFetch<void>(`/sequences/${id}`, { method: "DELETE" });
}

export function addSequenceStep(sequenceId: string, input: CreateSequenceStepInput) {
  return apiFetch<SequenceStep>(`/sequences/${sequenceId}/steps`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateSequenceStep(
  sequenceId: string,
  stepId: string,
  input: Partial<CreateSequenceStepInput>,
) {
  return apiFetch<SequenceStep>(`/sequences/${sequenceId}/steps/${stepId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function removeSequenceStep(sequenceId: string, stepId: string) {
  return apiFetch<void>(`/sequences/${sequenceId}/steps/${stepId}`, { method: "DELETE" });
}

export function enrollContacts(sequenceId: string, contactIds: string[]) {
  return apiFetch<SequenceEnrollResult[]>(`/sequences/${sequenceId}/enroll`, {
    method: "POST",
    body: JSON.stringify({ contactIds }),
  });
}

export function stopEnrollment(sequenceId: string, enrollmentId: string, reason?: string) {
  return apiFetch<SequenceEnrollment>(`/sequences/${sequenceId}/enrollments/${enrollmentId}/stop`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function getSequenceActivity() {
  return apiFetch<SequenceSend[]>("/sequences/activity");
}

// Sent steps that went out 3+ days ago and still show zero opens -- the
// sequence-channel half of the Follow-Up Reminders widget (see
// bulk-email.ts's listFollowUps for the bulk-email half).
export function listSequenceFollowUps() {
  return apiFetch<SequenceSend[]>("/sequences/follow-ups");
}

export function runSequenceEngine() {
  return apiFetch<{ processed: number }>("/sequences/engine/run", { method: "POST" });
}

export function dismissSequenceFollowUp(sendId: string) {
  return apiFetch<void>(`/sequences/follow-ups/${sendId}/dismiss`, { method: "PATCH" });
}
