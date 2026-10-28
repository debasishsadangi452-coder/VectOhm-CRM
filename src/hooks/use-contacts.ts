import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContact,
  deleteContact,
  getContact,
  importContacts,
  listContactImportBatches,
  listContacts,
  updateContact,
  type ContactFilters,
  type CreateContactInput,
  type ImportContactRow,
  type UpdateContactInput,
} from "@/lib/api/contacts";

export function useContacts(filters: ContactFilters = {}, enabled = true) {
  return useQuery({ queryKey: ["contacts", filters], queryFn: () => listContacts(filters), enabled });
}

export function useContact(id: string | undefined) {
  return useQuery({
    queryKey: ["contacts", "detail", id],
    queryFn: () => getContact(id!),
    enabled: !!id,
  });
}

// Contact mutations also touch companies' _count.contacts.
function useInvalidateContacts() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
    queryClient.invalidateQueries({ queryKey: ["companies"] });
  };
}

export function useCreateContact() {
  const invalidate = useInvalidateContacts();
  return useMutation({
    mutationFn: (input: CreateContactInput) => createContact(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateContact() {
  const invalidate = useInvalidateContacts();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateContactInput }) => updateContact(id, input),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteContact(id),
    onSuccess: () => {
      // Deleting a contact SetNulls any Deal.contactId that referenced it.
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    },
  });
}

export function useImportContacts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fileName, rows }: { fileName: string; rows: ImportContactRow[] }) =>
      importContacts(fileName, rows),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["contact-import-batches"] });
    },
  });
}

export function useContactImportBatches() {
  return useQuery({ queryKey: ["contact-import-batches"], queryFn: listContactImportBatches });
}
