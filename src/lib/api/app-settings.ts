import { apiFetch } from "./client";

export interface AppSettings {
  heroTagline: string | null;
}

export interface UpdateAppSettingsInput {
  heroTagline?: string | null;
}

export function getAppSettings() {
  return apiFetch<AppSettings>("/app-settings");
}

export function updateAppSettings(input: UpdateAppSettingsInput) {
  return apiFetch<AppSettings>("/app-settings", { method: "PATCH", body: JSON.stringify(input) });
}
