import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listHiringSignalAutomations,
  createHiringSignalAutomation,
  updateHiringSignalAutomation,
  deleteHiringSignalAutomation,
  runHiringSignalAutomation,
  listHiringSignalsForAutomation,
  searchIntentHiring,
  getLatestIntentSearch,
  enrichIntentCompanies,
  getEnrichedContacts,
  enrollIntentContacts,
  deleteEnrichedContact,
  resolveAndSendIntentLead,
  automateIntentEmail,
  type CreateHiringSignalAutomationInput,
  type UpdateHiringSignalAutomationInput,
  type IntentHiringSearchInput,
  type EnrichIntentCompaniesInput,
  type EnrollIntentContactsInput,
  type ResolveAndSendLeadInput,
  type AutomateIntentEmailInput,
  searchIntentNews,
  type IntentNewsSearchInput,
} from "@/lib/api/hiring-signals";

const AUTOMATIONS_KEY = ["hiring-signal-automations"] as const;
const INTENT_LATEST_KEY = ["intent-hiring", "latest"] as const;
const ENRICHED_CONTACTS_KEY = ["intent-enriched-contacts"] as const;

export function useHiringSignalAutomations() {
  return useQuery({ queryKey: AUTOMATIONS_KEY, queryFn: listHiringSignalAutomations });
}

export function useHiringSignalsForAutomation(id: string | undefined) {
  return useQuery({
    queryKey: [...AUTOMATIONS_KEY, id, "signals"],
    queryFn: () => listHiringSignalsForAutomation(id as string),
    enabled: !!id,
  });
}

function useInvalidateAutomations() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: AUTOMATIONS_KEY });
}

export function useCreateHiringSignalAutomation() {
  const invalidate = useInvalidateAutomations();
  return useMutation({
    mutationFn: (input: CreateHiringSignalAutomationInput) => createHiringSignalAutomation(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateHiringSignalAutomation() {
  const invalidate = useInvalidateAutomations();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateHiringSignalAutomationInput }) =>
      updateHiringSignalAutomation(id, input),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteHiringSignalAutomation() {
  const invalidate = useInvalidateAutomations();
  return useMutation({
    mutationFn: (id: string) => deleteHiringSignalAutomation(id),
    onSuccess: () => invalidate(),
  });
}

export function useRunHiringSignalAutomation() {
  const invalidate = useInvalidateAutomations();
  return useMutation({
    mutationFn: (id: string) => runHiringSignalAutomation(id),
    onSuccess: () => invalidate(),
  });
}

export function useLatestIntentSearch() {
  return useQuery({
    queryKey: INTENT_LATEST_KEY,
    queryFn: getLatestIntentSearch,
    staleTime: 1000 * 60 * 10, // 10 minutes cache
  });
}

export function useSearchIntentHiring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: IntentHiringSearchInput) => searchIntentHiring(input),
    onSuccess: (data) => {
      qc.setQueryData(INTENT_LATEST_KEY, data);
    },
  });
}

export function useSearchIntentNews() {
  return useMutation({
    mutationFn: (input: IntentNewsSearchInput) => searchIntentNews(input),
  });
}

export function useEnrichedContacts() {
  return useQuery({
    queryKey: ENRICHED_CONTACTS_KEY,
    queryFn: getEnrichedContacts,
  });
}

export function useEnrichIntentCompanies() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EnrichIntentCompaniesInput) => enrichIntentCompanies(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ENRICHED_CONTACTS_KEY });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["sequences"] });
    },
  });
}

export function useEnrollEnrichedContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EnrollIntentContactsInput) => enrollIntentContacts(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ENRICHED_CONTACTS_KEY });
      qc.invalidateQueries({ queryKey: ["sequences"] });
      qc.invalidateQueries({ queryKey: ["engagement-events"] });
    },
  });
}

export function useDeleteEnrichedContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEnrichedContact(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ENRICHED_CONTACTS_KEY });
    },
  });
}

export function useResolveAndSendIntentLead() {
  return useMutation({
    mutationFn: (input: ResolveAndSendLeadInput) => resolveAndSendIntentLead(input),
  });
}

export function useAutomateIntentEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AutomateIntentEmailInput) => automateIntentEmail(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bulk-email-campaigns"] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["engagement-events"] });
    },
  });
}

