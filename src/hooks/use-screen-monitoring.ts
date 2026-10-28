import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchScreenCaptureImageUrl,
  listScreenCaptures,
  type ScreenCaptureFilters,
} from "@/lib/api/screen-monitoring";

export function useScreenCaptures(filters: ScreenCaptureFilters = {}) {
  return useQuery({
    queryKey: ["screen-captures", filters],
    queryFn: () => listScreenCaptures(filters),
  });
}

// Fetches the actual image bytes for one capture (auth-protected, so it can't
// just be an <img src="..."> URL) and hands back an object URL, revoked
// automatically when the id changes or the component unmounts.
export function useScreenCaptureImage(id: string | undefined) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    fetchScreenCaptureImageUrl(id).then((u) => {
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
