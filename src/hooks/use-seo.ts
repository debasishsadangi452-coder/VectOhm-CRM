import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as seoApi from "../lib/api/seo";

export function useKeywords(departmentId?: string, enabled = true) {
  return useQuery({
    queryKey: ["seo-keywords", departmentId],
    queryFn: () => seoApi.getKeywords(departmentId),
    enabled,
  });
}

export function useCreateKeyword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: seoApi.createKeyword,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["seo-keywords", variables.departmentId] });
    },
  });
}

export function useAudits(departmentId?: string, enabled = true) {
  return useQuery({
    queryKey: ["seo-audits", departmentId],
    queryFn: () => seoApi.getAudits(departmentId),
    enabled,
  });
}

export function useCreateAudit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: seoApi.createAudit,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["seo-audits", variables.departmentId] });
    },
  });
}

export function useBacklinks(departmentId?: string, enabled = true) {
  return useQuery({
    queryKey: ["seo-backlinks", departmentId],
    queryFn: () => seoApi.getBacklinks(departmentId),
    enabled,
  });
}

export function useCreateBacklink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: seoApi.createBacklink,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["seo-backlinks", variables.departmentId] });
    },
  });
}

export function useUpdateBacklink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...backlink }: Partial<seoApi.SeoBacklink> & { id: string }) =>
      seoApi.updateBacklink(id, backlink),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["seo-backlinks", data.departmentId] });
    },
  });
}

export function useContentBriefs(departmentId?: string) {
  return useQuery({
    queryKey: ["seo-content-briefs", departmentId],
    queryFn: () => seoApi.getContentBriefs(departmentId),
    enabled: !!departmentId,
  });
}

export function useCreateContentBrief() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: seoApi.createContentBrief,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["seo-content-briefs", variables.departmentId] });
    },
  });
}

export function useUpdateContentBrief() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...brief }: Partial<seoApi.SeoContentBrief> & { id: string }) =>
      seoApi.updateContentBrief(id, brief),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["seo-content-briefs", data.departmentId] });
    },
  });
}

export function useGenerateContentBrief() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: seoApi.generateContentBrief,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["seo-content-briefs", data.departmentId] });
    },
  });
}

export function useAddQaCheck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ briefId, checkItem }: { briefId: string; checkItem: string }) =>
      seoApi.addQaCheck(briefId, checkItem),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seo-content-briefs"] });
    },
  });
}

export function useToggleQaCheck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ checkId, isPassed }: { checkId: string; isPassed: boolean }) =>
      seoApi.toggleQaCheck(checkId, isPassed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seo-content-briefs"] });
    },
  });
}

export function useRemoveQaCheck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (checkId: string) => seoApi.removeQaCheck(checkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seo-content-briefs"] });
    },
  });
}

export function useCompetitors(departmentId?: string) {
  return useQuery({
    queryKey: ["seo-competitors", departmentId],
    queryFn: () => seoApi.getCompetitors(departmentId),
    enabled: !!departmentId,
  });
}

export function useCreateCompetitor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: seoApi.createCompetitor,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["seo-competitors", variables.departmentId] });
    },
  });
}

export function useCampaigns(departmentId?: string) {
  return useQuery({
    queryKey: ["seo-marketing-campaigns", departmentId],
    queryFn: () => seoApi.getCampaigns(departmentId),
    enabled: !!departmentId,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: seoApi.createCampaign,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["seo-marketing-campaigns", variables.departmentId],
      });
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...campaign }: Partial<seoApi.MarketingCampaign> & { id: string }) =>
      seoApi.updateCampaign(id, campaign),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["seo-marketing-campaigns", data.departmentId],
      });
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => seoApi.deleteCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seo-marketing-campaigns"] });
    },
  });
}

export function useKpiGoals(departmentId?: string) {
  return useQuery({
    queryKey: ["seo-kpi-goals", departmentId],
    queryFn: () => seoApi.getKpiGoals(departmentId),
    enabled: !!departmentId,
  });
}

export function useCreateKpiGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: seoApi.createKpiGoal,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["seo-kpi-goals", variables.departmentId] });
    },
  });
}

export function useUpdateKpiGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...goal }: Partial<seoApi.SeoKpiGoal> & { id: string }) =>
      seoApi.updateKpiGoal(id, goal),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["seo-kpi-goals", data.departmentId] });
    },
  });
}

export function useDeleteKpiGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => seoApi.deleteKpiGoal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seo-kpi-goals"] });
    },
  });
}
