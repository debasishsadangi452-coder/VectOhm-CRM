import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Trash2 } from "lucide-react";
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
import { useCandidates } from "@/hooks/use-recruitment";
import { useCreateInterview, useUpdateInterview, useDeleteInterview } from "@/hooks/use-recruitment";
import { useUsers } from "@/hooks/use-users";
import {
  INTERVIEW_STATUSES,
  INTERVIEW_STATUS_LABELS,
  INTERVIEW_TYPES,
  INTERVIEW_TYPE_LABELS,
  type Interview,
  type InterviewStatus,
  type InterviewType,
} from "@/lib/api/recruitment";

const NO_INTERVIEWER = "__none__";

// Local <-> ISO conversion for the datetime-local input.
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 16);
}

interface InterviewFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interview?: Interview;
  /** Pre-selected/locked candidate when scheduled from within a candidate's own view. */
  candidateId?: string;
  candidateName?: string;
}

export function InterviewFormDialog({
  open,
  onOpenChange,
  interview,
  candidateId,
  candidateName,
}: InterviewFormDialogProps) {
  const isEdit = !!interview;
  const { data: users } = useUsers();
  const { data: candidates } = useCandidates();
  const createInterview = useCreateInterview();
  const updateInterview = useUpdateInterview();
  const deleteInterview = useDeleteInterview();

  const [selectedCandidateId, setSelectedCandidateId] = useState(candidateId ?? "");
  const [interviewerId, setInterviewerId] = useState<string>(NO_INTERVIEWER);
  const [type, setType] = useState<InterviewType>("PHONE_SCREEN");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<InterviewStatus>("SCHEDULED");
  const [feedback, setFeedback] = useState("");
  const [rating, setRating] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedCandidateId(interview?.candidateId ?? candidateId ?? "");
    setInterviewerId(interview?.interviewerId ?? NO_INTERVIEWER);
    setType(interview?.type ?? "PHONE_SCREEN");
    setScheduledAt(interview ? toLocalInputValue(interview.scheduledAt) : "");
    setDurationMinutes(String(interview?.durationMinutes ?? 30));
    setLocation(interview?.location ?? "");
    setStatus(interview?.status ?? "SCHEDULED");
    setFeedback(interview?.feedback ?? "");
    setRating(interview?.rating ? String(interview.rating) : "");
    setError(null);
  }, [open, interview, candidateId]);

  const saving = createInterview.isPending || updateInterview.isPending;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedCandidateId || !scheduledAt) return;

    try {
      if (isEdit && interview) {
        await updateInterview.mutateAsync({
          id: interview.id,
          input: {
            interviewerId: interviewerId === NO_INTERVIEWER ? undefined : interviewerId,
            type,
            scheduledAt: new Date(scheduledAt).toISOString(),
            durationMinutes: Number(durationMinutes) || 30,
            location: location || undefined,
            status,
            feedback: feedback || undefined,
            rating: rating ? Number(rating) : undefined,
          },
        });
      } else {
        await createInterview.mutateAsync({
          candidateId: selectedCandidateId,
          interviewerId: interviewerId === NO_INTERVIEWER ? undefined : interviewerId,
          type,
          scheduledAt: new Date(scheduledAt).toISOString(),
          durationMinutes: Number(durationMinutes) || 30,
          location: location || undefined,
        });
      }
      onOpenChange(false);
    } catch {
      setError("Could not save interview");
    }
  }

  async function handleDelete() {
    if (!interview) return;
    try {
      await deleteInterview.mutateAsync(interview.id);
      onOpenChange(false);
    } catch {
      setError("Could not delete interview");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit interview" : "Schedule interview"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {candidateId ? (
            <div className="space-y-1.5">
              <Label>Candidate</Label>
              <p className="text-sm font-medium">{candidateName}</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Candidate</Label>
              <Select value={selectedCandidateId} onValueChange={setSelectedCandidateId} disabled={isEdit}>
                <SelectTrigger>
                  <SelectValue placeholder="Select candidate" />
                </SelectTrigger>
                <SelectContent>
                  {candidates?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.firstName} {c.lastName} — {c.jobPosting.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as InterviewType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVIEW_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {INTERVIEW_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Interviewer</Label>
              <Select value={interviewerId} onValueChange={setInterviewerId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_INTERVIEWER}>Unassigned</SelectItem>
                  {users?.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="interview-time">Date & time</Label>
              <Input
                id="interview-time"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="interview-duration">Duration (min)</Label>
              <Input
                id="interview-duration"
                type="number"
                min={5}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="interview-location">Location / link</Label>
            <Input
              id="interview-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Video call link, room, ..."
            />
          </div>

          {isEdit && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as InterviewStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTERVIEW_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {INTERVIEW_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="interview-rating">Rating (1-5)</Label>
                  <Input
                    id="interview-rating"
                    type="number"
                    min={1}
                    max={5}
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="interview-feedback">Feedback</Label>
                <Textarea
                  id="interview-feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={3}
                />
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
                disabled={deleteInterview.isPending}
              >
                {deleteInterview.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Delete
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={saving || !selectedCandidateId}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : isEdit ? "Save changes" : "Schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
