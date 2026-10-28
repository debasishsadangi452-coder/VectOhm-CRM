import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createUser,
  deleteUser,
  listUsers,
  permanentlyDeleteUser,
  updateMyProfile,
  updateUser,
  updateUserTarget,
  updateUserGithubUsername,
  uploadMyAvatar,
  type CreateUserInput,
  type UpdateProfileInput,
  type UpdateUserInput,
} from "@/lib/api/users";
import { useAuthStore } from "@/stores/auth-store";

export function useUsers(enabled = true) {
  return useQuery({ queryKey: ["users"], queryFn: listUsers, enabled });
}

function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["users"] });
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (input: CreateUserInput) => createUser(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) => updateUser(id, input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateUserTarget() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, monthlyTarget }: { id: string; monthlyTarget: number | null }) =>
      updateUserTarget(id, monthlyTarget),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateGithubUsername() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, githubUsername }: { id: string; githubUsername: string | null }) =>
      updateUserGithubUsername(id, githubUsername),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => invalidate(),
  });
}

// Permanent, irreversible -- see permanentlyDeleteUser.
export function usePermanentlyDeleteUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (id: string) => permanentlyDeleteUser(id),
    onSuccess: () => invalidate(),
  });
}

// Self-service profile edit. Syncs the returned name/email back into the auth
// store so the sidebar updates immediately, and refreshes the directory.
export function useUpdateMyProfile() {
  const invalidate = useInvalidateUsers();
  const patchUser = useAuthStore((s) => s.patchUser);
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => updateMyProfile(input),
    onSuccess: (updated) => {
      patchUser({
        firstName: updated.firstName,
        lastName: updated.lastName,
        email: updated.email,
        avatarUrl: updated.avatarUrl,
      });
      invalidate();
    },
  });
}

export function useUploadAvatar() {
  const invalidate = useInvalidateUsers();
  const patchUser = useAuthStore((s) => s.patchUser);
  return useMutation({
    mutationFn: (file: File) => uploadMyAvatar(file),
    onSuccess: (updated) => {
      patchUser({ avatarUrl: updated.avatarUrl });
      invalidate();
    },
  });
}
