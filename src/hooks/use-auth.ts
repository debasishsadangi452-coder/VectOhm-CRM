import { useMutation } from "@tanstack/react-query";
import { forgotPassword, resetPassword } from "@/lib/api/auth";

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: ({ email }: { email: string }) => forgotPassword(email),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ token, newPassword }: { token: string; newPassword: string }) =>
      resetPassword(token, newPassword),
  });
}
