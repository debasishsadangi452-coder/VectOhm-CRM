import { apiFetch } from "./client";
import type { PersonRef } from "./types";

export interface TrainingVideo {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  // Wherever the recording actually lives -- Drive, YouTube, anywhere.
  url: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  uploader: PersonRef;
}

export interface TrainingVideoInput {
  title: string;
  url: string;
  description?: string;
  category?: string;
  position?: number;
}

export function listTrainingVideos() {
  return apiFetch<TrainingVideo[]>("/training-videos");
}

export function createTrainingVideo(input: TrainingVideoInput) {
  return apiFetch<TrainingVideo>("/training-videos", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateTrainingVideo(id: string, input: Partial<TrainingVideoInput>) {
  return apiFetch<TrainingVideo>(`/training-videos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteTrainingVideo(id: string) {
  return apiFetch<void>(`/training-videos/${id}`, { method: "DELETE" });
}
