import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteLoginPhoto,
  fetchLoginPhotoImageUrl,
  listLoginPhotos,
  type LoginPhotoFilters,
} from "@/lib/api/login-photos";

export function useLoginPhotos(filters: LoginPhotoFilters = {}) {
  return useQuery({
    queryKey: ["login-photos", filters],
    queryFn: () => listLoginPhotos(filters),
  });
}

export function useDeleteLoginPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteLoginPhoto(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["login-photos"] }),
  });
}

// Fetches the actual image bytes for one photo (auth-protected, so it can't
// just be an <img src="..."> URL) and hands back an object URL, revoked
// automatically when the id changes or the component unmounts.
export function useLoginPhotoImage(id: string | undefined) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    fetchLoginPhotoImageUrl(id).then((u) => {
      if (cancelled) {
        URL.revokeObjectURL(u);
        return;
      }
      objectUrl = u;
      setUrl(u);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  return url;
}
