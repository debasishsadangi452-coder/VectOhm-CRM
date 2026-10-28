import { apiFetch } from "./client";

export interface AggregatorConnectionStatus {
  connected: boolean;
  provider: string | null;
  baseUrl: string | null;
  connectedByName: string | null;
  connectedAt: string | null;
}

export interface ConnectAggregatorInput {
  provider: string;
  baseUrl: string;
  apiKey: string;
}

export function getAggregatorConnection() {
  return apiFetch<AggregatorConnectionStatus>("/job-distribution-aggregator");
}

export function connectAggregator(input: ConnectAggregatorInput) {
  return apiFetch<AggregatorConnectionStatus>("/job-distribution-aggregator", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function disconnectAggregator() {
  return apiFetch<{ connected: false }>("/job-distribution-aggregator", { method: "DELETE" });
}
