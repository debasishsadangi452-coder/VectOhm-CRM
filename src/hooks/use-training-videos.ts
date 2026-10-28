import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTrainingVideo,
  deleteTrainingVideo,
  listTrainingVideos,
  updateTrainingVideo,
  type TrainingVideoInput,
} from "@/lib/api/training-videos";

const KEY = ["training-videos"];

export function useTrainingVideos(enabled = true) {
  return useQuery({
    queryKey: KEY,
    queryFn: listTrainingVideos,
    enabled,
  });
}

export function useCreateTrainingVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TrainingVideoInput) => createTrainingVideo(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateTrainingVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<TrainingVideoInput> }) =>
      updateTrainingVideo(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteTrainingVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTrainingVideo(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
