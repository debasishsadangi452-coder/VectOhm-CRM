import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api/recruitment";

// --- Job Postings ---

export function useJobPostings(filters: api.JobPostingFilters = {}, enabled = true) {
  return useQuery({ queryKey: ["job-postings", filters], queryFn: () => api.listJobPostings(filters), enabled });
}

export function useJobPosting(id: string | undefined) {
  return useQuery({
    queryKey: ["job-postings", "detail", id],
    queryFn: () => api.getJobPosting(id!),
    enabled: !!id,
  });
}

function useInvalidateJobPostings() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["job-postings"] });
    queryClient.invalidateQueries({ queryKey: ["recruitment-analytics"] });
    queryClient.invalidateQueries({ queryKey: ["careers", "jobs"] });
  };
}

export function useCreateJobPosting() {
  const invalidate = useInvalidateJobPostings();
  return useMutation({
    mutationFn: (input: api.CreateJobPostingInput) => api.createJobPosting(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateJobPosting() {
  const invalidate = useInvalidateJobPostings();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: api.UpdateJobPostingInput }) => api.updateJobPosting(id, input),
    onSuccess: () => invalidate(),
  });
}

export function useCloseJobPosting() {
  const invalidate = useInvalidateJobPostings();
  return useMutation({
    mutationFn: (id: string) => api.closeJobPosting(id),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteJobPosting() {
  const invalidate = useInvalidateJobPostings();
  return useMutation({
    mutationFn: (id: string) => api.deleteJobPosting(id),
    onSuccess: () => invalidate(),
  });
}

export function useRetryJobBoardListing() {
  const invalidate = useInvalidateJobPostings();
  return useMutation({
    mutationFn: ({ jobPostingId, board }: { jobPostingId: string; board: api.JobBoard }) =>
      api.retryJobBoardListing(jobPostingId, board),
    onSuccess: () => invalidate(),
  });
}

// --- Candidates ---

export function useCandidates(filters: api.CandidateFilters = {}, enabled = true) {
  return useQuery({ queryKey: ["candidates", filters], queryFn: () => api.listCandidates(filters), enabled });
}

export function useCandidate(id: string | undefined) {
  return useQuery({
    queryKey: ["candidates", "detail", id],
    queryFn: () => api.getCandidate(id!),
    enabled: !!id,
  });
}

function useInvalidateCandidates() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["candidates"] });
    queryClient.invalidateQueries({ queryKey: ["job-postings"] });
    queryClient.invalidateQueries({ queryKey: ["recruitment-analytics"] });
  };
}

export function useCreateCandidate() {
  const invalidate = useInvalidateCandidates();
  return useMutation({
    mutationFn: (input: api.CreateCandidateInput) => api.createCandidate(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateCandidate() {
  const invalidate = useInvalidateCandidates();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: api.UpdateCandidateInput }) => api.updateCandidate(id, input),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteCandidate() {
  const invalidate = useInvalidateCandidates();
  return useMutation({
    mutationFn: (id: string) => api.deleteCandidate(id),
    onSuccess: () => invalidate(),
  });
}

// --- Interviews ---

export function useInterviews(filters: api.InterviewFilters = {}) {
  return useQuery({ queryKey: ["interviews", filters], queryFn: () => api.listInterviews(filters) });
}

function useInvalidateInterviews() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["interviews"] });
    queryClient.invalidateQueries({ queryKey: ["candidates"] });
    queryClient.invalidateQueries({ queryKey: ["recruitment-analytics"] });
  };
}

