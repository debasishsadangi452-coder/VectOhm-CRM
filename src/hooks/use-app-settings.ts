import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAppSettings, updateAppSettings, type UpdateAppSettingsInput } from "@/lib/api/app-settings";

export function useAppSettings() {
  return useQuery({ queryKey: ["app-settings"], queryFn: getAppSettings });
}

export function useUpdateAppSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAppSettingsInput) => updateAppSettings(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["app-settings"] }),
  });
}
