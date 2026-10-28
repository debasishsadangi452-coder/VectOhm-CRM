import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCompany,
  deleteCompany,
  getCompany,
  listCompanies,
  updateCompany,
  type CreateCompanyInput,
  type UpdateCompanyInput,
} from "@/lib/api/companies";

export function useCompanies(enabled = true) {
  return useQuery({ queryKey: ["companies"], queryFn: listCompanies, enabled });
}

export function useCompany(id: string | undefined) {
  return useQuery({
    queryKey: ["companies", "detail", id],
    queryFn: () => getCompany(id!),
    enabled: !!id,
  });
}

function useInvalidateCompanies() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["companies"] });
}

// Deleting a company SetNulls any Contact.companyId/Deal.companyId that
// referenced it, so those lists need to refetch too, not just companies.
function useInvalidateCompanyDeletion() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["companies"] });
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
    queryClient.invalidateQueries({ queryKey: ["deals"] });
  };
}

export function useCreateCompany() {
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: (input: CreateCompanyInput) => createCompany(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateCompany() {
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCompanyInput }) => updateCompany(id, input),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteCompany() {
  const invalidate = useInvalidateCompanyDeletion();
  return useMutation({
    mutationFn: (id: string) => deleteCompany(id),
    onSuccess: () => invalidate(),
  });
}