export function useCreateInterview() {
  const invalidate = useInvalidateInterviews();
  return useMutation({
    mutationFn: (input: api.CreateInterviewInput) => api.createInterview(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateInterview() {
  const invalidate = useInvalidateInterviews();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: api.UpdateInterviewInput }) => api.updateInterview(id, input),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteInterview() {
  const invalidate = useInvalidateInterviews();
  return useMutation({
    mutationFn: (id: string) => api.deleteInterview(id),
    onSuccess: () => invalidate(),
  });
}

// --- Offers ---

export function useOffers(filters: api.OfferFilters = {}) {
  return useQuery({ queryKey: ["offers", filters], queryFn: () => api.listOffers(filters) });
}

function useInvalidateOffers() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["offers"] });
    queryClient.invalidateQueries({ queryKey: ["candidates"] });
    queryClient.invalidateQueries({ queryKey: ["recruitment-analytics"] });
  };
}

export function useCreateOffer() {
  const invalidate = useInvalidateOffers();
  return useMutation({
    mutationFn: (input: api.CreateOfferInput) => api.createOffer(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateOffer() {
  const invalidate = useInvalidateOffers();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: api.UpdateOfferInput }) => api.updateOffer(id, input),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteOffer() {
  const invalidate = useInvalidateOffers();
  return useMutation({
    mutationFn: (id: string) => api.deleteOffer(id),
    onSuccess: () => invalidate(),
  });
}

// --- Analytics ---

export function useRecruitmentAnalyticsSummary(enabled = true) {
  return useQuery({
    queryKey: ["recruitment-analytics", "summary"],
    queryFn: api.getRecruitmentAnalyticsSummary,
    enabled,
  });
}

// --- ROS Intelligence Hooks ---

export function useRosHealth(enabled = true) {
  return useQuery({
    queryKey: ["recruitment-analytics", "ros-health"],
    queryFn: api.getRosHealth,
    enabled,
  });
}

export function useRediscovery(jobPostingId?: string, enabled = true) {
  return useQuery({
    queryKey: ["recruitment-analytics", "rediscovery", jobPostingId],
    queryFn: () => api.getRediscovery(jobPostingId),
    enabled,
  });
}

export function useReactivateRediscoveredCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ candidateId, jobPostingId }: { candidateId: string; jobPostingId: string }) =>
      api.reactivateRediscoveredCandidate(candidateId, jobPostingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      queryClient.invalidateQueries({ queryKey: ["recruitment-analytics"] });
    },
  });
}

export function useSLAPriorityQueue(enabled = true) {
  return useQuery({
    queryKey: ["recruitment-analytics", "sla-priority-queue"],
    queryFn: api.getSLAPriorityQueue,
    enabled,
  });
}

export function useTriggerSlaNudge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ candidateId, message }: { candidateId: string; message?: string }) =>
      api.triggerSlaNudge(candidateId, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment-analytics"] });
    },
  });
}

export function useTriggerInterviewerReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (interviewId: string) => api.triggerInterviewerReminder(interviewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment-analytics"] });
    },
  });
}

export function useAdvanceSlaStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ candidateId, nextStage }: { candidateId: string; nextStage: api.CandidateStage }) =>
      api.advanceSlaStage(candidateId, nextStage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      queryClient.invalidateQueries({ queryKey: ["recruitment-analytics"] });
    },
  });
}

export function useActionQueue(enabled = true) {
  return useQuery({
    queryKey: ["recruitment-analytics", "action-queue"],
    queryFn: api.getActionQueue,
    enabled,
  });
}

export function useTalentPools(enabled = true) {
  return useQuery({
    queryKey: ["recruitment-analytics", "talent-pools"],
    queryFn: api.getTalentPools,
    enabled,
  });
}

export function useTeamPerformance(range?: string, enabled = true) {
  return useQuery({
    queryKey: ["recruitment-analytics", "team-performance", range ?? "all"],
    queryFn: () => api.getTeamPerformance(range),
    enabled,
  });
}

export function useCandidateRiskProfile(id: string | undefined) {
  return useQuery({
    queryKey: ["recruitment-analytics", "candidate-risk", id],
    queryFn: () => api.getCandidateRiskProfile(id!),
    enabled: !!id,
  });
}

// --- Clients ---

