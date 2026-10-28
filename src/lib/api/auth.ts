import { apiFetch } from "./client";
import type { CurrentUser } from "@/stores/auth-store";

export interface AuthResponse {
  accessToken: string;
  user: CurrentUser;
}

export function login(email: string, password: string) {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      timezoneOffset: new Date().getTimezoneOffset(),
    }),
    skipAuthRetry: true,
  });
}

// The refresh token itself never reaches this code -- it's an httpOnly
// cookie sent automatically by the browser (rawFetch uses `credentials:
// "include"`), which is the whole point of httpOnly: JS, including an XSS
// payload, can never read it.
export function refresh() {
  return apiFetch<AuthResponse>("/auth/refresh", {
    method: "POST",
    skipAuthRetry: true,
  });
}

export function logout() {
  return apiFetch<{ success: boolean }>("/auth/logout", {
    method: "POST",
    skipAuthRetry: true,
  });
}

export function me() {
  return apiFetch<CurrentUser>("/auth/me");
}

export function forgotPassword(email: string) {
  return apiFetch<{ success: boolean }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
    skipAuthRetry: true,
  });
}

export function resetPassword(token: string, newPassword: string) {
  return apiFetch<{ success: boolean }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
    skipAuthRetry: true,
  });
}
