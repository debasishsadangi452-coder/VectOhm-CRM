import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Trash2, Plus, CalendarClock, FileText, Upload, CheckCircle2, Link2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { InterviewFormDialog } from "@/components/interview-form-dialog";
import { OfferFormDialog } from "@/components/offer-form-dialog";
import {
  useCandidate,
  useCreateCandidate,
  useUpdateCandidate,
  useDeleteCandidate,
  useJobPostings,
} from "@/hooks/use-recruitment";
import { useUsers } from "@/hooks/use-users";
import { useAuthStore } from "@/stores/auth-store";
import {
  CANDIDATE_STAGES,
  CANDIDATE_STAGE_LABELS,
  INTERVIEW_STATUS_LABELS,
  INTERVIEW_TYPE_LABELS,
  OFFER_STATUS_LABELS,
  uploadCandidateResume,
  type Candidate,
  type CandidateStage,
  type Interview,
  type Offer,
} from "@/lib/api/recruitment";

interface CandidateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate?: Candidate;
  defaultJobPostingId?: string;
  defaultStage?: CandidateStage;
}

export function CandidateFormDialog({
  open,
  onOpenChange,
  candidate,
  defaultJobPostingId,
  defaultStage,
}: CandidateFormDialogProps) {
  const isEdit = !!candidate;
  const currentUser = useAuthStore((s) => s.user);
  const { data: detail } = useCandidate(isEdit ? candidate!.id : undefined);
  const { data: jobPostings } = useJobPostings();
  const { data: users } = useUsers();
  const createCandidate = useCreateCandidate();
  const updateCandidate = useUpdateCandidate();
  const deleteCandidate = useDeleteCandidate();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [showUrlFallback, setShowUrlFallback] = useState(false);
  const [source, setSource] = useState("");
  const [jobPostingId, setJobPostingId] = useState("");
  const [stage, setStage] = useState<CandidateStage>("APPLIED");
  const [ownerId, setOwnerId] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isAdmin = currentUser?.role.name === "ADMIN";
  const assignableUsers = isAdmin
    ? users
    : users?.filter((u) => u.department?.id === currentUser?.department?.id);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editingInterview, setEditingInterview] = useState<Interview | undefined>(undefined);
  const [offerDialogOpen, setOfferDialogOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    setFirstName(candidate?.firstName ?? "");
    setLastName(candidate?.lastName ?? "");
    setEmail(candidate?.email ?? "");
    setPhone(candidate?.phone ?? "");
    setResumeUrl(candidate?.resumeUrl ?? "");
    setResumeFileName(candidate?.resumeUrl ? candidate.resumeUrl.split("/").pop() || "Resume" : "");
    setShowUrlFallback(false);
    setSource(candidate?.source ?? "");
    setJobPostingId(candidate?.jobPostingId ?? defaultJobPostingId ?? "");
    setStage(candidate?.stage ?? defaultStage ?? "APPLIED");
    setOwnerId(candidate?.ownerId ?? currentUser?.id ?? "");
    setRejectionReason(candidate?.rejectionReason ?? "");
    setError(null);
  }, [open, candidate, defaultJobPostingId, defaultStage, currentUser]);

  async function handleResumeFileChange(file: File) {
    if (!file) return;
    setIsUploadingResume(true);
    setError(null);
    try {
      const res = await uploadCandidateResume(file);
      setResumeUrl(res.url);
      setResumeFileName(res.originalName || file.name);
    } catch (err: any) {
      setError(err?.message || "Failed to upload resume. Please choose a valid PDF or Word document.");
    } finally {
      setIsUploadingResume(false);
    }
  }

  const saving = createCandidate.isPending || updateCandidate.isPending;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!jobPostingId) {
      setError("Select a job posting");
      return;
    }
    try {
      if (isEdit && candidate) {
        await updateCandidate.mutateAsync({
          id: candidate.id,
          input: {
            firstName,
            lastName,
            email: email || undefined,
            phone: phone || undefined,
            resumeUrl: resumeUrl || undefined,
            source: source || undefined,
            stage,
            ownerId: ownerId || undefined,
            rejectionReason: stage === "REJECTED" ? rejectionReason || undefined : undefined,
          },
        });
      } else {
        await createCandidate.mutateAsync({
          firstName,
          lastName,
          email: email || undefined,
          phone: phone || undefined,
          resumeUrl: resumeUrl || undefined,
          source: source || undefined,
          jobPostingId,
          stage,
          ownerId: ownerId || undefined,
        });
      }
      onOpenChange(false);
    } catch {
      setError("Could not save candidate");
    }
  }

  async function handleDelete() {
    if (!candidate) return;
    try {
      await deleteCandidate.mutateAsync(candidate.id);
      onOpenChange(false);
    } catch {
      setError("Could not delete candidate");
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit candidate" : "New candidate"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cand-first">First name</Label>
                <Input id="cand-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cand-last">Last name</Label>
                <Input id="cand-last" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cand-email">Email</Label>
                <Input id="cand-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cand-phone">Phone</Label>
                <Input id="cand-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="cand-resume-file">Resume</Label>
                  <button
                    type="button"
                    onClick={() => setShowUrlFallback(!showUrlFallback)}
                    className="text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                  >
                    {showUrlFallback ? "Upload file" : "Paste URL"}
                  </button>
                </div>
                {showUrlFallback ? (
                  <Input
                    id="cand-resume"
                    value={resumeUrl}
                    onChange={(e) => {
                      setResumeUrl(e.target.value);
                      setResumeFileName("");
                    }}
                    placeholder="https://..."
                  />
                ) : (
                  <div className="space-y-1">
                    {resumeUrl ? (
                      <div className="flex items-center justify-between gap-2 p-2 rounded-md border border-border bg-muted/40 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="size-4 text-primary shrink-0" />
                          <span className="truncate font-medium text-foreground">
                            {resumeFileName || resumeUrl.split("/").pop() || "Resume attached"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              setResumeUrl("");
                              setResumeFileName("");
                            }}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <label
                        htmlFor="cand-resume-file"
                        className="flex flex-col items-center justify-center p-3 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 cursor-pointer transition-all text-center group"
                      >
                        {isUploadingResume ? (
                          <div className="flex items-center gap-2 py-1 text-xs text-blue-600 font-medium">
                            <Loader2 className="size-4 animate-spin" />
                            <span>Uploading resume...</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 py-0.5">
                            <div className="size-7 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                              <Upload className="size-3.5" />
                            </div>
                            <div className="text-left">
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 transition-colors">
                                Upload Resume
                              </p>
                              <p className="text-[10px] text-slate-500 font-medium">PDF, DOC, DOCX (up to 25MB)</p>
                            </div>
                          </div>
                        )}
                        <input
                          id="cand-resume-file"
                          type="file"
                          accept=".pdf,.doc,.docx,.rtf,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          className="sr-only"
                          disabled={isUploadingResume}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleResumeFileChange(file);
                          }}
                        />
                      </label>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cand-source">Source</Label>
                <Input
                  id="cand-source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="Referral, LinkedIn, ..."
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Job posting</Label>
                <Select value={jobPostingId} onValueChange={setJobPostingId} disabled={isEdit}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select posting" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobPostings?.map((jp) => (
                      <SelectItem key={jp.id} value={jp.id}>
                        {jp.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Stage</Label>
                <Select value={stage} onValueChange={(v) => setStage(v as CandidateStage)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CANDIDATE_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {CANDIDATE_STAGE_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Owner (recruiter)</Label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assignableUsers?.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {stage === "REJECTED" && (
              <div className="space-y-1.5">
                <Label htmlFor="cand-reject-reason">Rejection reason</Label>
                <Textarea
                  id="cand-reject-reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={2}
                />
              </div>
            )}

            {isEdit && detail && (
              <>
                <div className="space-y-2 border-t border-border-subtle pt-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold flex items-center gap-1.5">
                      <CalendarClock className="size-4" /> Interviews
                    </h4>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingInterview(undefined);
                        setScheduleOpen(true);
                      }}
                    >
                      <Plus className="size-3.5" /> Schedule
                    </Button>
                  </div>
                  {detail.interviews.length === 0 ? (
                    <p className="text-xs text-text-dim">No interviews scheduled yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {detail.interviews.map((iv) => (
                        <button
                          type="button"
                          key={iv.id}
                          onClick={() => {
                            setEditingInterview(iv);
                            setScheduleOpen(true);
                          }}
                          className="w-full flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-canvas/40 px-3 py-2 text-left hover:border-border transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">
                              {INTERVIEW_TYPE_LABELS[iv.type]} · {new Date(iv.scheduledAt).toLocaleString()}
                            </p>
                            <p className="text-[11px] text-text-dim truncate">
                              {iv.interviewer ? `${iv.interviewer.firstName} ${iv.interviewer.lastName}` : "Unassigned"}
                              {iv.rating ? ` · ${iv.rating}/5` : ""}
                            </p>
                          </div>
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            {INTERVIEW_STATUS_LABELS[iv.status]}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2 border-t border-border-subtle pt-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold flex items-center gap-1.5">
                      <FileText className="size-4" /> Offers
                    </h4>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingOffer(undefined);
                        setOfferDialogOpen(true);
                      }}
                    >
                      <Plus className="size-3.5" /> New offer
                    </Button>
                  </div>
                  {detail.offers.length === 0 ? (
                    <p className="text-xs text-text-dim">No offers yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {detail.offers.map((offer) => (
                        <button
                          type="button"
                          key={offer.id}
                          onClick={() => {
                            setEditingOffer(offer);
                            setOfferDialogOpen(true);
                          }}
                          className="w-full flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-canvas/40 px-3 py-2 text-left hover:border-border transition-colors"
                        >
                          <p className="text-xs font-medium">${offer.salary.toLocaleString()}</p>
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            {OFFER_STATUS_LABELS[offer.status]}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter className="gap-2 sm:justify-between">
              {isEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={handleDelete}
                  disabled={deleteCandidate.isPending}
                >
                  {deleteCandidate.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  Delete
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : isEdit ? "Save changes" : "Add candidate"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {isEdit && candidate && (
        <>
          <InterviewFormDialog
            open={scheduleOpen}
            onOpenChange={setScheduleOpen}
            interview={editingInterview}
            candidateId={candidate.id}
            candidateName={`${candidate.firstName} ${candidate.lastName}`}
          />
          <OfferFormDialog
            open={offerDialogOpen}
            onOpenChange={setOfferDialogOpen}
            offer={editingOffer}
            candidateId={candidate.id}
            candidateName={`${candidate.firstName} ${candidate.lastName}`}
          />
        </>
      )}
    </>
  );
}