export function useClients() {
  return useQuery({ queryKey: ["recruitment-clients"], queryFn: api.listClients });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: api.CreateClientInput) => api.createClient(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recruitment-clients"] }),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: api.UpdateClientInput }) => api.updateClient(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recruitment-clients"] }),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteClient(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recruitment-clients"] }),
  });
}

// --- Vendors ---

export function useVendors() {
  return useQuery({ queryKey: ["recruitment-vendors"], queryFn: api.listVendors });
}

export function useCreateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: api.CreateVendorInput) => api.createVendor(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recruitment-vendors"] }),
  });
}

export function useUpdateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: api.UpdateVendorInput }) => api.updateVendor(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recruitment-vendors"] }),
  });
}

export function useDeleteVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteVendor(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recruitment-vendors"] }),
  });
}

// --- Recruitment Leads (Ceipal CRM) ---

export function useRecruitmentLeads() {
  return useQuery({ queryKey: ["recruitment-leads"], queryFn: api.listLeads });
}

export function useCreateRecruitmentLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: api.CreateLeadInput) => api.createLead(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recruitment-leads"] }),
  });
}

export function useUpdateRecruitmentLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: api.UpdateLeadInput }) => api.updateLead(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recruitment-leads"] }),
  });
}

export function useDeleteRecruitmentLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteLead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recruitment-leads"] }),
  });
}

// --- Eboarding ---

export function useEboardings() {
  return useQuery({ queryKey: ["eboarding"], queryFn: api.listEboardings });
}

export function useCreateEboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: api.CreateEboardingInput) => api.createEboarding(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["eboarding"] }),
  });
}

export function useUpdateEboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: api.UpdateEboardingInput }) => api.updateEboarding(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["eboarding"] }),
  });
}

export function useUpdateEboardingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: api.EboardingStatus }) =>
      api.updateEboardingStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["eboarding"] }),
  });
}

export function useDeleteEboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteEboarding(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["eboarding"] }),
  });
}

// --- Job-detail-panel collaboration sub-entities ---

export function useJobTasks() {
  return useQuery({ queryKey: ["job-tasks"], queryFn: api.listJobTasks });
}

export function useCreateJobTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: api.CreateJobTaskInput) => api.createJobTask(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job-tasks"] }),
  });
}

export function useDeleteJobTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteJobTask(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job-tasks"] }),
  });
}

export function useJobActivities() {
  return useQuery({ queryKey: ["job-activities"], queryFn: api.listJobActivities });
}

export function useCreateJobActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: api.CreateJobActivityInput) => api.createJobActivity(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job-activities"] }),
  });
}

export function useJobEmailMerges() {
  return useQuery({ queryKey: ["job-email-merges"], queryFn: api.listJobEmailMerges });
}

export function useCreateJobEmailMerge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: api.CreateJobEmailMergeInput) => api.createJobEmailMerge(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job-email-merges"] }),
  });
}

export function useJobSubmissions() {
  return useQuery({ queryKey: ["job-submissions"], queryFn: api.listJobSubmissions });
}

export function useCreateJobSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: api.CreateJobSubmissionInput) => api.createJobSubmission(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job-submissions"] }),
  });
}

export function useDeleteJobSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteJobSubmission(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job-submissions"] }),
  });
}

export function useJobNotes() {
  return useQuery({ queryKey: ["job-notes"], queryFn: api.listJobNotes });
}

export function useCreateJobNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: api.CreateJobNoteInput) => api.createJobNote(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job-notes"] }),
  });
}

export function useDeleteJobNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteJobNote(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job-notes"] }),
  });
}

export function useJobDocuments() {
  return useQuery({ queryKey: ["job-documents"], queryFn: api.listJobDocuments });
}

export function useCreateJobDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: api.CreateJobDocumentInput) => api.createJobDocument(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job-documents"] }),
  });
}

export function useDeleteJobDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteJobDocument(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job-documents"] }),
  });
}

