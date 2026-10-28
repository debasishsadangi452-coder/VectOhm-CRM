import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteSignatureImage,
  getSignature,
  listSignatureImages,
  saveSignature,
  uploadSignatureImage,
} from "@/lib/api/email-signature";

const SIGNATURE_KEY = ["email-signature"];
const IMAGES_KEY = ["email-signature", "images"];

export function useSignature() {
  return useQuery({ queryKey: SIGNATURE_KEY, queryFn: getSignature });
}

export function useSaveSignature() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (html: string | null) => saveSignature(html),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SIGNATURE_KEY }),
  });
}

export function useSignatureImages() {
  return useQuery({ queryKey: IMAGES_KEY, queryFn: listSignatureImages });
}

export function useUploadSignatureImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadSignatureImage(file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: IMAGES_KEY }),
  });
}

export function useDeleteSignatureImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSignatureImage(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: IMAGES_KEY }),
  });
}
