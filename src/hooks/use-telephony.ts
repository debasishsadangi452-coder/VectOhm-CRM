import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  claimNextCallCampaignLead,
  connectCloudTalk,
  connectJustCall,
  createCall,
  createCallCampaign,
  createPhoneNumber,
  deletePhoneNumber,
  disconnectCloudTalk,
  disconnectJustCall,
  getCall,
  getCallAnalytics,
  getCallCampaign,
  getCloudTalkConnection,
  getJustCallConnection,
  getMyCallQueue,
  linkProviderCallId,
  listCalls,
  listCallCampaigns,
  listPhoneNumbers,
  lookupCallerByPhone,
  updateCallDisposition,
  updatePhoneNumber,
  type CreateCallCampaignInput,
  type CreateCallInput,
  type CreatePhoneNumberInput,
  type ListCallsFilters,
  type UpdateCallDispositionInput,
} from "@/lib/api/telephony";
import type { PhoneNumber } from "@/lib/api/types";

// ─── Connection ──────────────────────────────────────────────────────────────

export function useJustCallConnection(enabled = true) {
  return useQuery({ queryKey: ["justcall-connection"], queryFn: getJustCallConnection, enabled });
}

function useInvalidateJustCallConnection() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["justcall-connection"] });
}

export function useConnectJustCall() {
  const invalidate = useInvalidateJustCallConnection();
  return useMutation({
    mutationFn: (args: { apiKey: string; apiSecret: string; webhookSecret?: string }) =>
      connectJustCall(args.apiKey, args.apiSecret, args.webhookSecret),
    onSuccess: () => invalidate(),
  });
}

export function useDisconnectJustCall() {
  const invalidate = useInvalidateJustCallConnection();
  return useMutation({
    mutationFn: () => disconnectJustCall(),
    onSuccess: () => invalidate(),
  });
}

export function useCloudTalkConnection(enabled = true) {
  return useQuery({ queryKey: ["cloudtalk-connection"], queryFn: getCloudTalkConnection, enabled });
}

function useInvalidateCloudTalkConnection() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["cloudtalk-connection"] });
}

export function useConnectCloudTalk() {
  const invalidate = useInvalidateCloudTalkConnection();
  return useMutation({
    mutationFn: (args: { apiKeyId: string; apiKeySecret: string; webhookSecret?: string }) =>
      connectCloudTalk(args.apiKeyId, args.apiKeySecret, args.webhookSecret),
    onSuccess: () => invalidate(),
  });
}

export function useDisconnectCloudTalk() {
  const invalidate = useInvalidateCloudTalkConnection();
  return useMutation({
    mutationFn: () => disconnectCloudTalk(),
    onSuccess: () => invalidate(),
  });
}

// ─── Phone numbers ───────────────────────────────────────────────────────────

export function usePhoneNumbers() {
  return useQuery({ queryKey: ["phone-numbers"], queryFn: listPhoneNumbers });
}

function useInvalidatePhoneNumbers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["phone-numbers"] });
}

export function useCreatePhoneNumber() {
  const invalidate = useInvalidatePhoneNumbers();
  return useMutation({
    mutationFn: (input: CreatePhoneNumberInput) => createPhoneNumber(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdatePhoneNumber() {
  const invalidate = useInvalidatePhoneNumbers();
  return useMutation({
    mutationFn: (args: {
      id: string;
      input: Partial<Pick<PhoneNumber, "label" | "departmentId" | "active">>;
    }) => updatePhoneNumber(args.id, args.input),
    onSuccess: () => invalidate(),
  });
}

export function useDeletePhoneNumber() {
  const invalidate = useInvalidatePhoneNumbers();
  return useMutation({
    mutationFn: (id: string) => deletePhoneNumber(id),
    onSuccess: () => invalidate(),
  });
}

// ─── Calls ───────────────────────────────────────────────────────────────────

export function useCalls(filters: ListCallsFilters = {}) {
  return useQuery({ queryKey: ["calls", filters], queryFn: () => listCalls(filters) });
}

export function useCall(id: string | undefined) {
  return useQuery({ queryKey: ["calls", id], queryFn: () => getCall(id as string), enabled: !!id });
}

function useInvalidateCalls() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["calls"] });
}

export function useCreateCall() {
  const invalidate = useInvalidateCalls();
  return useMutation({
    mutationFn: (input: CreateCallInput) => createCall(input),
    onSuccess: () => invalidate(),
  });
}

export function useLinkProviderCallId() {
  const invalidate = useInvalidateCalls();
  return useMutation({
    mutationFn: (args: { id: string; providerCallId: string }) =>
      linkProviderCallId(args.id, args.providerCallId),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateCallDisposition() {
  const invalidate = useInvalidateCalls();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; input: UpdateCallDispositionInput }) =>
      updateCallDisposition(args.id, args.input),
    onSuccess: () => {
      invalidate();
      // A saved disposition may have just advanced a power-dialer lead to DONE.
      queryClient.invalidateQueries({ queryKey: ["call-campaign-queue"] });
    },
  });
}

export function useLookupCallerByPhone(number: string | undefined) {
  return useQuery({
    queryKey: ["call-lookup", number],
    queryFn: () => lookupCallerByPhone(number as string),
    enabled: !!number,
  });
}

export function useCallAnalytics(filters: { from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: ["call-analytics", filters],
    queryFn: () => getCallAnalytics(filters),
  });
}

// ─── Call campaigns (power dialer) ──────────────────────────────────────────

export function useCallCampaigns() {
  return useQuery({ queryKey: ["call-campaigns"], queryFn: listCallCampaigns });
}

export function useCallCampaign(id: string | undefined) {
  return useQuery({
    queryKey: ["call-campaigns", id],
    queryFn: () => getCallCampaign(id as string),
    enabled: !!id,
  });
}

export function useMyCallQueue() {
  return useQuery({ queryKey: ["call-campaign-queue"], queryFn: getMyCallQueue });
}

function useInvalidateCallCampaigns() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["call-campaigns"] });
    queryClient.invalidateQueries({ queryKey: ["call-campaign-queue"] });
  };
}

export function useCreateCallCampaign() {
  const invalidate = useInvalidateCallCampaigns();
  return useMutation({
    mutationFn: (input: CreateCallCampaignInput) => createCallCampaign(input),
    onSuccess: () => invalidate(),
  });
}

export function useClaimNextCallCampaignLead() {
  const invalidate = useInvalidateCallCampaigns();
  return useMutation({
    mutationFn: (campaignId: string) => claimNextCallCampaignLead(campaignId),
    onSuccess: () => invalidate(),
  });
}
