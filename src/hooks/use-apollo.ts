import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  connectApollo,
  disconnectApollo,
  enrichContactViaApollo,
  getApolloConnection,
  importApolloOrganizations,
  importApolloPeople,
  searchApolloOrganizations,
  searchApolloPeople,
  type ApolloOrganizationSearchInput,
  type ApolloPeopleSearchInput,
} from "@/lib/api/apollo";

export function useApolloConnection() {
  return useQuery({ queryKey: ["apollo-connection"], queryFn: getApolloConnection });
}

function useInvalidateApolloConnection() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["apollo-connection"] });
}

export function useConnectApollo() {
  const invalidate = useInvalidateApolloConnection();
  return useMutation({
    mutationFn: (apiKey: string) => connectApollo(apiKey),
    onSuccess: () => invalidate(),
  });
}

export function useDisconnectApollo() {
  const invalidate = useInvalidateApolloConnection();
  return useMutation({
    mutationFn: () => disconnectApollo(),
    onSuccess: () => invalidate(),
  });
}

export function useSearchApolloPeople() {
  return useMutation({
    mutationFn: (input: ApolloPeopleSearchInput) => searchApolloPeople(input),
  });
}

export function useSearchApolloOrganizations() {
  return useMutation({
    mutationFn: (input: ApolloOrganizationSearchInput) => searchApolloOrganizations(input),
  });
}

function useInvalidateCrm() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
    queryClient.invalidateQueries({ queryKey: ["companies"] });
  };
}

export function useImportApolloPeople() {
  const invalidate = useInvalidateCrm();
  return useMutation({
    mutationFn: (apolloIds: string[]) => importApolloPeople(apolloIds),
    onSuccess: () => invalidate(),
  });
}

export function useImportApolloOrganizations() {
  const invalidate = useInvalidateCrm();
  return useMutation({
    mutationFn: (domains: string[]) => importApolloOrganizations(domains),
    onSuccess: () => invalidate(),
  });
}

export function useEnrichContact() {
  const invalidate = useInvalidateCrm();
  return useMutation({
    mutationFn: (contactId: string) => enrichContactViaApollo(contactId),
    onSuccess: () => invalidate(),
  });
}
