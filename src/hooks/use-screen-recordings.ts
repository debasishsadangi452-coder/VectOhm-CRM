import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteScreenRecording,
  downloadScreenRecording,
  fetchScreenRecordingThumbnailUrl,
  listScreenRecordings,
  type ScreenRecordingFilters,
} from "@/lib/api/screen-recordings";

export { downloadScreenRecording };
import { apiFetchBlob } from "@/lib/api/client";

export function useScreenRecordings(
  filters: ScreenRecordingFilters = {},
  enabled = true,
  // ms; pass it for views that should show new clips as they arrive.
  refetchInterval: number | false = false,
) {
  return useQuery({
    queryKey: ["screen-recordings", filters],
    queryFn: () => listScreenRecordings(filters),
    enabled,
    refetchInterval,
    refetchOnWindowFocus: true,
  });
}

export function useDeleteScreenRecording() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteScreenRecording(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["screen-recordings"] }),
  });
}

// Same object-URL lifecycle as useScreenRecordingVideo below; pass id only
// once the card is on screen so a full day doesn't fetch every thumbnail at once.
export function useScreenRecordingThumbnail(id: string | undefined) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    fetchScreenRecordingThumbnailUrl(id)
      .then((next) => {
        if (cancelled) return URL.revokeObjectURL(next);
        objectUrl = next;
        setUrl(next);
      })
      .catch(() => undefined); // the card keeps its placeholder
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  return url;
}

// The video endpoint is auth-protected, so a <video src> can't reach it
// directly -- fetch the bytes with the bearer token and hand back an object
// URL, revoked when the id changes or the component unmounts.
//
// Note this loads the whole clip before playback starts. Clips are ~10MB at
// the agent's encoding settings, which is acceptable; if they grow, this
// should move to a ticketed URL like the training videos used to use.
export function useScreenRecordingVideo(id: string | undefined) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    apiFetchBlob(`/screen-recordings/${id}/video`).then((blob) => {
      const next = URL.createObjectURL(blob);
      if (cancelled) {
        URL.revokeObjectURL(next);
        return;
      }
      objectUrl = next;
      setUrl(next);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  return url;
}
