import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getGoogleAdsStatus,
  connectGoogleAds,
  disconnectGoogleAds,
  syncGoogleAds,
  getGoogleAdsSummary,
  getOfflineConversions,
  getGa4Status,
  connectGa4,
  disconnectGa4,
  syncGa4,
  getGa4Traffic,
} from "@/lib/api/google-ads";

export function useGoogleAdsStatus() {
  return useQuery({
    queryKey: ["google-ads", "status"],
    queryFn: getGoogleAdsStatus,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });
}

export function useGoogleAdsSummary() {
  return useQuery({
    queryKey: ["google-ads", "summary"],
    queryFn: getGoogleAdsSummary,
    refetchInterval: 5000, // Live real-time polling every 5 seconds
    refetchOnWindowFocus: true,
  });
}

export function useOfflineConversions() {
  return useQuery({
    queryKey: ["google-ads", "offline-conversions"],
    queryFn: getOfflineConversions,
    refetchInterval: 5000, // Live real-time polling every 5 seconds
    refetchOnWindowFocus: true,
  });
}

export function useConnectGoogleAds() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: connectGoogleAds,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-ads"] });
    },
  });
}

export function useDisconnectGoogleAds() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: disconnectGoogleAds,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-ads"] });
    },
  });
}

export function useSyncGoogleAds() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncGoogleAds,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-ads"] });
    },
  });
}

// GA4 hooks
export function useGa4Status() {
  return useQuery({
    queryKey: ["ga4", "status"],
    queryFn: getGa4Status,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });
}

export function useGa4Traffic() {
  return useQuery({
    queryKey: ["ga4", "traffic"],
    queryFn: getGa4Traffic,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });
}

export function useConnectGa4() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: connectGa4,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ga4"] });
    },
  });
}

export function useDisconnectGa4() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: disconnectGa4,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ga4"] });
    },
  });
}

export function useSyncGa4() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncGa4,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ga4"] });
    },
  });
}
